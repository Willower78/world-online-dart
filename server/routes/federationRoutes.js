const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const User = require('../models/User');
const League = require('../models/League');
const Tournament = require('../models/Tournament');
const bcrypt = require('bcryptjs');

// Middleware to ensure user is a federation
const isFederation = async (req, res, next) => {
    try {
        const user = await User.findById(req.user.id);
        if (user.role !== 'federation' && user.role !== 'admin') {
            return res.status(403).json({ msg: 'Access denied. Federation or Admin only.' });
        }
        next();
    } catch (err) {
        res.status(500).send('Server Error');
    }
};

// @route   POST /api/federation/players/register
// @desc    Register a new player managed by the federation
// @access  Federation
router.post('/players/register', [auth, isFederation], async (req, res) => {
    const { username, email, password, location, birthdate } = req.body;
    try {
        let user = await User.findOne({ email });
        if (user) {
            return res.status(400).json({ msg: 'User already exists' });
        }

        user = new User({
            username,
            email,
            password, // Needs hashing
            location,
            birthdate,
            role: 'player'
        });

        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(password, salt);

        await user.save();
        res.json({ msg: 'Player registered successfully', player: { id: user.id, username: user.username } });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   GET /api/federation/players
// @desc    Get all players in the federation's region
// @access  Federation
router.get('/players', [auth, isFederation], async (req, res) => {
    try {
        const federationUser = await User.findById(req.user.id);
        if (!federationUser.federationRegion) {
            return res.status(400).json({ msg: 'Your federation account has no region assigned.' });
        }

        const regionRegex = new RegExp(federationUser.federationRegion, 'i');

        // Find players whose location contains the region string
        const players = await User.find({ 
            role: 'player',
            location: { $regex: regionRegex }
        }).select('-password');
        
        res.json(players);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   POST /api/federation/leagues
// @desc    Create a league
// @access  Federation
router.post('/leagues', [auth, isFederation], async (req, res) => {
    const { name, region, entryFeeEuros, perGameFeeSilverStars, maxPlayersPerDivision } = req.body;
    try {
        const league = new League({
            name,
            region,
            entryFeeEuros,
            perGameFeeSilverStars,
            maxPlayersPerDivision,
            createdBy: req.user.id,
            status: 'Recruiting',
            divisions: [{ divisionNumber: 1, players: [], standings: [], schedule: [] }]
        });
        await league.save();
        res.json(league);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   GET /api/federation/leagues
// @desc    Get leagues created by this federation
// @access  Federation
router.get('/leagues', [auth, isFederation], async (req, res) => {
    try {
        const leagues = await League.find({ createdBy: req.user.id });
        res.json(leagues);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   POST /api/federation/tournaments
// @desc    Create a tournament
// @access  Federation
router.post('/tournaments', [auth, isFederation], async (req, res) => {
    const { name, gameType, category, entryFeeGoldStars, entryFeeSilverStars, allowedClassifications, prizeDistribution, maxParticipants } = req.body;
    try {
        const tournament = new Tournament({
            name,
            gameType,
            category,
            entryFeeGoldStars,
            entryFeeSilverStars,
            allowedClassifications,
            prizeDistribution,
            maxParticipants,
            owner: req.user.id,
            status: 'pending'
        });
        await tournament.save();
        res.json(tournament);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

module.exports = router;
