const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const User = require('../models/User');
const { purchaseStars, initiateCashOut } = require('../services/economyService');

// The star-purchase and cash-out flows are not production-ready: the Stripe
// charge and Tremendous gift-card calls in economyService are commented-out
// placeholders. Gate both routes behind an explicit feature flag so we don't
// accidentally expose free stars / fake cash-outs in production.
const economyEnabled = () => process.env.ECONOMY_ENABLED === 'true';

const requireEconomy = (req, res, next) => {
  if (!economyEnabled()) {
    return res.status(503).json({
      msg: 'Star purchases and cash-outs are temporarily disabled.',
    });
  }
  next();
};

/**
 * @route   POST api/economy/purchase
 * @desc    Purchase Gold and/or Silver stars
 * @access  Private
 */
router.post('/purchase', authMiddleware, requireEconomy, async (req, res) => {
  const { goldAmount, silverAmount } = req.body;
  const userId = req.user.id;

  if ((!goldAmount && !silverAmount) || (goldAmount < 0) || (silverAmount < 0)) {
    return res.status(400).json({ msg: 'Please provide a valid amount of stars to purchase.' });
  }

  try {
    const success = await purchaseStars(userId, goldAmount || 0, silverAmount || 0);
    if (success) {
      // The user object is not returned from the service, so we fetch it again
      const user = await User.findById(userId).select('-password');
      return res.json({ msg: 'Purchase successful.', user });
    } else {
      return res.status(500).json({ msg: 'Purchase failed. Please check server logs.' });
    }
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

/**
 * @route   POST api/economy/cash-out
 * @desc    Initiate a cash-out of Gold Stars for a gift card
 * @access  Private
 */
router.post('/cash-out', authMiddleware, requireEconomy, async (req, res) => {
  const { euroAmount } = req.body;
  const userId = req.user.id;

  if (!euroAmount || euroAmount < 5 || euroAmount > 100) {
    return res.status(400).json({ msg: 'Cash-out amount must be between 5 and 100 EUR.' });
  }

  try {
    const success = await initiateCashOut(userId, euroAmount);
    if (success) {
      const user = await User.findById(userId).select('-password');
      return res.json({ msg: 'Cash-out process initiated successfully.', user });
    } else {
      return res.status(500).json({ msg: 'Cash-out failed. You may have insufficient funds or an error occurred.' });
    }
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
