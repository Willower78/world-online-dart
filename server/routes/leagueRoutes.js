const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const League = require('../models/League');
const { joinLeague, reportMatchResult } = require('../services/leagueService');

/**
 * @route   GET api/leagues
 * @desc    Get all active and recruiting leagues
 * @access  Public
 */
router.get('/', async (req, res) => {
  try {
    const leagues = await League.find({ status: { $in: ['Recruiting', 'InProgress'] } })
      .select('-divisions.schedule') // Exclude large schedule from list view
      .populate('createdBy', 'username');
    res.json(leagues);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

/**
 * @route   GET api/leagues/:id
 * @desc    Get a single league's details, including divisions and standings
 * @access  Public
 */
router.get('/:id', async (req, res) => {
    try {
      const league = await League.findById(req.params.id)
        .populate('divisions.players', 'username classification averageScore')
        .populate('divisions.standings.player', 'username');
      if (!league) {
        return res.status(404).json({ msg: 'League not found' });
      }
      res.json(league);
    } catch (err) {
      console.error(err.message);
      res.status(500).send('Server Error');
    }
});

/**
 * @route   POST api/leagues/:id/join
 * @desc    Join a league
 * @access  Private
 */
router.post('/:id/join', authMiddleware, async (req, res) => {
    const userId = req.user.id;
    const leagueId = req.params.id;

    try {
        const success = await joinLeague(userId, leagueId);
        if (success) {
            return res.json({ msg: 'Successfully joined league.' });
        } else {
            return res.status(400).json({ msg: 'Failed to join league. Please check requirements or try again later.' });
        }
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

/**
 * @route   POST api/leagues/:leagueId/matches/:matchId/report
 * @desc    Report the result of a league match
 * @access  Private
 */
router.post('/:leagueId/matches/:matchId/report', authMiddleware, async (req, res) => {
    const { winnerId } = req.body;
    const reportingUserId = req.user.id;
    const { leagueId, matchId } = req.params;

    if (!winnerId) {
        return res.status(400).json({ msg: 'Winner ID is required.' });
    }

    try {
        const success = await reportMatchResult(reportingUserId, matchId, winnerId);
        if (success) {
            return res.json({ msg: 'Match result reported successfully.' });
        } else {
            return res.status(400).json({ msg: 'Failed to report match result.' });
        }
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});


module.exports = router;
