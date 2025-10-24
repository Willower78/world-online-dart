// Importera nödvändiga paket
const express = require('express');
const http = require('http'); // NY: Importera Node.js http-modul
const dotenv = require('dotenv');
const path = require('path'); // Korrekt placering av path-modulen

// Ladda miljövariabler omedelbart, och ange korrekt sökväg
dotenv.config({ path: path.resolve(__dirname, '.env') });

const { Server } = require("socket.io"); // NY: Importera Server-klassen från socket.io
const connectDB = require('./config/db');
const fs = require('fs');

// --- NYTT: Ladda alla modeller direkt vid start ---
require('./models/User');
require('./models/Match');
require('./models/Post');
require('./models/Conversation');
require('./models/Tournament');
const mongoose = require('mongoose');

// Skapa Express-appen
const app = express();

// --- NY SOCKET.IO-KONFIGURATION ---
// Skapa en http-server med vår Express-app
const server = http.createServer(app); 

// Skapa en Socket.IO-server som använder vår http-server
const io = new Server(server, {
  // CORS-inställningar för att tillåta anslutningar från vår React-app (som körs på port 3000)
  cors: {
    // Tillåt anslutningar från både port 3000 och 3001 för flexibilitet under utveckling
    origin: ["http://localhost:3000", "http://localhost:3001"],
    methods: ["GET", "POST"]
  }
});

// Middleware för att hantera JSON
app.use(express.json());

// NY: Middleware för att servera statiska filer (uppladdade bilder/videos)
// Alla anrop till /uploads/... kommer nu att leta efter filer i 'uploads'-mappen.
app.use('/uploads', express.static('uploads'));

// --- SPEL-LOGIK & MINNE ---
// En enkel "databas" i minnet för att hålla koll på aktiva spel.
// Nyckeln är gameId, och värdet är ett objekt med spelinformation.
const activeGames = {};
const onlineUsers = {}; // NY: Mappa userId till socket.id
const matchmakingQueue = {
    '501': [],
    'cricket': []
};
const pendingInvites = {}; // För direkta utmaningar

// --- NYTT: Bot-spelare Konstanter ---
const BOT_USER_ID = 'BOT_PLAYER_ID';
const BOT_USERNAME = 'Robo-Darter';

// Gör io och onlineUsers tillgängliga för våra route-filer
app.set('socketio', io);
app.set('onlineUsers', onlineUsers);

// --- HJÄLPFUNKTION FÖR ATT SPARA MATCHER ---
const saveMatchResult = async (game) => {
    // NYTT: Spara inte matcher som involverar en bot
    if (game.players.some(p => p.isBot)) {
        console.log(`[Match Not Saved] Game ${game.gameId} involved a bot.`);
        return;
    }
    
    const Match = mongoose.model('Match');
    if (!game.gameState || !game.gameState.winner) return;

    const winnerId = game.gameState.winner;
    const loser = game.players.find(p => p.id !== winnerId);

    if (!loser) return; // Kan inte spara om vi inte hittar en förlorare

    const match = new Match({
        gameType: game.gameType,
        players: [winnerId, loser.id],
        winner: winnerId,
        loser: loser.id,
        finalScores: game.gameState.scores,
        throwHistory: game.gameState.throwHistory // NYTT
    });

    await match.save();
    console.log(`[Match Saved] Game ${game.gameId} result has been saved.`);
};

