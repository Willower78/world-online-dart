const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const User = require('../models/User');
const Tournament = require('../models/Tournament');
const mongoose = require('mongoose');

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
            owner: req.user.id, // Sätt ägaren
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
// @access  Premium Users
router.post('/:id/join', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (user.subscriptionStatus !== 'active') {
            return res.status(403).json({ msg: 'Access denied. Premium members only.' });
        }

        const tournament = await Tournament.findById(req.params.id);
        if (!tournament) {
            return res.status(404).json({ msg: 'Tournament not found.' });
        }
        if (tournament.status !== 'pending') {
            return res.status(400).json({ msg: 'This tournament is not open for registration.' });
        }
        if (tournament.participants.length >= tournament.maxParticipants) {
            return res.status(400).json({ msg: 'This tournament is full.' });
        }
        if (tournament.participants.includes(req.user.id)) {
            return res.status(400).json({ msg: 'You are already in this tournament.' });
        }

        tournament.participants.push(req.user.id);

        // --- AUTO-START & AUTO-CREATE LOGIC ---
        if (tournament.participants.length >= tournament.maxParticipants) {
            tournament.status = 'active';

            // 1. Generate a robust bracket with bye handling
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
                // If a player is null, their opponent gets a bye and wins automatically
                if (player1 === null && player2 !== null) winner = player2;
                if (player2 === null && player1 !== null) winner = player1;
    
                firstRound.push({
                    matchId: new mongoose.Types.ObjectId(),
                    // Filter out nulls so the players array is clean
                    players: [player1, player2].filter(p => p !== null),
                    winner: winner, // Assign winner immediately if there was a bye
                });
            }
            
            tournament.bracket = { rounds: [firstRound] };

            // 2. Auto-create a new, identical tournament
            let newTournamentName;
            const nameMatch = tournament.name.match(/^(.*?)(\s*#?\s*)(\d+)$/);
            if (nameMatch) {
                // If name ends with a number (e.g., "Weekly #8"), increment it
                const baseName = nameMatch[1];
                const separator = nameMatch[2];
                const newNumber = parseInt(nameMatch[3], 10) + 1;
                newTournamentName = `${baseName}${separator}${newNumber}`;
            } else {
                // Otherwise, just add " #2"
                newTournamentName = `${tournament.name} #2`;
            }

            const newTournament = new Tournament({
                name: newTournamentName,
                gameType: tournament.gameType,
                maxParticipants: tournament.maxParticipants,
            });
            await newTournament.save();

            // 3. Notify clients
            const io = req.app.get('socketio');
            const onlineUsers = req.app.get('onlineUsers');
            tournament.participants.forEach(participantId => {
                const socketId = onlineUsers[participantId.toString()];
                if (socketId) io.to(socketId).emit('tournament_started', tournament);
            });
            io.emit('tournaments_updated'); // Tell everyone to refresh their tournament list
        }

        await tournament.save();
        res.json({ msg: 'Successfully joined tournament!', tournament: await tournament.populate('participants', 'username') });

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
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

// @route   POST /api/tournaments/:id/matches/:matchId/report
// @desc    Report the winner of a tournament match
// @access  Private (Player in the match)
router.post('/:id/matches/:matchId/report', auth, async (req, res) => {
    const { winnerId } = req.body;

    try {
        const io = req.app.get('socketio');
        const tournament = await Tournament.findById(req.params.id);

        if (!tournament) return res.status(404).json({ msg: 'Tournament not found.' });
        if (tournament.status !== 'active') return res.status(400).json({ msg: 'Tournament is not active.' });

        let matchFound = null;
        let currentRoundIndex = -1;
        let matchInRoundIndex = -1;

        // Find the match and its position
        for (let i = 0; i < tournament.bracket.rounds.length; i++) {
            const round = tournament.bracket.rounds[i];
            const matchIndex = round.findIndex(m => m.matchId.toString() === req.params.matchId);
            if (matchIndex !== -1) {
                matchFound = round[matchIndex];
                currentRoundIndex = i;
                matchInRoundIndex = matchIndex;
                break;
            }
        }

        if (!matchFound) {
            return res.status(404).json({ msg: 'Match not found in this tournament.' });
        }

        // Set the winner for the current match
        matchFound.winner = winnerId;

        // Check if this was the final match
        const isFinalMatch = tournament.bracket.rounds[currentRoundIndex].length === 1 && tournament.bracket.rounds.length > 0;

        if (isFinalMatch) {
            // This is the final, complete the tournament
            tournament.status = 'completed';
            tournament.winner = winnerId;
        } else {
            // Not the final, advance the winner to the next round
            const nextRoundIndex = currentRoundIndex + 1;
            const matchIndexInNextRound = Math.floor(matchInRoundIndex / 2);

            // Ensure the next round exists
            if (!tournament.bracket.rounds[nextRoundIndex]) {
                const numMatchesInNextRound = Math.ceil(tournament.bracket.rounds[currentRoundIndex].length / 2);
                if (numMatchesInNextRound > 0) {
                    tournament.bracket.rounds[nextRoundIndex] = Array.from({ length: numMatchesInNextRound }, () => ({
                        matchId: new mongoose.Types.ObjectId(),
                        players: [],
                        winner: null
                    }));
                }
            }

            // Move the winner to the next match slot, if the next round exists
            if (tournament.bracket.rounds[nextRoundIndex] && tournament.bracket.rounds[nextRoundIndex][matchIndexInNextRound]) {
                const nextMatch = tournament.bracket.rounds[nextRoundIndex][matchIndexInNextRound];
                nextMatch.players.push(winnerId);

                // If the next match is now full, notify the players
                if (nextMatch.players.length === 2) {
                    const onlineUsers = req.app.get('onlineUsers');
                    const player1Id = nextMatch.players[0].toString();
                    const player2Id = nextMatch.players[1].toString();
                    const player1SocketId = onlineUsers[player1Id];
                    const player2SocketId = onlineUsers[player2Id];

                    const notificationPayload = {
                        tournamentId: tournament._id,
                        tournamentName: tournament.name,
                    };

                    if (player1SocketId) io.to(player1SocketId).emit('tournament_match_ready', notificationPayload);
                    if (player2SocketId) io.to(player2SocketId).emit('tournament_match_ready', notificationPayload);
                }
            }
        }

        // Mark the bracket as modified for Mongoose to save it
        tournament.markModified('bracket');

        await tournament.save();

        // Populate the tournament data before sending it back
        const populatedTournament = await Tournament.findById(tournament._id)
            .populate('participants', 'username profilePicture')
            .populate('winner', 'username')
            .lean(); // Use lean for a plain object

        if (populatedTournament.bracket && populatedTournament.bracket.rounds) {
            for (const round of populatedTournament.bracket.rounds) {
                for (const match of round) {
                    // We need to populate players in each match
                    if (match.players) {
                       const populatedPlayers = await User.find({ '_id': { $in: match.players } }).select('username');
                       match.players = populatedPlayers;
                    }
                }
            }
        }
        
        io.emit('tournaments_updated', populatedTournament); // Send updated tournament to all clients
        res.json(populatedTournament);

    } catch (err) {
        console.error('Error reporting tournament match:', err);
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
        // Meddela alla deltagare att turneringen har startat
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