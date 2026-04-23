const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const StatsService = require('../services/statsService');

/**
 * Statistics Routes
 */

// @route   GET /api/stats/global
// @desc    Get global live and total matches count
// @access  Public
router.get('/global', async (req, res) => {
  try {
    const onlineUsers = req.app.get('onlineUsers') || {};
    const stats = await StatsService.getGlobalStats(onlineUsers);
    res.json(stats);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// @route   GET /api/stats/user/:userId
// @desc    Get user statistics
// @access  Public
router.get('/user/:userId', async (req, res) => {
  try {
    const stats = await StatsService.getUserStats(req.params.userId);
    res.json(stats);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// @route   GET /api/stats/me
// @desc    Get current user's statistics
// @access  Private
router.get('/me', auth, async (req, res) => {
  try {
    const stats = await StatsService.getUserStats(req.user.id);
    res.json(stats);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// @route   GET /api/stats/leaderboard
// @desc    Get leaderboard
// @access  Public
router.get('/leaderboard', async (req, res) => {
  try {
    const gameType = req.query.gameType || null;
    const limit = parseInt(req.query.limit) || 50;

    const leaderboard = await StatsService.getLeaderboard(gameType, limit);
    res.json({ leaderboard });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// @route   GET /api/stats/matches/:userId
// @desc    Get user's match history
// @access  Public
router.get('/matches/:userId', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const matches = await StatsService.getMatchHistory(req.params.userId, limit);
    res.json({ matches });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
});

module.exports = router;
