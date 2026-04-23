const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '.env') });

// Importera nödvändiga paket
const express = require('express');
const cors = require('cors');
const http = require('http');
const mongoose = require('mongoose');
const visionService = require('./services/visionService');

const { Server } = require("socket.io");
const connectDB = require('./config/db');
const fs = require('fs');
const gameStateManager = require('./services/gameStateManager');
const redisClient = require('./config/redis');
const StatsService = require('./services/statsService');
const { reportTournamentMatchWinner } = require('./services/tournamentService');

// Initialisera Express och Socket.IO
const app = express();

// CORS origin: if CLIENT_URL is set (comma-separated list supported), restrict
// to those origins. Otherwise allow any origin (useful for dev and for
// same-origin nginx proxy setups).
const allowedOrigins = process.env.CLIENT_URL
  ? process.env.CLIENT_URL.split(',').map(s => s.trim()).filter(Boolean)
  : '*';
app.use(cors({ origin: allowedOrigins, credentials: true }));

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true,
  }
});

// Ladda alla modeller direkt vid start
require('./models/User');
// ... (rest of file)

// Middleware
app.use(express.json());
app.use('/uploads', express.static('uploads'));
app.use(express.static(path.join(__dirname, 'public')));

// Spel-logik & minne
const onlineUsers = {};
const pendingInvites = {};

const BOT_USER_ID = 'BOT_PLAYER_ID';
const BOT_USERNAME = 'Robo-Darter';

app.set('socketio', io);
app.set('onlineUsers', onlineUsers);

// Lobby-funktioner
const getLobbyGames = async () => {
    const allGames = await gameStateManager.getAllGames();
    return Object.values(allGames)
        .filter(game => game.gameState && !game.gameState.winner) // Filtrera bara pågående spel
        .map(game => ({
            id: game.gameId,
            title: `${game.gameType} Match`, // Enkel titel
            score: game.gameState.scores ? `${Object.values(game.gameState.scores)[0]} - ${Object.values(game.gameState.scores)[1]}` : '0 - 0',
            p1: { name: game.players[0]?.username || 'Player 1', flag: 'https://placehold.co/30x30/f03e3e/fff.png?text=P1' }, // Placeholder flag
            p2: { name: game.players[1]?.username || 'Player 2', flag: 'https://placehold.co/30x30/3a86ff/fff.png?text=P2' }  // Placeholder flag
        }));
};

const emitLobbyUpdate = async (io) => {
    try {
        const lobbyGames = await getLobbyGames();
        io.emit('lobby_state_update', lobbyGames);
    } catch (err) {
        console.error('[Lobby Update] Failed to emit lobby update:', err);
    }
};

// Hjälpfunktion för att spara matcher
const saveMatchResult = async (game) => {
    if (game.players.some(p => p.isBot)) {
        console.log(`[Match Not Saved] Game ${game.gameId} involved a bot.`);
        return;
    }
    
    const Match = mongoose.model('Match');
    if (!game.gameState || !game.gameState.winner) return;

    const winnerId = game.gameState.winner;
    const loser = game.players.find(p => p.id !== winnerId);

    if (!loser) return;

    // Save the generic match history
    const match = new Match({
        gameType: game.gameType,
        players: [winnerId, loser.id],
        winner: winnerId,
        loser: loser.id,
        finalScores: game.gameState.scores,
        throwHistory: game.gameState.throwHistory
    });
    await match.save();
    console.log(`[Match Saved] Game ${game.gameId} result has been saved to general history.`);

    // --- NEW: Update User Stats ---
    StatsService.updateUserStatsAfterMatch(match);

    // --- Update League Standings if it's a league match ---
    if (game.leagueContext) {
        try {
            const League = mongoose.model('League');
            const { leagueId, matchId } = game.leagueContext;
            const league = await League.findById(leagueId);
            if (!league) throw new Error(`League not found with ID: ${leagueId}`);

            let matchInLeague;
            let divisionWithMatch;

            for (const division of league.divisions) {
                matchInLeague = division.schedule.id(matchId);
                if (matchInLeague) {
                    divisionWithMatch = division;
                    break;
                }
            }

            if (!matchInLeague || !divisionWithMatch) throw new Error(`Match not found in league with ID: ${matchId}`);
            
            // Update match details
            matchInLeague.status = 'Completed';
            matchInLeague.winner = winnerId;
            matchInLeague.finalScores = game.gameState.scores;

            // Update standings
            const winnerStanding = divisionWithMatch.standings.find(s => s.player.toString() === winnerId);
            const loserStanding = divisionWithMatch.standings.find(s => s.player.toString() === loser.id);

            if (winnerStanding) {
                winnerStanding.wins += 1;
                winnerStanding.points += 3; // 3 points for a win
            }
            if (loserStanding) {
                loserStanding.losses += 1;
            }

            await league.save();
            console.log(`[League Update] Standings updated for league ${league.name} after match ${matchId}.`);

        } catch (err) {
            console.error(`[League Error] Failed to update league standings: ${err.message}`);
            // We don't want to crash the server, so we just log the error.
        }
    }
};