// --- NYTT: Bot-logik ---
const executeBotTurn = (gameId, io) => {
    const game = activeGames[gameId];
    if (!game || !game.gameState || game.gameState.winner) return;

    const botPlayerId = game.players.find(p => p.isBot).id;
    const humanPlayer = game.players.find(p => !p.isBot);

    if (game.gameType === '501') {
        const points = Math.floor(Math.random() * 81) + 20; // Random score 20-100
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

        // Simplified logic from submit_cricket_throw
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

    // Byt tillbaka turen till den mänskliga spelaren (om ingen har vunnit)
    if (!game.gameState.winner && humanPlayer) {
        game.gameState.currentPlayerId = humanPlayer.id;
        game.gameState.lastMessage += ` Now it's ${humanPlayer.username}'s turn.`;
    }

    io.to(gameId).emit('game_state_update', game.gameState);
};


// --- HJÄLPFUNKTION FÖR ATT STARTA SPEL ---
function initializeAndStartGame(gameId, io, activeGames) {
  const game = activeGames[gameId];
  if (!game || game.players.length < 2) return;

  if (game.gameType === '501') {
      game.gameState = {
          scores: { [game.players[0].id]: 501, [game.players[1].id]: 501 },
          currentPlayerId: game.players[0].id,
          winner: null,
          lastMessage: `Game starts! It's ${game.players[0].username}'s turn.`
      };
  } else if (game.gameType === 'cricket') {
      const initialHits = { 20: 0, 19: 0, 18: 0, 17: 0, 16: 0, 15: 0, 25: 0 };
      game.gameState = {
          scores: { [game.players[0].id]: 0, [game.players[1].id]: 0 },
          hits: {
              [game.players[0].id]: { ...initialHits },
              [game.players[1].id]: { ...initialHits },
          },
          closed: { ...initialHits },
          currentPlayerId: game.players[0].id,
          winner: null,
          lastMessage: `Cricket game starts! It's ${game.players[0].username}'s turn.`
      };
  }

  const gameDataForClient = { ...game, players: game.players.map(p => ({ id: p.id, username: p.username })) };
  io.to(gameId).emit('game_start', gameDataForClient);
};

// --- SOCKET.IO-LOGIK ---
// Denna kod körs varje gång en ny användare ansluter till vår server
io.on('connection', (socket) => {
  console.log(`En användare anslöt med ID: ${socket.id}`);
  const User = mongoose.model('User'); // Använd Mongoose för att undvika cirkulära beroenden


  // När en användare har loggat in och meddelar att de är online (NY: userId sparas på socketen)
  socket.on('user_online', async ({ userId, username }) => {
    if (userId) {
      socket.userId = userId; // Attach userId directly to the socket instance
      socket.username = username; // Attach username as well
      onlineUsers[userId] = socket.id;
      console.log(`User ${username} (${userId}) is online with socket ${socket.id}`);

      // --- NYTT: Meddela vänner att användaren är online ---
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

  // --- LOBBY-LOGIK ---

  // När en spelare vill skapa ett nytt spel
  socket.on('create_game', (data) => {
    const gameId = Math.random().toString(36).substring(2, 8).toUpperCase(); // Skapa ett slumpmässigt, kort ID
    console.log(`Spelare ${socket.id} skapade ett spel (${data.gameType}) med ID: ${gameId}`);

    // Skapa ett nytt spelobjekt
    activeGames[gameId] = { // NY: Spara userId som id i players-arrayen
      gameId: gameId,
      gameType: data.gameType, // t.ex. '501' eller 'cricket'
      players: [{ id: socket.id, username: data.username }], // Spelaren som skapade spelet
      gameState: null // Speldata kommer initieras när spelet startar
    };

    // Anslut spelaren till ett "rum" för detta spel
    socket.join(gameId);

    // Skicka tillbaka spel-ID till skaparen så de kan visa/dela det
    socket.emit('game_created', { gameId: gameId });
  });

  // När en spelare vill gå med i ett befintligt spel
  socket.on('join_game', (data) => {
    const game = activeGames[data.gameId];

    // Felhantering
    if (!game) return socket.emit('error_message', 'Game not found.');
    if (game.players.length >= 2) return socket.emit('error_message', 'Game is full.');

    console.log(`Spelare ${socket.id} (${data.username}) gick med i spel: ${data.gameId}`);

    // Anslut spelaren till rummet och lägg till i spelobjektet
    socket.join(data.gameId); // NY: Spara userId som id i players-arrayen
    game.players.push({ id: socket.userId, username: data.username, socketId: socket.id, userId: socket.userId });

    // --- Initiera spelets state baserat på gameType ---
    if (game.gameType === '501') {
      game.gameState = {
        scores: {
          [game.players[0].id]: 501,
          [game.players[1].id]: 501,
        },
        currentPlayerId: game.players[0].id, // Spelare 1 börjar (id är nu userId)
        winner: null,
        lastMessage: `Game starts! It's ${game.players[0].username}'s turn.`
      };
    } else if (game.gameType === 'cricket') {
      const initialHits = { 20: 0, 19: 0, 18: 0, 17: 0, 16: 0, 15: 0, 25: 0 };
      game.gameState = {
        scores: {
          [game.players[0].id]: 0,
          [game.players[1].id]: 0,
        },
        hits: {
          [game.players[0].id]: { ...initialHits },
          [game.players[1].id]: { ...initialHits },
        },
        closed: { ...initialHits },
        currentPlayerId: game.players[0].id, // Spelare 1 börjar (id är nu userId)
        winner: null,
        lastMessage: `Cricket game starts! It's ${game.players[0].username}'s turn.`
      };
    }
    // TODO: Lägg till initial state för andra speltyper som 'cricket'

    // Meddela båda spelarna att spelet startar
    // Använd en liten fördröjning så att klienten hinner navigera till spelsidan
    setTimeout(() => {
      io.to(data.gameId).emit('game_start', game);
    }, 500);
  });

  // --- MATCHMAKING-LOGIK ---
  socket.on('find_match', (data) => {
    const { gameType, userId, username } = data;
    
    // Ta bort spelaren från eventuella andra köer för att undvika dubbletter
    Object.keys(matchmakingQueue).forEach(type => {
        matchmakingQueue[type] = matchmakingQueue[type].filter(p => p.userId !== userId);
    });

    const queue = matchmakingQueue[gameType];

    if (queue.length > 0) {
        // En motståndare hittades!
        const opponent = queue.shift(); // Ta ut den första spelaren ur kön

        const gameId = Math.random().toString(36).substring(2, 8).toUpperCase(); // NY: Använd userId som id i players-arrayen
        const player1 = { id: opponent.userId, username: opponent.username, socketId: opponent.socketId, userId: opponent.userId };
        const player2 = { id: userId, username: username, socketId: socket.id, userId: userId };

        activeGames[gameId] = {
            gameId: gameId,
            gameType: gameType,
            players: [player1, player2],
            gameState: null
        };

        // Anslut båda spelarna till rummet
        const opponentSocket = io.sockets.sockets.get(opponent.socketId);
        if (opponentSocket) opponentSocket.join(gameId);
        socket.join(gameId);

        // Initiera och starta spelet (återanvänd logik från join_game)
        initializeAndStartGame(gameId, io, activeGames);

    } else {
        // Ingen motståndare, lägg spelaren i kön
        queue.push({ socketId: socket.id, userId, username });
        socket.emit('waiting_for_match');
    }
  });

  socket.on('create_bot_game', (data) => {
    const { gameType, userId, username } = data;

    const gameId = Math.random().toString(36).substring(2, 8).toUpperCase();
    const player1 = { id: userId, username: username, socketId: socket.id, userId: userId };
    const player2 = { id: BOT_USER_ID, username: BOT_USERNAME, isBot: true, userId: BOT_USER_ID };

    activeGames[gameId] = {
        gameId: gameId,
        gameType: gameType,
        players: [player1, player2],
        gameState: null
    };

    socket.join(gameId);

    // Spelet kan starta direkt eftersom boten alltid är "redo"
    initializeAndStartGame(gameId, io, activeGames);
  });

  socket.on('cancel_find_match', () => {
    let wasCancelled = false;
    Object.keys(matchmakingQueue).forEach(type => {
        const initialLength = matchmakingQueue[type].length;
        matchmakingQueue[type] = matchmakingQueue[type].filter(p => p.socketId !== socket.id);
        if (matchmakingQueue[type].length < initialLength) wasCancelled = true;
    });
    if (wasCancelled) socket.emit('matchmaking_cancelled');
  });

  // --- DIREKTA UTMANINGAR ---
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

  socket.on('accept_game_invite', ({ inviteId }) => {
    const invite = pendingInvites[inviteId];
    if (!invite || socket.id !== invite.to.socketId) return;

    const gameId = Math.random().toString(36).substring(2, 8).toUpperCase();
    const player1 = { id: invite.from.userId, username: invite.from.username, socketId: invite.from.socketId, userId: invite.from.userId };
    const player2 = { id: socket.userId, username: socket.username, socketId: socket.id, userId: socket.userId };

    activeGames[gameId] = {
        gameId: gameId,
        gameType: invite.gameType,
        players: [player1, player2],
        gameState: null
    };

    const challengerSocket = io.sockets.sockets.get(invite.from.socketId);
    if (challengerSocket) challengerSocket.join(gameId);
    socket.join(gameId);

    initializeAndStartGame(gameId, io, activeGames);
    delete pendingInvites[inviteId];
  });

  socket.on('decline_game_invite', ({ inviteId }) => {
    const invite = pendingInvites[inviteId];
    if (!invite || socket.id !== invite.to.socketId) return;


    const challengerSocket = io.sockets.sockets.get(invite.from.socketId);
    if (challengerSocket) {
        challengerSocket.emit('invite_declined', { fromUsername: socket.username });
    }
    delete pendingInvites[inviteId];
  });

  // --- SPELLOGIK: När en spelare skickar in poäng ---
  socket.on('submit_score', (data) => {
    const { gameId, points } = data;
    const game = activeGames[gameId];

    // --- Validering ---
    if (!game || !game.gameState) return;
    if (socket.userId !== game.gameState.currentPlayerId) { // NY: Jämför med userId
      return socket.emit('error_message', "It's not your turn."); // Inte denna spelares tur
    }

    const currentPlayerId = game.gameState.currentPlayerId;
    const currentScore = game.gameState.scores[currentPlayerId];
    const newScore = currentScore - points;

    // --- Spellogik (501) på servern ---
    if (newScore < 2 && newScore !== 0) { // Bust (övertrassering)
      game.gameState.lastMessage = `BUST! Score resets to ${currentScore}.`;
    } else if (newScore === 0) { // Vinst
      game.gameState.scores[currentPlayerId] = 0;
      game.gameState.winner = currentPlayerId;
      const winnerUsername = game.players.find(p => p.id === currentPlayerId).username;
      game.gameState.lastMessage = `WINNER! ${winnerUsername} wins the game!`;
      saveMatchResult(game); // SPARA MATCHEN
    } else { // Normalt kast
      game.gameState.scores[currentPlayerId] = newScore;
      game.gameState.lastMessage = `Good throw! ${newScore} remaining.`;
    }

    // Byt tur (om ingen har vunnit)
    if (!game.gameState.winner) {
      const currentPlayerIndex = game.players.findIndex(p => p.id === currentPlayerId); // NY: Använd p.id (som nu är userId)
      const nextPlayer = game.players[1 - currentPlayerIndex];
      game.gameState.currentPlayerId = nextPlayer.id;
      game.gameState.lastMessage += ` Now it's ${nextPlayer.username}'s turn.`;

      // --- NYTT: Trigga botens tur ---
      if (nextPlayer.isBot) {
        setTimeout(() => {
            executeBotTurn(gameId, io);
        }, 1500); // Vänta 1.5s för att simulera att boten "tänker"
      }
    }

    // Skicka det uppdaterade spelet till ALLA i rummet
    io.to(gameId).emit('game_state_update', game.gameState);
  });



  // --- SPELLOGIK: När en spelare skickar in ett Cricket-kast ---
  socket.on('submit_cricket_throw', (data) => {
    const { gameId, target, multiplier } = data;
    const game = activeGames[gameId];

    // Validering
    if (!game || !game.gameState) return;
    if (socket.userId !== game.gameState.currentPlayerId) { // NY: Jämför med userId
      return socket.emit('error_message', "It's not your turn.");
    }

    const numTarget = parseInt(target);
    const numMultiplier = parseInt(multiplier);
    const currentPlayerId = game.gameState.currentPlayerId;
    const opponentId = game.players.find(p => p.id !== currentPlayerId).id; // NY: Använd p.id (som nu är userId)

    const currentPlayerState = game.gameState;
    const opponentState = {
        hits: game.gameState.hits[opponentId],
        score: game.gameState.scores[opponentId]
    };

    // Uppdatera träffar
    const previousHits = currentPlayerState.hits[currentPlayerId][numTarget];
    currentPlayerState.hits[currentPlayerId][numTarget] += numMultiplier;

    // Poänglogik
    if (previousHits >= 3) { // Om spelaren redan hade stängt numret
        if (opponentState.hits[numTarget] < 3) { // Och motståndaren inte har det
            currentPlayerState.scores[currentPlayerId] += numTarget * numMultiplier;
        }
    } else if (currentPlayerState.hits[currentPlayerId][numTarget] >= 3) { // Om spelaren stänger numret nu
        if (opponentState.hits[numTarget] < 3) { // Och motståndaren inte har det
            const pointsToAdd = (currentPlayerState.hits[currentPlayerId][numTarget] - 3) * numTarget;
            currentPlayerState.scores[currentPlayerId] += pointsToAdd;
        }
    }

    // Kontrollera vinnare
    const CRICKET_TARGETS = [20, 19, 18, 17, 16, 15, 25];
    const allClosedByCurrent = CRICKET_TARGETS.every(t => currentPlayerState.hits[currentPlayerId][t] >= 3);
    if (allClosedByCurrent && currentPlayerState.scores[currentPlayerId] >= opponentState.score) {
        currentPlayerState.winner = currentPlayerId;
        const winnerUsername = game.players.find(p => p.id === currentPlayerId).username;
        currentPlayerState.lastMessage = `WINNER! ${winnerUsername} wins the game!`;
        saveMatchResult(game); // SPARA MATCHEN
    } else {
        // Byt tur
        const nextPlayer = game.players.find(p => p.id !== currentPlayerId); // NY: Använd p.id (som nu är userId)
        currentPlayerState.currentPlayerId = nextPlayer.id;
        currentPlayerState.lastMessage = `It's now ${nextPlayer.username}'s turn.`;
    }

    io.to(gameId).emit('game_state_update', currentPlayerState);
  });

  // --- NYTT: Turneringsmatch-logik ---
  socket.on('start_tournament_match', async ({ tournamentId, matchId }) => {
    try {
        const Tournament = mongoose.model('Tournament');
        const User = mongoose.model('User');

        const tournament = await Tournament.findById(tournamentId);
        if (!tournament) return socket.emit('error_message', 'Tournament not found.');

        const match = tournament.bracket.rounds.flat().find(m => m.matchId.toString() === matchId);
        if (!match || match.players.length === 0) return socket.emit('error_message', 'Match is not ready or has no players.');

        // --- NY LOGIK FÖR ATT HANTERA BÅDE SPELARE OCH BOTTAR ---
        const getPlayerObject = async (playerId) => {
            if (playerId.toString() === BOT_USER_ID) {
                return { id: BOT_USER_ID, username: BOT_USERNAME, isBot: true, userId: BOT_USER_ID };
            }
            const userDoc = await User.findById(playerId).select('username');
            if (!userDoc) return null;
            return { id: userDoc._id.toString(), username: userDoc.username, socketId: onlineUsers[userDoc._id.toString()], userId: userDoc._id.toString() };
        };

        const player1 = await getPlayerObject(match.players[0]);
        // Hantera matcher med bara en spelare (mot en bot som ska läggas till) eller en bye
        let player2 = null;
        if (match.players.length > 1) {
            player2 = await getPlayerObject(match.players[1]);
        } else if (match.players.length === 1) {
            // Om bara en spelare finns, är motståndaren en bot
            player2 = { id: BOT_USER_ID, username: BOT_USERNAME, isBot: true, userId: BOT_USER_ID };
            // Uppdatera turneringens bracket i databasen för att inkludera boten
            match.players.push(BOT_USER_ID);
        }

        if (!player1 || !player2) {
            // Om en spelare är null och det inte är en bot, avbryt.
            const missingPlayerId = !player1 ? match.players[0] : match.players[1];
            if (missingPlayerId !== BOT_USER_ID) {
               return socket.emit('error_message', `Player with ID ${missingPlayerId} could not be found.`);
            }
        }
        
        // Säkerställ att vi har två spelare innan vi fortsätter
        if (!player1 || !player2) {
            return socket.emit('error_message', 'Could not assemble players for the match.');
        }

        activeGames[matchId] = {
            gameId: matchId,
            gameType: tournament.gameType,
            players: [player1, player2],
            gameState: null,
            tournamentContext: { tournamentId, matchId } // Spara kontexten
        };

        const player1Socket = player1.isBot ? null : io.sockets.sockets.get(player1.socketId);
        const player2Socket = player2.isBot ? null : io.sockets.sockets.get(player2.socketId);

        if (player1Socket) player1Socket.join(matchId);
        if (player2Socket) player2Socket.join(matchId);
        
        // Spara ändringarna i turneringen (om en bot lades till)
        await tournament.save();

        initializeAndStartGame(matchId, io, activeGames);

        // --- NYTT: Trigga botens tur om den börjar ---
        const game = activeGames[matchId];
        console.log(`[Tournament Match] Checking if bot should start. Current player: ${game?.gameState?.currentPlayerId}`);
        if (game && game.gameState && game.gameState.currentPlayerId === BOT_USER_ID) {
            console.log(`[Tournament Match] Bot's turn to start. Triggering executeBotTurn for game ${matchId}.`);
            setTimeout(() => {
                executeBotTurn(gameId, io);
            }, 1500);
        }

    } catch (err) {
        console.error('--- DETAILED ERROR: START TOURNAMENT MATCH ---');
        console.error('Time:', new Date().toISOString());
        console.error('Tournament ID:', tournamentId);
        console.error('Match ID:', matchId);
        console.error('Error Object:', err);
        console.error('--- END DETAILED ERROR ---');
        socket.emit('error_message', `Could not start match. Server error: ${err.message}`);
    }
  });

  // En "listener" för när en användare kopplar från
  socket.on('disconnect', async () => {
    console.log(`Användare ${socket.id} kopplade från.`);

    // --- NYTT: Meddela vänner att användaren är offline ---
    if (socket.userId) {
      try {
        const user = await User.findById(socket.userId).select('friends');
        if (user && user.friends) {
          user.friends.forEach(friendId => {
            const friendSocketId = onlineUsers[friendId.toString()];
            if (friendSocketId) io.to(friendSocketId).emit('friend_offline', { userId: socket.userId });
          });
        }
      } catch (err) { console.error('Error notifying friends about online status:', err); }
    }

    // Ta bort användaren från onlineUsers när de kopplar från
    // Använd det ID vi sparade direkt på socketen för att göra det mer effektivt
    if (socket.userId && onlineUsers[socket.userId]) {
      delete onlineUsers[socket.userId];
      console.log(`User ${socket.userId} is now offline.`);
    }

    // Ta bort spelaren från matchmaking-kön om de kopplar från
    Object.keys(matchmakingQueue).forEach(type => {
        matchmakingQueue[type] = matchmakingQueue[type].filter(p => p.socketId !== socket.id);
    });


    // --- LOGIK FÖR DISCONNECT ---
    // Hitta vilket spel (om något) som den frånkopplade spelaren var med i.
    const gameEntry = Object.entries(activeGames).find(([gameId, game]) =>
      game.players.some(player => player.id === socket.userId) // NY: Jämför med userId
    );

    if (gameEntry) {
      const [gameId, game] = gameEntry;
      // Hitta användarnamnet för den spelare som kopplade från för bättre loggning
      const disconnectedPlayer = game.players.find(p => p.id === socket.id);
      const username = disconnectedPlayer ? disconnectedPlayer.username : 'En spelare';

      console.log(`Spelare ${username} (${socket.id}) lämnade spel ${gameId}. Städar upp.`);

      // Ta bort spelet från minnet
      delete activeGames[gameId];

      // Meddela den andra spelaren i rummet att motståndaren har lämnat.
      // Vi använder 'to(gameId)' för att skicka till alla som är kvar i rummet.
      socket.to(gameId).emit('opponent_disconnected', {
        message: 'Your opponent has disconnected. You win by forfeit!'
      });
    }
  });

  // --- CHATT-LOGIK ---
  socket.on('send_private_message', async ({ recipientId, content }) => {
    const recipientSocketId = onlineUsers[recipientId];
    // Använd det ID vi sparade direkt på socketen, mycket mer pålitligt!
    if (socket.userId) {
        try {
            // Hitta eller skapa konversationen på ett mer robust sätt
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
            console.error('Chat error:', err); // Logga hela felobjektet för mer detaljer
            socket.emit('error_message', 'Could not save or send message.');
        }
    } else {
        socket.emit('error_message', 'Could not send message. Authentication error.');
    }
  });
});



// --- API ROUTES ---
// Se till att dessa rader finns och inte är bortkommenterade.
// De kopplar dina API-endpoints till Express-appen.
app.get('/', (req, res) => {
  res.send('World Online Dart API is running...');
});
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/friends', require('./routes/friendsRoutes')); // NY: Lägg till friends-routes
app.use('/api/posts', require('./routes/postRoutes'));
app.use('/api/chat', require('./routes/chatRoutes'));
app.use('/api/payments', require('./routes/paymentRoutes'));
app.use('/api/tournaments', require('./routes/tournamentRoutes'));

// --- STARTA SERVERN (ROBUST METOD) ---
const startServer = async () => {
  try {
    // Skapa 'uploads'-mappen om den inte finns.
    const uploadsDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir);
      console.log("Created 'uploads' directory for media.");
    }

    // Anslut till MongoDB och vänta på att anslutningen lyckas
    await connectDB();

    const PORT = process.env.PORT || 5000;
    // Starta servern FÖRST när databasen är ansluten
    server.listen(PORT, () => {
      console.log(`Servern körs på http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("FATALT FEL: Kunde inte ansluta till databasen. Servern startar inte.", error.message);
    process.exit(1); // Avsluta processen med en felkod
  }
};

// Kör startfunktionen för att starta hela applikationen
startServer();
