const mongoose = require('mongoose');
const Tournament = require('../models/Tournament');
const User = require('../models/User');
const economyService = require('./economyService');

const joinTournament = async (userId, tournamentId) => {
    const user = await User.findById(userId);
    const tournament = await Tournament.findById(tournamentId);

    if (!user || !tournament) throw new Error('User or Tournament not found.');
    if (tournament.status !== 'pending') throw new Error('Tournament is not open for registration.');
    if (tournament.participants.includes(userId)) throw new Error('You are already registered for this tournament.');
    if (tournament.participants.length >= tournament.maxParticipants) throw new Error('This tournament is full.');

    // Classification Check
    const userClass = user.classification;
    const allowedClasses = tournament.allowedClassifications;

    if (!allowedClasses.includes(userClass)) {
        // Special rule: Amateurs can join Pro tournaments
        if (!(userClass === 'Amateur' && allowedClasses.includes('Pro'))) {
            throw new Error(`Your classification (${userClass}) is not eligible for this tournament.`);
        }
    }

    // Charge Entry Fee
    const feePaid = await economyService.spendStars(userId, tournament.entryFeeGoldStars, tournament.entryFeeSilverStars);
    if (!feePaid) {
        throw new Error('Could not process entry fee. Check your star balance.');
    }

    // Add participant
    tournament.participants.push(userId);
    await tournament.save();

    return tournament;
};


const distributePrizes = async (tournamentId) => {
    const tournament = await Tournament.findById(tournamentId);
    if (!tournament || tournament.status !== 'completed') throw new Error('Tournament not found or not completed.');

    const { prizeDistribution, entryFeeGoldStars, bracket } = tournament;
    const finalRound = bracket.rounds[bracket.rounds.length - 1];
    const semiFinalRound = bracket.rounds[bracket.rounds.length - 2];
    
    if (!finalRound || !semiFinalRound) throw new Error('Invalid bracket structure for prize distribution.');

    // 1. Winner
    const winnerId = tournament.winner;
    const prizeWinner = prizeDistribution.first * entryFeeGoldStars;
    await economyService.creditStars(winnerId, prizeWinner, 0);
    console.log(`[Prizes] Credited ${prizeWinner} Gold Stars to winner ${winnerId}`);

    // 2. Runner-up
    const finalMatch = finalRound[0];
    const runnerUpId = finalMatch.players.find(p => p.toString() !== winnerId.toString());
    if (runnerUpId) {
        const prizeRunnerUp = prizeDistribution.second * entryFeeGoldStars;
        await economyService.creditStars(runnerUpId, prizeRunnerUp, 0);
        console.log(`[Prizes] Credited ${prizeRunnerUp} Gold Stars to runner-up ${runnerUpId}`);
    }

    // 3. Semi-finalists
    if (prizeDistribution.semiFinalists > 0) {
        const semiFinalLosers = semiFinalRound
            .map(match => match.players.find(p => p.toString() !== match.winner.toString()))
            .filter(id => id); // Filter out any null/undefined
        
        for (const loserId of semiFinalLosers) {
            const prizeSemiFinalist = prizeDistribution.semiFinalists * entryFeeGoldStars;
            await economyService.creditStars(loserId, prizeSemiFinalist, 0);
            console.log(`[Prizes] Credited ${prizeSemiFinalist} Gold Stars to semi-finalist ${loserId}`);
        }
    }
};


const reportTournamentMatchWinner = async ({ tournamentId, matchId, winnerId, io, onlineUsers }) => {
    try {
        const tournament = await Tournament.findById(tournamentId);

        if (!tournament) throw new Error('Tournament not found.');
        if (tournament.status !== 'active') throw new Error('Tournament is not active.');

        let matchFound = null;
        let currentRoundIndex = -1;
        let matchInRoundIndex = -1;

        // Find the match and its position
        for (let i = 0; i < tournament.bracket.rounds.length; i++) {
            const round = tournament.bracket.rounds[i];
            const matchIndex = round.findIndex(m => m.matchId.toString() === matchId);
            if (matchIndex !== -1) {
                matchFound = round[matchIndex];
                currentRoundIndex = i;
                matchInRoundIndex = matchIndex;
                break;
            }
        }

        if (!matchFound) throw new Error('Match not found in this tournament.');
        if (matchFound.winner) throw new Error('Match result already reported.');

        // Set the winner for the current match
        matchFound.winner = winnerId;

        // Check if this was the final match
        const isFinalMatch = tournament.bracket.rounds[currentRoundIndex].length === 1 && currentRoundIndex > 0;

        if (isFinalMatch) {
            tournament.status = 'completed';
            tournament.winner = winnerId;
            await tournament.save(); // Save before distributing prizes
            await distributePrizes(tournamentId); // --- NEW: Distribute prizes ---
        } else {
            // Not the final, advance the winner to the next round
            const nextRoundIndex = currentRoundIndex + 1;
            const matchIndexInNextRound = Math.floor(matchInRoundIndex / 2);

            if (tournament.bracket.rounds[nextRoundIndex] && tournament.bracket.rounds[nextRoundIndex][matchIndexInNextRound]) {
                const nextMatch = tournament.bracket.rounds[nextRoundIndex][matchIndexInNextRound];
                nextMatch.players.push(winnerId);

                // If the next match is now full, notify the players
                if (nextMatch.players.length === 2) {
                    const player1Id = nextMatch.players[0].toString();
                    const player2Id = nextMatch.players[1].toString();
                    const player1SocketId = onlineUsers[player1Id];
                    const player2SocketId = onlineUsers[player2Id];

                    const notificationPayload = {
                        tournamentId: tournament._id,
                        tournamentName: tournament.name,
                        matchId: nextMatch.matchId
                    };

                    if (player1SocketId) io.to(player1SocketId).emit('tournament_match_ready', notificationPayload);
                    if (player2SocketId) io.to(player2SocketId).emit('tournament_match_ready', notificationPayload);
                }
            }
        }

        tournament.markModified('bracket');
        await tournament.save();
        
        // Notify clients of the update
        io.emit('tournament_updated', { tournamentId: tournament._id });
        
        return tournament;

    } catch (err) {
        console.error('Error in reportTournamentMatchWinner:', err);
        throw err;
    }
};

module.exports = { 
    joinTournament,
    reportTournamentMatchWinner,
    distributePrizes 
};