// Bot-logik
const executeBotTurn = async (gameId, io) => {
    const game = await gameStateManager.getGame(gameId);
    if (!game || !game.gameState || game.gameState.winner) return;

    const botPlayerId = game.players.find(p => p.isBot).id;
    const humanPlayer = game.players.find(p => !p.isBot);

    if (game.gameType === '501') {
        const points = Math.floor(Math.random() * 81) + 20;
        const currentScore = game.gameState.scores[botPlayerId];
        const newScore = currentScore - points;

        if (newScore < 2 && newScore !== 0) {
            game.gameState.lastMessage = `${game.players.find(p => p.id === botPlayerId).username} busts! Score resets to ${currentScore}.`;
        } else if (newScore === 0) {
            game.gameState.scores[botPlayerId] = 0;
            game.gameState.winner = botPlayerId;
            game.gameState.lastMessage = `${game.players.find(p => p.id === botPlayerId).username} wins the game!`;
        } else {
            game.gameState.scores[botPlayerId] = newScore;
            game.gameState.lastMessage = `${game.players.find(p => p.id === botPlayerId).username} scores ${points}! ${newScore} remaining.`;
        }
    } else if (game.gameType === 'cricket') {
        const CRICKET_TARGETS = [20, 19, 18, 17, 16, 15, 25];
        const target = CRICKET_TARGETS[Math.floor(Math.random() * CRICKET_TARGETS.length)];
        const multiplier = Math.floor(Math.random() * 3) + 1;

        const opponentId = humanPlayer.id;
        const botState = game.gameState;

        const previousHits = botState.hits[botPlayerId][target];
        botState.hits[botPlayerId][target] += multiplier;

        if (previousHits >= 3) {
            if (botState.hits[opponentId][target] < 3) {
                botState.scores[botPlayerId] += target * multiplier;
            }
        } else if (botState.hits[botPlayerId][target] >= 3) {
            if (botState.hits[opponentId][target] < 3) {
                const pointsToAdd = (botState.hits[botPlayerId][target] - 3) * target;
                botState.scores[botPlayerId] += pointsToAdd;
            }
        }
        game.gameState.lastMessage = `${game.players.find(p => p.id === botPlayerId).username} throws for ${target}x${multiplier}.`;

        const allClosedByBot = CRICKET_TARGETS.every(t => botState.hits[botPlayerId][t] >= 3);
        if (allClosedByBot && botState.scores[botPlayerId] >= botState.scores[opponentId]) {
            botState.winner = botPlayerId;
            botState.lastMessage = `${game.players.find(p => p.id === botPlayerId).username} wins the game!`;
        }
    }

    if (!game.gameState.winner && humanPlayer) {
        game.gameState.currentPlayerId = humanPlayer.id;
        game.gameState.lastMessage += ` Now it's ${humanPlayer.username}'s turn.`;
    }

    await gameStateManager.setGame(gameId, game);
    io.to(gameId).emit('game_state_update', game.gameState);
};

