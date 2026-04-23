const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const User = require('../models/User');
const Match = require('../models/Match');
const Tournament = require('../models/Tournament');
const Reward = require('../models/Reward');
const RewardService = require('../services/rewardService');
const leagueService = require('../services/leagueService');
const League = require('../models/League');

/**
 * Admin Routes
 * All routes require authentication and admin privileges
 */

// Middleware to check if user is admin
const requireAdmin = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user || !user.isAdmin) {
      return res.status(403).json({ msg: 'Access denied: Admin privileges required' });
    }
    next();
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
};

// @route   GET /api/admin/stats
// @desc    Get platform statistics
// @access  Admin
router.get('/stats', [auth, requireAdmin], async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalMatches = await Match.countDocuments();
    const totalTournaments = await Tournament.countDocuments();
    const totalRewards = await Reward.countDocuments();
    const activeUsers = await User.countDocuments({ 
      lastActive: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } 
    });

    const rewardStats = await Reward.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $count: {} },
          totalAmount: { $sum: '$amount' }
        }
      }
    ]);

    res.json({
      users: {
        total: totalUsers,
        active: activeUsers,
      },
      matches: {
        total: totalMatches,
      },
      tournaments: {
        total: totalTournaments,
      },
      rewards: {
        total: totalRewards,
        breakdown: rewardStats,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// @route   POST /api/admin/upgrade-all-users
// @desc    Upgrade all users to premium
// @access  Admin
router.post('/upgrade-all-users', [auth, requireAdmin], async (req, res) => {
  try {
    const result = await User.updateMany(
      {},
      { $set: { subscriptionStatus: 'active' } }
    );
    res.json({ msg: `${result.modifiedCount} users have been upgraded to Premium.` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error during mass upgrade.' });
  }
});

// @route   GET /api/admin/users
// @desc    Get all users with pagination
// @access  Admin
router.get('/users', [auth, requireAdmin], async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    const users = await User.find()
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await User.countDocuments();

    res.json({
      users,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// @route   PUT /api/admin/users/:userId/ban
// @desc    Ban/unban a user
// @access  Admin
router.put('/users/:userId/ban', [auth, requireAdmin], async (req, res) => {
  try {
    const { isBanned, reason } = req.body;
    
    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    user.isBanned = isBanned;
    if (isBanned && reason) {
      user.banReason = reason;
    }

    await user.save();

    res.json({
      msg: isBanned ? 'User banned successfully' : 'User unbanned successfully',
      user: {
        _id: user._id,
        username: user.username,
        isBanned: user.isBanned,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// @route   POST /api/admin/rewards
// @desc    Create reward for user (admin grant)
// @access  Admin
router.post('/rewards', [auth, requireAdmin], async (req, res) => {
  try {
    const { userId, amount, description } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    const reward = await RewardService.createReward({
      userId,
      type: 'admin_grant',
      amount,
      description: description || 'Admin granted reward',
    });

    res.json({
      msg: 'Reward created successfully',
      reward,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// @route   GET /api/admin/rewards
// @desc    Get all rewards
// @access  Admin
router.get('/rewards', [auth, requireAdmin], async (req, res) => {
  try {
    const status = req.query.status;
    const filters = status ? { status } : {};

    const rewards = await RewardService.getAllRewards(filters);

    res.json({ rewards });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// @route   DELETE /api/admin/rewards/:rewardId
// @desc    Cancel a reward
// @access  Admin
router.delete('/rewards/:rewardId', [auth, requireAdmin], async (req, res) => {
  try {
    const reward = await RewardService.cancelReward(req.params.rewardId);
    res.json({
      msg: 'Reward cancelled successfully',
      reward,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: err.message || 'Server error' });
  }
});

// @route   POST /api/admin/leagues
// @desc    Create a new league
// @access  Admin
router.post('/leagues', [auth, requireAdmin], async (req, res) => {
    try {
        const league = await leagueService.createLeague(req.user.id, req.body);
        if (league) {
            res.status(201).json({ msg: 'League created successfully', league });
        } else {
            res.status(400).json({ msg: 'Failed to create league.' });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: 'Server error' });
    }
});

// @route   POST /api/admin/leagues/:id/generate-schedule
// @desc    Generate the schedule for a league
// @access  Admin
router.post('/leagues/:id/generate-schedule', [auth, requireAdmin], async (req, res) => {
    try {
        await leagueService.generateSchedules(req.params.id);
        res.json({ msg: 'League schedule generation initiated.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: 'Server error' });
    }
});

// @route   GET /api/admin/matches
// @desc    Get all matches
// @access  Admin
router.get('/matches', [auth, requireAdmin], async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    const matches = await Match.find()
      .populate('winner', 'username email')
      .populate('loser', 'username email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Match.countDocuments();

    res.json({
      matches,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// @route   DELETE /api/admin/matches/:matchId
// @desc    Delete a match
// @access  Admin
router.delete('/matches/:matchId', [auth, requireAdmin], async (req, res) => {
  try {
    const match = await Match.findByIdAndDelete(req.params.matchId);
    if (!match) {
      return res.status(404).json({ msg: 'Match not found' });
    }
    res.json({ msg: 'Match deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// @route   POST /api/admin/seed-leagues
// @desc    Seed the 5 default leagues
// @access  Admin
router.post('/seed-leagues', [auth, requireAdmin], async (req, res) => {
    try {
        const leaguesToSeed = [
            { name: 'WOD Scandinavian League', region: 'Scandinavian', themeColor: '#006aa7', entryFeeEuros: 10, divisions: [] },
            { name: 'WOD UK League', region: 'British', themeColor: '#c8102e', entryFeeEuros: 10, divisions: [] },
            { name: 'WOD Dutch League', region: 'Dutch', themeColor: '#f37820', entryFeeEuros: 10, divisions: [] },
            { name: 'WOD German League', region: 'German', themeColor: '#000000', entryFeeEuros: 10, divisions: [] },
            { name: 'WOD USA League', region: 'American', themeColor: '#3c3b6e', entryFeeEuros: 10, divisions: [] }
        ];

        let createdCount = 0;
        for (const leagueData of leaguesToSeed) {
            const existing = await League.findOne({ name: leagueData.name });
            if (!existing) {
                // Ensure creator is the admin requesting
                await League.create({ ...leagueData, createdBy: req.user.id });
                createdCount++;
            } else {
                // Optional: Update color if missing
                if (!existing.themeColor) {
                    existing.themeColor = leagueData.themeColor;
                    await existing.save();
                }
            }
        }
        
        res.json({ msg: `Seeding complete. Created ${createdCount} new leagues.` });
    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: 'Server error during seeding.' });
    }
});

module.exports = router;
