const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const User = require('../models/User');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// @route   POST /api/payments/create-checkout-session
// @desc    Create a stripe checkout session for premium subscription
// @access  Private
router.post('/create-checkout-session', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        const priceId = process.env.STRIPE_PREMIUM_PRICE_ID;

        if (!user) {
            return res.status(404).json({ msg: 'User not found' });
        }

        let stripeCustomerId = user.stripeCustomerId;
        let customer;

        // Om användaren har ett Stripe-kund-ID, verifiera att det finns i Stripe
        if (stripeCustomerId) {
            try {
                customer = await stripe.customers.retrieve(stripeCustomerId);
                if (customer.deleted) {
                    // Kunden har raderats i Stripe, behandla som om de inte har ett ID
                    stripeCustomerId = null;
                }
            } catch (error) {
                // Kund-ID:t är inte giltigt i det nuvarande Stripe-läget (t.ex. test vs. live)
                console.warn('Stripe customer ID not found, creating a new one.');
                stripeCustomerId = null;
            }
        }

        // Om användaren inte är en Stripe-kund än (eller om det gamla var ogiltigt), skapa en
        if (!stripeCustomerId) {
            customer = await stripe.customers.create({
                email: user.email,
                name: user.username,
                metadata: { mongoUserId: user.id },
            });
            stripeCustomerId = customer.id;
            user.stripeCustomerId = stripeCustomerId;
            await user.save();
        }

        const session = await stripe.checkout.sessions.create({
            customer: stripeCustomerId,
            payment_method_types: ['card'],
            line_items: [{
                price: priceId,
                quantity: 1,
            }],
            mode: 'subscription',
            success_url: `${process.env.CLIENT_URL}/profile?payment_success=true`,
            cancel_url: `${process.env.CLIENT_URL}/profile?payment_canceled=true`,
            metadata: { mongoUserId: user.id }
        });

        res.json({ url: session.url });

    } catch (err) {
        console.error('Stripe error:', err.message);
        console.error('Stripe error details:', err);
        res.status(500).send('Server Error');
    }
});

// @route   POST /api/payments/webhook
// @desc    Listen for events from Stripe
// @access  Public (Stripe needs to be able to access this)
router.post('/webhook', express.raw({type: 'application/json'}), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event;

    try {
        event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err) {
        console.log(`❌ Error message: ${err.message}`);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    switch (event.type) {
        case 'checkout.session.completed':
            const session = event.data.object;
            const mongoUserId = session.metadata.mongoUserId;

            try {
                // Hitta användaren och uppdatera deras prenumerationsstatus
                await User.findByIdAndUpdate(mongoUserId, {
                    subscriptionStatus: 'active'
                });
                console.log(`✅ Subscription for user ${mongoUserId} is now active.`);
            } catch (err) {
                console.error('Error updating user subscription status:', err);
            }
            break;
        // ... hantera andra event-typer, t.ex. 'customer.subscription.deleted'
        default:
            // Oväntad event-typ
    }

    // Return a 200 response to acknowledge receipt of the event
    res.send();
});

module.exports = router;