// Socket.IO-logik
io.on('connection', (socket) => {
  console.log(`En användare anslöt med ID: ${socket.id}`);
  const User = mongoose.model('User');

  socket.on('user_online', async ({ userId, username }) => {
    if (userId) {
      socket.userId = userId;
      socket.username = username;
      onlineUsers[userId] = socket.id;
      console.log(`User ${username} (${userId}) is online with socket ${socket.id}`);

      try {
        const user = await User.findById(userId).select('friends');
        if (user && user.friends) {
          user.friends.forEach(friendId => {
            const friendSocketId = onlineUsers[friendId.toString()];
            if (friendSocketId) {
              io.to(friendSocketId).emit('friend_online', { userId });
            }
          });
        }
      } catch (err) { console.error('Error notifying friends about online status:', err); }
    }
  });

  // AI Backend Socket Events
socket.on('video-frame', visionService.handleFrame(io, socket));

  socket.on('camera-calibration', async (calibrationData) => {
    try {
      const Calibration = mongoose.model('Calibration');
      
      const calibration = new Calibration({
        userId: socket.userId,
        cornerPoints: calibrationData,
        isCalibrated: true,
        calibratedAt: new Date()
      });

      await calibration.save();
      
      socket.emit('calibration-saved', {
        success: true,
        calibration: calibration
      });
    } catch (error) {
      console.error('Error saving calibration:', error);
      socket.emit('calibration-error', { message: 'Failed to save calibration' });
    }
  });

  socket.on('dart-detection-result', (data) => {
    if (data.socketId) {
      io.to(data.socketId).emit('dart-detected', {
        score: data.score,
        point: data.point,
        confidence: data.confidence,
        timestamp: new Date()
      });
    }
  });

  socket.on('request_lobby_state', async () => {
    try {
        const lobbyGames = await getLobbyGames();
        socket.emit('lobby_state_update', lobbyGames);
    } catch (err) {
        console.error('[Lobby Update] Failed to send initial lobby state:', err);
    }
  });

  socket.on('join_game', async ({ gameId, userId }) => {
    try {
        const game = await gameStateManager.getGame(gameId);
        if (game) {
            socket.join(gameId);
            socket.gameId = gameId;
            const gameDataForClient = { 
                ...game, 
                players: game.players.map(p => ({ id: p.id, username: p.username })) 
            };
            socket.emit('game_state_update', gameDataForClient);
            console.log(`User ${socket.username || userId} joined game ${gameId}`);
        } else {
            socket.emit('game_error', { message: 'Game not found.' });
        }
    } catch (err) {
        console.error('Error joining game detailed:', err);
        socket.emit('game_error', { message: `Server error while joining game: ${err.message}` });
    }
  });

  const getQueueKey = (gameType) => `matchmaking_queue:${gameType}`;

  socket.on('find_match', async (data) => {
    const { gameType, userId, username } = data;
    const queueKey = getQueueKey(gameType);
    const userData = JSON.stringify({ socketId: socket.id, userId, username });

    // Remove user from any other queue first
    await redisClient.lRem(getQueueKey('501'), 0, userData);
    await redisClient.lRem(getQueueKey('cricket'), 0, userData);

    const opponentData = await redisClient.lPop(queueKey);

    if (opponentData) {
        const opponent = JSON.parse(opponentData);
        
        if (opponent.userId === userId) {
            await redisClient.rPush(queueKey, opponentData);
            await redisClient.rPush(queueKey, userData);
            return socket.emit('waiting_for_match');
        }

        const gameId = Math.random().toString(36).substring(2, 8).toUpperCase();
        const player1 = { id: opponent.userId, username: opponent.username, socketId: opponent.socketId, userId: opponent.userId };
        const player2 = { id: userId, username: username, socketId: socket.id, userId: userId };

        await gameStateManager.setGame(gameId, {
            gameId, gameType, players: [player1, player2], gameState: null
        });

        const opponentSocket = io.sockets.sockets.get(opponent.socketId);
        if (opponentSocket) {
            opponentSocket.join(gameId);
            opponentSocket.gameId = gameId;
        }
        socket.join(gameId);
        socket.gameId = gameId;

        await gameStateManager.initializeAndStartGame(gameId, io);
        await emitLobbyUpdate(io);

    } else {
        await redisClient.rPush(queueKey, userData);
        socket.emit('waiting_for_match');
    }
  });

  socket.on('create_bot_game', async (data) => {
    const { gameType, userId, username } = data;

    const gameId = Math.random().toString(36).substring(2, 8).toUpperCase();
    const player1 = { id: userId, username: username, socketId: socket.id, userId: userId };
    const player2 = { id: BOT_USER_ID, username: BOT_USERNAME, isBot: true, userId: BOT_USER_ID };

    await gameStateManager.setGame(gameId, {
        gameId: gameId,
        gameType: gameType,
        players: [player1, player2],
        gameState: null
    });

    socket.join(gameId);
    socket.gameId = gameId;
    await gameStateManager.initializeAndStartGame(gameId, io);
    await emitLobbyUpdate(io);
  });

  socket.on('create_practice_game', async (data) => {
    const { gameType, userId, username } = data;

    const gameId = Math.random().toString(36).substring(2, 8).toUpperCase();
    const player1 = { id: userId, username: username, socketId: socket.id, userId: userId };

    await gameStateManager.setGame(gameId, {
        gameId: gameId,
        gameType: gameType,
        players: [player1],
        gameState: null
    });

    socket.join(gameId);
    socket.gameId = gameId;
    await gameStateManager.initializeAndStartGame(gameId, io);
    // No lobby update, as it's a private practice game
  });

  socket.on('cancel_find_match', async () => {
    const userData = JSON.stringify({ socketId: socket.id, userId: socket.userId, username: socket.username });
    
    const removed501 = await redisClient.lRem(getQueueKey('501'), 0, userData);
    const removedCricket = await redisClient.lRem(getQueueKey('cricket'), 0, userData);

    if (removed501 > 0 || removedCricket > 0) {
        socket.emit('matchmaking_cancelled');
    }
  });

  socket.on('invite_to_game', (data) => {
    const { recipientId, gameType } = data;
    const recipientSocketId = onlineUsers[recipientId];

    if (!recipientSocketId) {
        return socket.emit('error_message', 'The user is not online.');
    }

    const inviteId = Math.random().toString(36).substring(2, 10);
    pendingInvites[inviteId] = {
        from: { socketId: socket.id, userId: socket.userId, username: socket.username },
        to: { socketId: recipientSocketId, userId: recipientId },
        gameType: gameType
    };

    io.to(recipientSocketId).emit('receive_game_invite', {
        inviteId: inviteId,
        from: { username: socket.username },
        gameType: gameType
    });
  });

  socket.on('accept_game_invite', async ({ inviteId }) => {
    const invite = pendingInvites[inviteId];
    if (!invite || socket.id !== invite.to.socketId) return;

    const gameId = Math.random().toString(36).substring(2, 8).toUpperCase();
    const player1 = { id: invite.from.userId, username: invite.from.username, socketId: invite.from.socketId, userId: invite.from.userId };
    const player2 = { id: socket.userId, username: socket.username, socketId: socket.id, userId: socket.userId };

    await gameStateManager.setGame(gameId, {
        gameId: gameId,
        gameType: invite.gameType,
        players: [player1, player2],
        gameState: null
    });

    const challengerSocket = io.sockets.sockets.get(invite.from.socketId);
    if (challengerSocket) {
        challengerSocket.join(gameId);
        challengerSocket.gameId = gameId;
    }
    socket.join(gameId);
    socket.gameId = gameId;

    await gameStateManager.initializeAndStartGame(gameId, io);
    await emitLobbyUpdate(io);
    delete pendingInvites[inviteId];
  });

  socket.on('decline_game_invite', ({ inviteId }) => {
    const invite = pendingInvites[inviteId];
    if (!invite || socket.id !== invite.to.socketId) return;

    const challengerSocket = io.sockets.sockets.get(invite.from.socketId);
    if (challengerSocket) {
        challengerSocket.emit('invite_declined', { from: { id: socket.userId, username: socket.username } });
    }
    delete pendingInvites[inviteId];
  });

  // --- League Match Scheduling ---
  socket.on('propose_league_match_time', async ({ leagueId, matchId, proposedDate }) => {
    try {
        const League = mongoose.model('League');
        const league = await League.findById(leagueId);
        if (!league) return socket.emit('error_message', 'League not found.');

        let matchToUpdate;
        let opponentId;

        for (const division of league.divisions) {
            matchToUpdate = division.schedule.id(matchId);
            if (matchToUpdate) {
                const player1Id = matchToUpdate.player1.toString();
                const player2Id = matchToUpdate.player2.toString();
                if (player1Id !== socket.userId && player2Id !== socket.userId) {
                    return socket.emit('error_message', 'You are not a player in this match.');
                }
                opponentId = player1Id === socket.userId ? player2Id : player1Id;
                break;
            }
        }
        
        if (!matchToUpdate) return socket.emit('error_message', 'Match not found in league.');

        matchToUpdate.proposedDate = new Date(proposedDate);
        await league.save();

        const opponentSocketId = onlineUsers[opponentId];
        if (opponentSocketId) {
            io.to(opponentSocketId).emit('league_match_update', { matchId, proposedDate });
        }
        socket.emit('league_match_update', { matchId, proposedDate }); // Also notify self
        socket.emit('toast_message', { type: 'success', message: 'Time proposal sent!' });

    } catch (err) {
        console.error('Error proposing match time:', err);
        socket.emit('error_message', 'Server error while proposing time.');
    }
  });

  socket.on('accept_league_match_time', async ({ leagueId, matchId }) => {
    try {
        const League = mongoose.model('League');
        const league = await League.findById(leagueId);
        if (!league) return socket.emit('error_message', 'League not found.');

        let matchToUpdate;
        let playerIds = [];

        for (const division of league.divisions) {
            matchToUpdate = division.schedule.id(matchId);
            if (matchToUpdate) {
                playerIds = [matchToUpdate.player1.toString(), matchToUpdate.player2.toString()];
                if (!playerIds.includes(socket.userId)) {
                    return socket.emit('error_message', 'You are not a player in this match.');
                }
                break;
            }
        }

        if (!matchToUpdate) return socket.emit('error_message', 'Match not found in league.');
        
        // Ensure the acceptor is not the proposer
        // This check would require knowing who proposed it. For now, we'll assume the flow is correct.

        matchToUpdate.status = 'Confirmed';
        matchToUpdate.matchDate = matchToUpdate.proposedDate;
        await league.save();
        
        // Notify both players
        playerIds.forEach(playerId => {
            const playerSocketId = onlineUsers[playerId];
            if (playerSocketId) {
                io.to(playerSocketId).emit('league_match_update', { matchId, status: 'Confirmed', matchDate: matchToUpdate.matchDate });
                io.to(playerSocketId).emit('toast_message', { type: 'success', message: `Match confirmed for ${new Date(matchToUpdate.matchDate).toLocaleString()}` });
            }
        });

    } catch (err) {
        console.error('Error accepting match time:', err);
        socket.emit('error_message', 'Server error while confirming time.');
    }
  });

  socket.on('start_league_match', async ({ leagueId, matchId }) => {
    try {
        const League = mongoose.model('League');
        const User = mongoose.model('User');

        const league = await League.findById(leagueId).populate('divisions.schedule.player1 divisions.schedule.player2');
        if (!league) return socket.emit('error_message', 'League not found.');

        let match;
        for (const division of league.divisions) {
            match = division.schedule.id(matchId);
            if (match) break;
        }

        if (!match) return socket.emit('error_message', 'Match not found.');
        if (match.status !== 'Confirmed') return socket.emit('error_message', 'Match is not confirmed or has been played.');

        // Simple check to prevent starting too early. More robust logic could be added.
        // if (new Date() < new Date(match.matchDate)) {
        //     return socket.emit('error_message', 'It is not time to start the match yet.');
        // }

        const player1Id = match.player1._id.toString();
        const player2Id = match.player2._id.toString();

        if (socket.userId !== player1Id && socket.userId !== player2Id) {
            return socket.emit('error_message', 'You are not a player in this match.');
        }

        const player1 = { id: player1Id, username: match.player1.username, socketId: onlineUsers[player1Id], userId: player1Id };
        const player2 = { id: player2Id, username: match.player2.username, socketId: onlineUsers[player2Id], userId: player2Id };

        if (!onlineUsers[player1Id] || !onlineUsers[player2Id]) {
            return socket.emit('error_message', 'One or more players are not online.');
        }

        await gameStateManager.setGame(matchId, {
            gameId: matchId,
            gameType: '501', // Or get this from league settings
            players: [player1, player2],
            gameState: null,
            leagueContext: { leagueId, matchId } // For saving results later
        });

        const player1Socket = io.sockets.sockets.get(player1.socketId);
        const player2Socket = io.sockets.sockets.get(player2.socketId);

        if (player1Socket) {
            player1Socket.join(matchId);
            player1Socket.gameId = matchId;
        }
        if (player2Socket) {
            player2Socket.join(matchId);
            player2Socket.gameId = matchId;
        }
        
        await gameStateManager.initializeAndStartGame(matchId, io);

    } catch (err) {
        console.error('Error starting league match:', err);
        socket.emit('error_message', `Could not start match. Server error: ${err.message}`);
    }
  });

  socket.on('submit_score', async (data) => {
    const { gameId, points } = data;
    const game = await gameStateManager.getGame(gameId);

    if (!game || !game.gameState) return;
    if (socket.userId !== game.gameState.currentPlayerId) {
      return socket.emit('error_message', "It's not your turn.");
    }

    const currentPlayerId = game.gameState.currentPlayerId;
    const currentScore = game.gameState.scores[currentPlayerId];
    const newScore = currentScore - points;

    if (newScore < 2 && newScore !== 0) {
      game.gameState.lastMessage = `BUST! Score resets to ${currentScore}.`;
    } else if (newScore === 0) {
      game.gameState.scores[currentPlayerId] = 0;
      game.gameState.winner = currentPlayerId;
      const winnerUsername = game.players.find(p => p.id === currentPlayerId).username;
      game.gameState.lastMessage = `WINNER! ${winnerUsername} wins the game!`;
      
      saveMatchResult(game);
      await emitLobbyUpdate(io);

      if (game.tournamentContext) {
        console.log(`[Tournament] Reporting winner for match ${game.tournamentContext.matchId}`);
        reportTournamentMatchWinner({
          tournamentId: game.tournamentContext.tournamentId,
          matchId: game.tournamentContext.matchId,
          winnerId: currentPlayerId,
          io: io,
          onlineUsers: onlineUsers
        }).catch(err => {
          console.error(`[Tournament Error] Failed to report match winner: ${err.message}`);
          io.to(gameId).emit('error_message', 'A server error occurred while updating the tournament bracket.');
        });
      }

    } else {
      game.gameState.scores[currentPlayerId] = newScore;
      game.gameState.lastMessage = `Good throw! ${newScore} remaining.`;
    }

    if (!game.gameState.winner) {
      const currentPlayerIndex = game.players.findIndex(p => p.id === currentPlayerId);
      const nextPlayer = game.players[1 - currentPlayerIndex];
      game.gameState.currentPlayerId = nextPlayer.id;
      game.gameState.lastMessage += ` Now it's ${nextPlayer.username}'s turn.`;

      if (nextPlayer.isBot) {
        setTimeout(() => {
            executeBotTurn(gameId, io);
        }, 1500);
      }
    }
    
    await gameStateManager.setGame(gameId, game);
    io.to(gameId).emit('game_state_update', game.gameState);
  });

  socket.on('submit_cricket_throw', async (data) => {
    const { gameId, target, multiplier } = data;
    const game = await gameStateManager.getGame(gameId);

    if (!game || !game.gameState) return;
    if (socket.userId !== game.gameState.currentPlayerId) {
      return socket.emit('error_message', "It's not your turn.");
    }

    const numTarget = parseInt(target);
    const numMultiplier = parseInt(multiplier);
    const currentPlayerId = game.gameState.currentPlayerId;
    const opponentId = game.players.find(p => p.id !== currentPlayerId).id;

    const currentPlayerState = game.gameState;
    const opponentState = {
        hits: game.gameState.hits[opponentId],
        score: game.gameState.scores[opponentId]
    };

    const previousHits = currentPlayerState.hits[currentPlayerId][numTarget];
    currentPlayerState.hits[currentPlayerId][numTarget] += numMultiplier;

    if (previousHits >= 3) {
        if (opponentState.hits[numTarget] < 3) {
            currentPlayerState.scores[currentPlayerId] += numTarget * numMultiplier;
        }
    } else if (currentPlayerState.hits[currentPlayerId][numTarget] >= 3) {
        if (opponentState.hits[numTarget] < 3) {
            const pointsToAdd = (currentPlayerState.hits[currentPlayerId][numTarget] - 3) * numTarget;
            currentPlayerState.scores[currentPlayerId] += pointsToAdd;
        }
    }

    const CRICKET_TARGETS = [20, 19, 18, 17, 16, 15, 25];
    const allClosedByCurrent = CRICKET_TARGETS.every(t => currentPlayerState.hits[currentPlayerId][t] >= 3);
    if (allClosedByCurrent && currentPlayerState.scores[currentPlayerId] >= opponentState.score) {
        currentPlayerState.winner = currentPlayerId;
        const winnerUsername = game.players.find(p => p.id === currentPlayerId).username;
        currentPlayerState.lastMessage = `WINNER! ${winnerUsername} wins the game!`;
        
        saveMatchResult(game);
      await emitLobbyUpdate(io);

        if (game.tournamentContext) {
          console.log(`[Tournament] Reporting winner for match ${game.tournamentContext.matchId}`);
          reportTournamentMatchWinner({
            tournamentId: game.tournamentContext.tournamentId,
            matchId: game.tournamentContext.matchId,
            winnerId: currentPlayerId,
            io: io,
            onlineUsers: onlineUsers
          }).catch(err => {
            console.error(`[Tournament Error] Failed to report match winner: ${err.message}`);
            io.to(gameId).emit('error_message', 'A server error occurred while updating the tournament bracket.');
          });
        }

    } else {
        const nextPlayer = game.players.find(p => p.id !== currentPlayerId);
        currentPlayerState.currentPlayerId = nextPlayer.id;
        currentPlayerState.lastMessage = `It's now ${nextPlayer.username}'s turn.`;
    }

    await gameStateManager.setGame(gameId, game);
    io.to(gameId).emit('game_state_update', currentPlayerState);
  });

  socket.on('start_tournament_match', async ({ tournamentId, matchId }) => {
    try {
        const Tournament = mongoose.model('Tournament');
        const User = mongoose.model('User');

        const tournament = await Tournament.findById(tournamentId);
        if (!tournament) return socket.emit('error_message', 'Tournament not found.');

        const match = tournament.bracket.rounds.flat().find(m => m.matchId.toString() === matchId);
        if (!match || match.players.length === 0) return socket.emit('error_message', 'Match is not ready or has no players.');

        const getPlayerObject = async (playerId) => {
            if (playerId.toString() === BOT_USER_ID) {
                return { id: BOT_USER_ID, username: BOT_USERNAME, isBot: true, userId: BOT_USER_ID };
            }
            const userDoc = await User.findById(playerId).select('username');
            if (!userDoc) return null;
            return { id: userDoc._id.toString(), username: userDoc.username, socketId: onlineUsers[userDoc._id.toString()], userId: userDoc._id.toString() };
        };

        const player1 = await getPlayerObject(match.players[0]);
        let player2 = null;
        if (match.players.length > 1) {
            player2 = await getPlayerObject(match.players[1]);
        } else if (match.players.length === 1) {
            player2 = { id: BOT_USER_ID, username: BOT_USERNAME, isBot: true, userId: BOT_USER_ID };
            match.players.push(BOT_USER_ID);
        }

        if (!player1 || !player2) {
            const missingPlayerId = !player1 ? match.players[0] : match.players[1];
            if (missingPlayerId !== BOT_USER_ID) {
               return socket.emit('error_message', `Player with ID ${missingPlayerId} could not be found.`);
            }
        }
        
        if (!player1 || !player2) {
            return socket.emit('error_message', 'Could not assemble players for the match.');
        }

        await gameStateManager.setGame(matchId, {
            gameId: matchId,
            gameType: tournament.gameType,
            players: [player1, player2],
            gameState: null,
            tournamentContext: { tournamentId, matchId }
        });

        const player1Socket = player1.isBot ? null : io.sockets.sockets.get(player1.socketId);
        const player2Socket = player2.isBot ? null : io.sockets.sockets.get(player2.socketId);

        if (player1Socket) {
            player1Socket.join(matchId);
            player1Socket.gameId = matchId;
        }
        if (player2Socket) {
            player2Socket.join(matchId);
            player2Socket.gameId = matchId;
        }
        
        await tournament.save();

        await gameStateManager.initializeAndStartGame(matchId, io);

        const game = await gameStateManager.getGame(matchId);
        if (game && game.gameState && game.gameState.currentPlayerId === BOT_USER_ID) {
            setTimeout(() => {
                executeBotTurn(matchId, io);
            }, 1500);
        }

    } catch (err) {
        console.error('Error starting tournament match:', err);
        socket.emit('error_message', `Could not start match. Server error: ${err.message}`);
    }
  });

  socket.on('spectate_game', async ({ gameId }) => {
    if (!socket.isSubscriber) {
      return socket.emit('unauthorized', { message: 'Only subscribers can spectate games.' });
    }

    const game = await gameStateManager.getGame(gameId);
    if (game) {
      socket.join(gameId);
      socket.emit('initial_spectate_state', game);
      // NOTE: do not set socket.gameId for spectators so their frames (if any) aren't submitted as throws.
      console.log(`User ${socket.username} (${socket.userId}) started spectating game ${gameId}`);
    } else {
      socket.emit('game_not_found');
    }
  });

  socket.on('leave_spectate', ({ gameId }) => {
    socket.leave(gameId);
    console.log(`User ${socket.id} stopped spectating game ${gameId}`);
  });

  // WebRTC Signaling
  socket.on('join-video-room', (gameId) => {
    socket.join(gameId);
    socket.to(gameId).emit('video-user-connected', socket.userId);
    console.log(`[WebRTC] User ${socket.username} (${socket.userId}) joined video room: ${gameId}`);
  });

  socket.on('webrtc-offer', ({ offer, to }) => {
    const recipientSocketId = onlineUsers[to];
    if (recipientSocketId) {
        io.to(recipientSocketId).emit('webrtc-offer', { offer, from: socket.userId });
        console.log(`[WebRTC] Relaying offer from ${socket.userId} to ${to}`);
    } else {
        console.log(`[WebRTC] Could not relay offer: User ${to} is not online.`);
    }
  });

  socket.on('webrtc-answer', ({ answer, to }) => {
    const recipientSocketId = onlineUsers[to];
    if (recipientSocketId) {
        io.to(recipientSocketId).emit('webrtc-answer', { answer, from: socket.userId });
        console.log(`[WebRTC] Relaying answer from ${socket.userId} to ${to}`);
    } else {
        console.log(`[WebRTC] Could not relay answer: User ${to} is not online.`);
    }
  });

  socket.on('webrtc-ice-candidate', ({ candidate, to }) => {
    const recipientSocketId = onlineUsers[to];
    if (recipientSocketId) {
        io.to(recipientSocketId).emit('webrtc-ice-candidate', { candidate, from: socket.userId });
    }
  });

  socket.on('video-user-left', (gameId) => {
    socket.to(gameId).emit('video-user-left', socket.userId);
    console.log(`[WebRTC] User ${socket.username} (${socket.userId}) left video room: ${gameId}`);
  });

  socket.on('disconnect', async () => {
    console.log(`Användare ${socket.id} kopplade från.`);

    if (socket.userId) {
      // Remove user from matchmaking queues on disconnect
      const userData = JSON.stringify({ socketId: socket.id, userId: socket.userId, username: socket.username });
      await redisClient.lRem(getQueueKey('501'), 0, userData);
      await redisClient.lRem(getQueueKey('cricket'), 0, userData);

      // Notify about video user leaving on disconnect
      const allGames = await gameStateManager.getAllGames();
      const gameEntry = Object.entries(allGames).find(([, game]) =>
        game.players.some(player => player.id === socket.userId)
      );
      if (gameEntry) {
          const [gameId] = gameEntry;
          socket.to(gameId).emit('video-user-left', socket.userId);
          console.log(`[WebRTC] User ${socket.username} (${socket.userId}) left video room on disconnect: ${gameId}`);
      }
      
      try {
        const user = await User.findById(socket.userId).select('friends');
        if (user && user.friends) {
          user.friends.forEach(friendId => {
            const friendSocketId = onlineUsers[friendId.toString()];
            if (friendSocketId) io.to(friendSocketId).emit('friend_offline', { userId: socket.userId });
          });
        }
      } catch (err) { console.error('Error notifying friends about offline status:', err); }
    }

    if (socket.userId && onlineUsers[socket.userId]) {
      delete onlineUsers[socket.userId];
      console.log(`User ${socket.userId} is now offline.`);
    }

    const allGames = await gameStateManager.getAllGames();
    const gameEntry = Object.entries(allGames).find(([, game]) =>
      game.players.some(player => player.id === socket.userId)
    );

    if (gameEntry) {
      const [gameId, game] = gameEntry;
      const disconnectedPlayer = game.players.find(p => p.id === socket.userId);
      const username = disconnectedPlayer ? disconnectedPlayer.username : 'En spelare';

      console.log(`Spelare ${username} (${socket.id}) lämnade spel ${gameId}. Städar upp.`);

      await gameStateManager.deleteGame(gameId);
      await emitLobbyUpdate(io);

      socket.to(gameId).emit('opponent_disconnected', {
        message: 'Your opponent has disconnected. You win by forfeit!'
      });
    }
  });

  socket.on('send_private_message', async ({ recipientId, content }) => {
    const Conversation = mongoose.model('Conversation');
    const Message = mongoose.model('Message');
    const recipientSocketId = onlineUsers[recipientId];
    
    if (socket.userId) {
        try {
            const participants = [socket.userId, recipientId].sort();
            let conversation = await Conversation.findOne({ participants });

            if (!conversation) {
                conversation = await Conversation.create({ participants });
            }
            
            const newMessage = new Message({
                conversationId: conversation._id,
                sender: socket.userId,
                recipient: recipientId,
                content: content
            });
            await newMessage.save();
            
            const messageData = {
                _id: newMessage._id.toString(),
                senderId: socket.userId,
                recipientId: recipientId,
                content: content,
                timestamp: newMessage.createdAt
            };
            
            socket.emit('receive_private_message', messageData);
            if (recipientSocketId) {
                io.to(recipientSocketId).emit('receive_private_message', messageData);
            }
        } catch (err) {
            console.error('Chat error:', err);
            socket.emit('error_message', 'Could not save or send message.');
        }
    } else {
        socket.emit('error_message', 'Could not send message. Authentication error.');
    }
  });

  socket.on('report_player', async ({ gameId, reportedUserId, reason }) => {
    if (socket.userId) {
      try {
        const Report = mongoose.model('Report');
        const newReport = new Report({
          reporter: socket.userId,
          reported: reportedUserId,
          gameId: gameId,
          type: 'Cheating', // This can be expanded later
          reason: reason,
        });
        await newReport.save();
        console.log(`[REPORT] User ${socket.username} (${socket.userId}) has reported user ${reportedUserId}.`);
        socket.emit('report_received', { message: 'Your report has been received and will be reviewed.' });
      } catch (err) {
        console.error('Failed to save report:', err);
        socket.emit('error_message', 'Could not file your report at this time.');
      }
    }
  });

  socket.on('request_assistance', async ({ gameId, reason }) => {
    if (socket.userId) {
        try {
            const Report = mongoose.model('Report');
            const newReport = new Report({
                reporter: socket.userId,
                gameId: gameId,
                type: 'TechnicalAssistance',
                reason: reason,
            });
            await newReport.save();
            console.log(`[ASSISTANCE] User ${socket.username} (${socket.userId}) requested assistance in game ${gameId}.`);
            // TODO: Emit an event to a specific admin channel/room
            socket.emit('report_received', { message: 'Your request for assistance has been sent.' });
        } catch (err) {
            console.error('Failed to save assistance request:', err);
            socket.emit('error_message', 'Could not request assistance at this time.');
        }
    }
  });
});

