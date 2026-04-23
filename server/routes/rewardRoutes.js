const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const RewardService = require('../services/rewardService');

/**
 * Reward Routes
 * User-facing reward endpoints
 */

// @route   GET /api/rewards
// @desc    Get user's rewards
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const status = req.query.status || 'active';
    const rewards = await RewardService.getUserRewards(req.user.id, status);
    const balance = await RewardService.getUserBalance(req.user.id);

    res.json({
      rewards,
      balance,
      currency: process.env.REWARD_CURRENCY || 'USD',
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// @route   GET /api/rewards/balance
// @desc    Get user's reward balance
// @access  Private
router.get('/balance', auth, async (req, res) => {
  try {
    const balance = await RewardService.getUserBalance(req.user.id);
    res.json({
      balance,
      currency: process.env.REWARD_CURRENCY || 'USD',
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// @route   POST /api/rewards/:rewardId/redeem
// @desc    Redeem a reward
// @access  Private
router.post('/:rewardId/redeem', auth, async (req, res) => {
  try {
    const reward = await RewardService.redeemReward(req.user.id, req.params.rewardId);
    res.json({
      msg: 'Reward redeemed successfully',
      reward,
    });
  } catch (err) {
    console.error(err);
    res.status(400).json({ msg: err.message || 'Server error' });
  }
});

// @route   GET /api/rewards/:rewardId
// @desc    Get specific reward details
// @access  Private
router.get('/:rewardId', auth, async (req, res) => {
  try {
    const Reward = require('../models/Reward');
    const reward = await Reward.findOne({
      _id: req.params.rewardId,
      userId: req.user.id,
    });

    if (!reward) {
      return res.status(404).json({ msg: 'Reward not found' });
    }

    res.json({ reward });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
});

module.exports = router;
