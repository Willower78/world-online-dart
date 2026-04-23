const User = require('../models/User');
// Assume Stripe and Tremendous SDKs are installed and configured elsewhere
// const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
// const tremendous = require('tremendous')(process.env.TREMENDOUS_API_KEY);

/**
 * Charges a user via Stripe and adds the corresponding stars to their account.
 * @param {string} userId - The ID of the user making the purchase.
 * @param {number} goldAmount - The amount of Gold Stars to purchase.
 * @param {number} silverAmount - The amount of Silver Stars to purchase.
 * @returns {Promise<boolean>} - True if the purchase was successful.
 */
async function purchaseStars(userId, goldAmount, silverAmount) {
  // 1. Calculate total cost (1 Gold = 1 EUR, 1 Silver = 0.5 EUR)
  const totalCost = (goldAmount * 1) + (silverAmount * 0.5);
  if (totalCost <= 0) {
    console.error('Total cost must be positive.');
    return false;
  }

  const user = await User.findById(userId);
  if (!user || !user.stripeCustomerId) {
    console.error('User not found or has no Stripe customer ID.');
    return false;
  }

  try {
    // 2. TODO: Create a Stripe charge. This is a placeholder.
    // In a real implementation, you would create a PaymentIntent and confirm it on the client.
    // const charge = await stripe.charges.create({
    //   amount: totalCost * 100, // Stripe expects cents
    //   currency: 'eur',
    //   customer: user.stripeCustomerId,
    //   description: `Purchase of ${goldAmount} Gold and ${silverAmount} Silver stars.`,
    // });

    // For now, we'll simulate a successful charge.
    console.log(`Simulating successful charge of €${totalCost} for user ${userId}.`);

    // 3. Add stars to user's account
    user.goldStars += goldAmount;
    user.silverStars += silverAmount;
    await user.save();

    return true;
  } catch (error) {
    console.error('Error purchasing stars:', error);
    return false;
  }
}

/**
 * Atomically deducts stars from a user's balance.
 * @param {string} userId - The ID of the user spending the stars.
 * @param {number} goldAmount - The amount of Gold Stars to spend.
 * @param {number} silverAmount - The amount of Silver Stars to spend.
 * @returns {Promise<boolean>} - True if stars were spent successfully.
 */
async function spendStars(userId, goldAmount = 0, silverAmount = 0) {
  const user = await User.findById(userId);

  if (!user) {
    console.error('User not found.');
    return false;
  }

  if (user.goldStars < goldAmount || user.silverStars < silverAmount) {
    console.log('User has insufficient stars for this transaction.');
    return false;
  }

  try {
    // Use findByIdAndUpdate for an atomic operation
    const result = await User.findByIdAndUpdate(userId, {
      $inc: {
        goldStars: -goldAmount,
        silverStars: -silverAmount
      }
    }, { new: true });

    // Check if the update resulted in negative stars (race condition check)
    if (result.goldStars < 0 || result.silverStars < 0) {
        // Revert the transaction if it went negative
        await User.findByIdAndUpdate(userId, { $inc: { goldStars: goldAmount, silverStars: silverAmount } });
        console.error('Transaction failed due to insufficient funds after check.');
        return false;
    }

    return true;
  } catch (error) {
    console.error('Error spending stars:', error);
    return false;
  }
}

/**
 * Initiates a cash-out of Gold Stars for a Tremendous gift card.
 * @param {string} userId - The ID of the user cashing out.
 * @param {number} euroAmount - The amount in EUR to cash out. Must be between 5 and 100.
 * @returns {Promise<boolean>} - True if the cash-out was initiated successfully.
 */
async function initiateCashOut(userId, euroAmount) {
  if (euroAmount < 5 || euroAmount > 100) {
    console.error('Cash-out amount must be between 5 and 100 EUR.');
    return false;
  }
  
  const goldStarsToCashOut = euroAmount; // 1 Gold Star = 1 EUR

  const user = await User.findById(userId);
  if (!user) {
    console.error('User not found.');
    return false;
  }

  if (user.goldStars < goldStarsToCashOut) {
    console.log('User has insufficient Gold Stars to cash out.');
    return false;
  }

  try {
    // 1. Deduct stars from user's account first.
    const starsSpent = await spendStars(userId, goldStarsToCashOut, 0);
    if (!starsSpent) {
      throw new Error('Failed to deduct stars for cash-out.');
    }

    // 2. TODO: Call Tremendous API to issue the gift card.
    // This is a placeholder for the actual API call.
    // const order = await tremendous.orders.create({
    //   external_id: `wod-cashout-${userId}-${Date.now()}`,
    //   payment: { funding_source_id: process.env.TREMENDOUS_FUNDING_SOURCE_ID },
    //   reward: {
    //     value: {
    //       denomination: euroAmount,
    //       currency: 'EUR',
    //     },
    //     recipient: {
    //       name: user.username,
    //       email: user.email,
    //     },
    //     delivery: {
    //       method: 'EMAIL',
    //     },
    //   },
    // });
    
    console.log(`Simulating successful cash-out of ${goldStarsToCashOut} Gold Stars (€${euroAmount}) for user ${userId}.`);

    // 3. TODO: Need to store the Tremendous order ID somewhere to track status.

    return true;
  } catch (error) {
    console.error('Error initiating cash-out:', error);
    // TODO: Implement logic to refund stars if the Tremendous API call fails.
    return false;
  }
}

/**
 * Atomically adds stars to a user's balance, e.g. for winning a prize.
 * @param {string} userId - The ID of the user to credit.
 * @param {number} goldAmount - The amount of Gold Stars to add.
 * @param {number} silverAmount - The amount of Silver Stars to add.
 * @returns {Promise<boolean>} - True if stars were credited successfully.
 */
async function creditStars(userId, goldAmount = 0, silverAmount = 0) {
    if (!userId || (goldAmount === 0 && silverAmount === 0)) {
        return false;
    }
    try {
        const result = await User.findByIdAndUpdate(userId, {
            $inc: {
                goldStars: goldAmount,
                silverStars: silverAmount
            }
        }, { new: true });

        if (!result) {
            console.error(`Credit failed: User not found with ID ${userId}.`);
            return false;
        }
        return true;
    } catch (error) {
        console.error('Error crediting stars:', error);
        return false;
    }
}

module.exports = {
  purchaseStars,
  spendStars,
  initiateCashOut,
  creditStars,
};