// API Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});


app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/economy', require('./routes/economyRoutes'));
app.use('/api/leagues', require('./routes/leagueRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/friends', require('./routes/friendsRoutes'));
app.use('/api/posts', require('./routes/postRoutes'));
app.use('/api/chat', require('./routes/chatRoutes'));
app.use('/api/payments', require('./routes/paymentRoutes'));
app.use('/api/tournaments', require('./routes/tournamentRoutes'));
app.use('/api/rewards', require('./routes/rewardRoutes'));
app.use('/api/stats', require('./routes/statsRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api/federation', require('./routes/federationRoutes')); // Federation Routes
app.use('/api/reports', require('./routes/reportRoutes'));
app.use('/api/camera', require('./routes/cameraRoutes'));

// Starta servern
const startServer = async () => {
  try {
    const uploadsDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir);
      console.log("Created 'uploads' directory for media.");
    }

    if (process.env.NODE_ENV !== 'test') {
      await connectDB();
    }

    const PORT = process.env.PORT || 5000;
    
    server.listen(PORT, () => {
      console.log(`Servern körs på http://localhost:${PORT}`);
      const tournamentScheduler = require('./services/tournamentScheduler');
      tournamentScheduler.start(io);
    });
  } catch (error) {
    console.error("FATALT FEL: Kunde inte ansluta till databasen. Servern startar inte.", error);
    process.exit(1);
  }
};

if (require.main === module) {
  startServer();
}

module.exports = { app, server, io };