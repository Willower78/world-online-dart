const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const User = require('../models/User');
const Tournament = require('../models/Tournament');
const mongoose = require('mongoose');
const tournamentService = require('../services/tournamentService');

// @route   POST /api/tournaments
// @desc    Create a new tournament
// @access  Admin
router.post('/', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user.isAdmin) {
            return res.status(403).json({ msg: 'Access denied. Admins only.' });
        }

        const { name, gameType, maxParticipants } = req.body;
        if (!name || !gameType) {
            return res.status(400).json({ msg: 'Please provide a name and game type.' });
        }

        const newTournament = new Tournament({
            name,
            gameType,
            maxParticipants: maxParticipants || 8,
            owner: req.user.id,
            category: 'Amateur',
            prizeDistribution: {
                first: 70,
                second: 30,
                house: 0
            }
        });

        const tournament = await newTournament.save();
        res.status(201).json(tournament);

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   GET /api/tournaments
// @desc    Get all available tournaments
// @access  Private
router.get('/', auth, async (req, res) => {
    try {
        // Robustly find and populate tournaments
        const tournaments = await Tournament.find({ status: { $ne: 'completed' } }).sort({ createdAt: -1 }).lean(); // Use .lean() for performance
        
        const populatedTournaments = await Promise.all(tournaments.map(async t => {
            try {
                // Manually populate participants
                const populatedParticipants = await User.find({ '_id': { $in: t.participants } }).select('username');
                t.participants = populatedParticipants;
                return t;
            } catch (e) {
                console.error(`Failed to populate participants for tournament ${t._id}. It might have corrupt participant data.`, e);
                // Return the tournament with an empty participants array to prevent crashes
                t.participants = [];
                return t;
            }
        }));

        res.json(populatedTournaments);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   POST /api/tournaments/:id/join
// @desc    Join a tournament
// @access  Private
router.post('/:id/join', auth, async (req, res) => {
    try {
        const tournament = await tournamentService.joinTournament(req.user.id, req.params.id);
        
        // Note: The auto-start logic is now implicitly handled by the scheduler or manual start.
        // This endpoint just handles joining.

        const populatedTournament = await tournament.populate('participants', 'username');
        res.json({ msg: 'Successfully joined tournament!', tournament: populatedTournament });

    } catch (err) {
        // The service will throw errors with specific messages
        console.error(`Error joining tournament: ${err.message}`);
        res.status(400).json({ msg: err.message });
    }
});

// @route   POST /api/tournaments/:id/start
// @desc    Manually start a tournament (owner or admin only)
// @access  Private
router.post('/:id/start', auth, async (req, res) => {
    try {
        const tournament = await Tournament.findById(req.params.id);
        if (!tournament) {
            return res.status(404).json({ msg: 'Tournament not found.' });
        }

        const user = await User.findById(req.user.id);
        if (!tournament.owner || (tournament.owner.toString() !== req.user.id && !user.isAdmin)) {
            return res.status(403).json({ msg: 'Access denied. Only the tournament owner or an admin can start it.' });
        }

        if (tournament.status !== 'pending') {
            return res.status(400).json({ msg: 'Tournament has already started or is completed.' });
        }

        if (tournament.participants.length < 2) {
            return res.status(400).json({ msg: 'Not enough players to start the tournament.' });
        }

        tournament.status = 'active';

        // --- Robust Bracket Generation ---
        const participants = [...tournament.participants];
        let shuffled = participants.sort(() => 0.5 - Math.random());
        
        const numParticipants = shuffled.length;
        const nextPowerOfTwo = Math.pow(2, Math.ceil(Math.log2(numParticipants)));
        const byes = nextPowerOfTwo - numParticipants;

        // Add null placeholders for byes
        for (let i = 0; i < byes; i++) {
            shuffled.push(null);
        }

        const firstRound = [];
        for (let i = 0; i < shuffled.length; i += 2) {
            const player1 = shuffled[i];
            const player2 = shuffled[i + 1];
            
            let winner = null;
            if (player1 === null) winner = player2;
            if (player2 === null) winner = player1;

            firstRound.push({
                matchId: new mongoose.Types.ObjectId(),
                players: [player1, player2].filter(p => p !== null),
                winner: winner,
            });
        }
        
        tournament.bracket = { rounds: [firstRound] };

        // Notify clients
        const io = req.app.get('socketio');
        const onlineUsers = req.app.get('onlineUsers');
        tournament.participants.forEach(participantId => {
            if (participantId) {
                const socketId = onlineUsers[participantId.toString()];
                if (socketId) io.to(socketId).emit('tournament_started', tournament);
            }
        });
        io.emit('tournaments_updated');

        await tournament.save();
        
        // We need to manually populate the response to send it back
        const populatedTournament = await Tournament.findById(tournament._id)
            .populate('participants', 'username profilePicture')
            .populate('winner', 'username');
        
        if (populatedTournament.bracket && populatedTournament.bracket.rounds) {
            for (const round of populatedTournament.bracket.rounds) {
                for (const match of round) {
                    await User.populate(match, { path: 'players', select: 'username' });
                }
            }
        }

        res.json(populatedTournament);

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   GET /api/tournaments/:id
// @desc    Get a single tournament by ID
// @access  Private
router.get('/:id', auth, async (req, res) => {
    try {
        const tournament = await Tournament.findById(req.params.id)
            .populate('participants', 'username profilePicture') // This works fine
            .populate('winner', 'username'); // This also works fine

        if (!tournament) {
            return res.status(404).json({ msg: 'Tournament not found.' });
        }

        // --- NYTT: Manuell population av bracket ---
        if (tournament.bracket && tournament.bracket.rounds) {
            for (const round of tournament.bracket.rounds) {
                for (const match of round) {
                    await User.populate(match, { path: 'players', select: 'username' });
                }
            }
        }

        res.json(tournament);
    } catch (err) {
        console.error(err.message);
        if (err.kind === 'ObjectId') {
            return res.status(404).json({ msg: 'Tournament not found.' });
        }
        res.status(500).send('Server Error');
    }
});

const { reportTournamentMatchWinner } = require('../services/tournamentService');

// @route   POST /api/tournaments/:id/matches/:matchId/report
// @desc    Report the winner of a tournament match
// @access  Private (Player in the match)
router.post('/:id/matches/:matchId/report', auth, async (req, res) => {
    const { winnerId } = req.body;
    const { id: tournamentId, matchId } = req.params;

    try {
        const io = req.app.get('socketio');
        const onlineUsers = req.app.get('onlineUsers');

        const updatedTournament = await reportTournamentMatchWinner({
            tournamentId,
            matchId,
            winnerId,
            io,
            onlineUsers
        });

        res.json(updatedTournament);

    } catch (err) {
        console.error('Error reporting tournament match:', err);
        // The service throws errors with specific messages
        if (err.message.includes('not found') || err.message.includes('not active')) {
            return res.status(404).json({ msg: err.message });
        }
        res.status(500).send('Server Error');
    }
});

// @route   GET /api/tournaments/admin/all
// @desc    Get all tournaments for admin view
// @access  Admin
router.get('/admin/all', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user.isAdmin) {
            return res.status(403).json({ msg: 'Access denied. Admins only.' });
        }
        // Hämta alla turneringar, sorterade med den nyaste först
        const tournaments = await Tournament.find().sort({ createdAt: -1 });
        res.json(tournaments);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   DELETE /api/tournaments/:id
// @desc    Delete a tournament
// @access  Admin
router.delete('/:id', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user.isAdmin) {
            return res.status(403).json({ msg: 'Access denied. Admins only.' });
        }

        const tournament = await Tournament.findById(req.params.id);
        if (!tournament) {
            return res.status(404).json({ msg: 'Tournament not found.' });
        }

        await tournament.deleteOne();

        res.json({ msg: 'Tournament removed' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   POST /api/tournaments/admin/:id/fill
// @desc    Fill a pending tournament with bots to start it
// @access  Admin
router.post('/admin/:id/fill', auth, async (req, res) => {
    try {
        const adminUser = await User.findById(req.user.id);
        if (!adminUser.isAdmin) {
            return res.status(403).json({ msg: 'Access denied. Admins only.' });
        }

        const tournament = await Tournament.findById(req.params.id);
        if (!tournament) return res.status(404).json({ msg: 'Tournament not found.' });
        if (tournament.status !== 'pending') return res.status(400).json({ msg: 'Tournament is not pending.' });

        const neededPlayers = tournament.maxParticipants - tournament.participants.length;
        if (neededPlayers <= 0) return res.status(400).json({ msg: 'Tournament is already full.' });

        // Hitta användare som kan agera bottar. Exkludera den inloggade adminen, bannade och redan anmälda spelare.
        const existingParticipantsAndAdmin = [...tournament.participants, req.user.id];

        const bots = await User.find({
            _id: { $nin: existingParticipantsAndAdmin },
            subscriptionStatus: 'active' // Se till att bottarna har premium
        }).limit(neededPlayers);

        if (bots.length < neededPlayers) {
            return res.status(400).json({ msg: `Not enough available users in DB to fill. Found ${bots.length}, need ${neededPlayers}.` });
        }

        bots.forEach(bot => tournament.participants.push(bot._id));

        // --- KÖR SAMMA AUTO-START LOGIK SOM I /join ---
        tournament.status = 'active';

        const shuffled = [...tournament.participants].sort(() => 0.5 - Math.random());
        const firstRound = [];
        for (let i = 0; i < shuffled.length; i += 2) {
            firstRound.push({
                matchId: new mongoose.Types.ObjectId(),
                players: [shuffled[i], shuffled[i + 1]],
                winner: null,
            });
        }
        tournament.bracket = { rounds: [firstRound] };

        const io = req.app.get('socketio');
        const onlineUsers = req.app.get('onlineUsers');
        tournament.participants.forEach(participantId => {
            const socketId = onlineUsers[participantId.toString()];
            if (socketId) io.to(socketId).emit('tournament_started', tournament);
        });

        io.emit('tournaments_updated');

        await tournament.save();
        res.json({ msg: `Tournament filled with ${bots.length} bots and started.` });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

module.exports = router;