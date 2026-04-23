// Parses a segment identifier into { baseNumber, multiplier }.
// Accepts both the AI-backend style ("single_20", "double_15", "triple_3",
// "bull_50", "bull_25", "miss") and the compact style ("S20", "D15", "T3",
// "D25", "S25"). Returns { baseNumber: 0, multiplier: 0 } if nothing usable
// can be parsed.
function parseSegmentSpec(segment, score) {
  if (segment == null) return { baseNumber: 0, multiplier: 0 };
  const s = String(segment).toLowerCase().trim();
  if (!s || s === 'miss') return { baseNumber: 0, multiplier: 0 };
  if (s === 'bull_50' || s === 'db' || s === 'd25') return { baseNumber: 25, multiplier: 2 };
  if (s === 'bull_25' || s === 'sb' || s === 's25') return { baseNumber: 25, multiplier: 1 };

  let m = s.match(/^(single|double|triple)_(\d+)$/);
  if (m) {
    const mult = m[1] === 'triple' ? 3 : m[1] === 'double' ? 2 : 1;
    return { baseNumber: parseInt(m[2], 10), multiplier: mult };
  }

  m = s.match(/^([tds])(\d+)$/);
  if (m) {
    const mult = m[1] === 't' ? 3 : m[1] === 'd' ? 2 : 1;
    return { baseNumber: parseInt(m[2], 10), multiplier: mult };
  }

  if (typeof score === 'number' && score > 0) {
    return { baseNumber: score, multiplier: 1 };
  }
  return { baseNumber: 0, multiplier: 0 };
}

class GameStateManager {
  constructor() {
    this.storage = new Map();
    this.redisEnabled = process.env.REDIS_ENABLED === 'true';
    this.redisClient = null;

    if (this.redisEnabled) {
      this.initRedis();
    }
  }

  async initRedis() {
    try {
      const redis = require('redis');
      this.redisClient = redis.createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379',
      });

      this.redisClient.on('error', (err) => {
        console.error('[Redis] Error:', err);
        this.redisEnabled = false;
      });

      await this.redisClient.connect();
      console.log('[Redis] Connected successfully');
    } catch (err) {
      console.error('[Redis] Failed to connect:', err);
      this.redisEnabled = false;
    }
  }

  async setGame(gameId, gameData) {
    if (this.redisEnabled && this.redisClient) {
      try {
        await this.redisClient.setEx(
          `game:${gameId}`,
          7200,
          JSON.stringify(gameData)
        );
      } catch (err) {
        console.error('[GameState] Redis set error:', err);
        this.storage.set(gameId, gameData);
      }
    } else {
      this.storage.set(gameId, gameData);
    }
  }

  async getGame(gameId) {
    if (this.redisEnabled && this.redisClient) {
      try {
        const data = await this.redisClient.get(`game:${gameId}`);
        return data ? JSON.parse(data) : null;
      } catch (err) {
        console.error('[GameState] Redis get error:', err);
        return this.storage.get(gameId) || null;
      }
    } else {
      return this.storage.get(gameId) || null;
    }
  }

  async deleteGame(gameId) {
    if (this.redisEnabled && this.redisClient) {
      try {
        await this.redisClient.del(`game:${gameId}`);
      } catch (err) {
        console.error('[GameState] Redis delete error:', err);
      }
    }
    this.storage.delete(gameId);
  }

  async getAllGames() {
    if (this.redisEnabled && this.redisClient) {
      try {
        const keys = await this.redisClient.keys('game:*');
        const games = {};
        for (const key of keys) {
          const gameId = key.replace('game:', '');
          const data = await this.redisClient.get(key);
          games[gameId] = JSON.parse(data);
        }
        return games;
      } catch (err) {
        console.error('[GameState] Redis getAllGames error:', err);
        return Object.fromEntries(this.storage);
      }
    } else {
      return Object.fromEntries(this.storage);
    }
  }

  async registerThrow(gameId, playerId, score, segment, io) {
    const game = await this.getGame(gameId);
    if (!game || !game.gameState || game.gameState.winner) {
      console.log(`[GameState] Throw registered for inactive game ${gameId}. Ignoring.`);
      return;
    }

    const { gameState, gameType, players } = game;
    const { currentPlayerId } = gameState;

    if (String(playerId) !== String(currentPlayerId)) {
      console.log(`[GameState] Player ${playerId} threw out of turn in game ${gameId} (Current: ${currentPlayerId}). Ignoring.`);
      return;
    }
    
    // --- '501' Game Logic ---
    if (gameType === '501') {
      const playerUsername = players.find(p => String(p.id) === String(playerId)).username;
      const playerThrows = gameState.throwHistory[playerId];
      
      // Prevent more than 3 throws per turn
      if (playerThrows.length % 3 === 0 && playerThrows.length > 0) {
          // This condition might be redundant if turn changes are handled correctly, but good for safety
      }

      playerThrows.push({ score, segment });
      
      const turnThrows = playerThrows.slice(-3);
      const turnScore = turnThrows.reduce((acc, curr) => acc + curr.score, 0);

      const newScore = gameState.scores[playerId] - score;
      
      const { multiplier: throwMultiplier } = parseSegmentSpec(segment, score);
      let bust = false;
      if (newScore < 0 || newScore === 1) {
        bust = true;
      } else if (newScore === 0 && throwMultiplier !== 2) {
        bust = true;
      }

      if (bust) {
        gameState.lastMessage = `Bust! ${playerUsername}'s score is reset for the turn.`;
        // Turn ends immediately on bust
        const currentPlayerIndex = players.findIndex(p => String(p.id) === String(currentPlayerId));
        const nextPlayerIndex = (currentPlayerIndex + 1) % players.length;
        gameState.currentPlayerId = players[nextPlayerIndex].id;
        gameState.lastMessage += ` Now it's ${players[nextPlayerIndex].username}'s turn.`;

      } else {
        gameState.scores[playerId] = newScore;
        gameState.lastMessage = `${playerUsername} threw a ${segment} for ${score} points.`;
        
        if (newScore === 0) { // Winner!
          gameState.winner = playerId;
          gameState.lastMessage = `Game Over! ${playerUsername} wins!`;
        } else if (playerThrows.length % 3 === 0) { // End of turn
            const currentPlayerIndex = players.findIndex(p => String(p.id) === String(currentPlayerId));
            const nextPlayerIndex = (currentPlayerIndex + 1) % players.length;
            gameState.currentPlayerId = players[nextPlayerIndex].id;
            gameState.lastMessage += ` Now it's ${players[nextPlayerIndex].username}'s turn.`;
        }
      }
    }
    
    // --- Cricket logic ---
    else if (gameType === 'cricket') {
      const playerState = gameState.hits[playerId];
      const opponentId = players.find(p => String(p.id) !== String(playerId)).id;
      const opponentState = gameState.hits[opponentId];
      const playerUsername = players.find(p => String(p.id) === String(playerId)).username;

      const { baseNumber, multiplier } = parseSegmentSpec(segment, score);
      const CRICKET_NUMBERS = [15, 16, 17, 18, 19, 20, 25];

      if (CRICKET_NUMBERS.includes(baseNumber)) {
        const currentHits = playerState[baseNumber];
        
        if (currentHits < 3) {
          const hitsToAdd = Math.min(3 - currentHits, multiplier);
          playerState[baseNumber] += hitsToAdd;
          gameState.lastMessage = `${playerUsername} hit ${segment} and now has ${playerState[baseNumber]} hit(s) on ${baseNumber}.`;
        }

        const scoringMultiplier = multiplier - Math.max(0, 3 - currentHits);
        if (scoringMultiplier > 0) {
            const opponentHits = opponentState[baseNumber];
            if (opponentHits < 3) {
                const pointsScored = baseNumber * scoringMultiplier;
                gameState.scores[playerId] += pointsScored;
                gameState.lastMessage = `${playerUsername} scored ${pointsScored} points!`;
            } else {
                gameState.lastMessage = `${playerUsername} hit ${segment}, but ${players.find(p=>String(p.id) === String(opponentId)).username} has it closed. No points.`;
            }
        }
        
        // Check for winner
        const playerHasAllClosed = CRICKET_NUMBERS.every(num => playerState[num] === 3);
        if (playerHasAllClosed && gameState.scores[playerId] >= gameState.scores[opponentId]) {
          gameState.winner = playerId;
          gameState.lastMessage = `Game Over! ${playerUsername} wins by closing all numbers and having the higher score!`;
        }
      } else {
        gameState.lastMessage = `${playerUsername} threw a ${segment} for ${score} points. Not a cricket number.`;
      }

      // Handle turn change if no winner yet
      if (!gameState.winner) {
        gameState.throwHistory[playerId].push({ score, segment });
        if (gameState.throwHistory[playerId].length % 3 === 0) {
          const currentPlayerIndex = players.findIndex(p => String(p.id) === String(currentPlayerId));
          const nextPlayerIndex = (currentPlayerIndex + 1) % players.length;
          gameState.currentPlayerId = players[nextPlayerIndex].id;
          gameState.lastMessage += ` Now it's ${players[nextPlayerIndex].username}'s turn.`;
        }
      }
    }
    // --- 301 DIDO logic ---
    else if (gameType === '301_dido') {
        const playerUsername = players.find(p => String(p.id) === String(playerId)).username;
        const { multiplier: throwMultiplier } = parseSegmentSpec(segment, score);
        const isDouble = throwMultiplier === 2;
        let bust = false;

        // --- Double In Logic ---
        if (!gameState.isIn[playerId]) {
            if (isDouble) {
                gameState.isIn[playerId] = true;
                gameState.scores[playerId] -= score;
                gameState.lastMessage = `${playerUsername} is in! Score: ${gameState.scores[playerId]}`;
            } else {
                gameState.lastMessage = `${playerUsername} needs a double to get in. Throw ignored.`;
            }
            gameState.throwHistory[playerId].push({ score, segment });
        } else {
            // --- Standard Scoring (already in) ---
            const newScore = gameState.scores[playerId] - score;

            if (newScore < 0 || newScore === 1 || (newScore === 0 && !isDouble)) {
                bust = true;
            }

            if (bust) {
                gameState.scores[playerId] = gameState.scoreAtStartOfTurn[playerId];
                gameState.lastMessage = `Bust! ${playerUsername}'s score is reset for the turn.`;
                
                // End turn immediately
                const currentPlayerIndex = players.findIndex(p => String(p.id) === String(currentPlayerId));
                const nextPlayerIndex = (currentPlayerIndex + 1) % players.length;
                const nextPlayerId = players[nextPlayerIndex].id;
                gameState.currentPlayerId = nextPlayerId;
                gameState.scoreAtStartOfTurn[nextPlayerId] = gameState.scores[nextPlayerId];
                gameState.lastMessage += ` Now it's ${players[nextPlayerIndex].username}'s turn.`;
            } else {
                gameState.scores[playerId] = newScore;
                gameState.lastMessage = `${playerUsername} threw a ${segment} for ${score} points.`;
                gameState.throwHistory[playerId].push({ score, segment });
                
                if (newScore === 0) { // Winner!
                    gameState.winner = playerId;
                    gameState.lastMessage = `Game Over! ${playerUsername} wins with a double out!`;
                }
            }
        }

        // --- Handle Turn Change (if no bust/win) ---
        if (!bust && !gameState.winner && gameState.throwHistory[playerId].length % 3 === 0) {
            const currentPlayerIndex = players.findIndex(p => String(p.id) === String(currentPlayerId));
            const nextPlayerIndex = (currentPlayerIndex + 1) % players.length;
            const nextPlayerId = players[nextPlayerIndex].id;
            gameState.currentPlayerId = nextPlayerId;
            gameState.scoreAtStartOfTurn[nextPlayerId] = gameState.scores[nextPlayerId];
            gameState.lastMessage += ` Now it's ${players[nextPlayerIndex].username}'s turn.`;
        }
    }
    // --- Bob's 27 logic ---
    else if (gameType === 'bobs_27') {
      const playerUsername = players.find(p => String(p.id) === String(playerId)).username;

      const { baseNumber, multiplier } = parseSegmentSpec(segment, score);
      const target = gameState.currentTarget;
      const targetValue = target * 2;

      let hit = false;
      if (multiplier === 2 && baseNumber === target) {
        hit = true;
      }

      if (hit) {
        gameState.score += targetValue;
        gameState.lastMessage = `Hit D${target}! Score is now ${gameState.score}.`;
      } else {
        gameState.score -= targetValue;
        gameState.lastMessage = `Missed D${target}. Score is now ${gameState.score}.`;
      }

      gameState.throwHistory[playerId].push({ score, segment });

      // Check for game over by score
      if (gameState.score <= 0) {
        gameState.winner = 'player_lost';
        gameState.lastMessage = `Game over! ${playerUsername}'s score fell to or below zero.`;
      }

      // Check for turn/target change
      if (!gameState.winner && gameState.throwHistory[playerId].length % 3 === 0) {
        if (gameState.currentTarget === 20) {
            gameState.currentTarget = 25; // Bullseye is next
            gameState.lastMessage += ` Next target: Double Bull.`;
        } else if (gameState.currentTarget === 25) {
            // Game finished successfully
            gameState.winner = 'practice_complete';
            gameState.lastMessage = `Bob's 27 complete! Final score: ${gameState.score}.`;
        } else {
            gameState.currentTarget++;
            gameState.lastMessage += ` Next target: D${gameState.currentTarget}.`;
        }
      }
    }

    await this.setGame(gameId, game);
    
    const gameDataForClient = { 
      ...game, 
      players: game.players.map(p => ({ id: p.id, username: p.username })) 
    };
    io.to(gameId).emit('game_state_update', gameDataForClient);

    console.log(`[GameState] Updated game ${gameId} after throw from ${playerId}.`);
    return game;
  }

  async setQueue(gameType, queueData) {
    const key = `queue:${gameType}`;
    if (this.redisEnabled && this.redisClient) {
      try {
        await this.redisClient.setEx(key, 3600, JSON.stringify(queueData));
      } catch (err) {
        console.error('[GameState] Redis queue set error:', err);
        this.storage.set(key, queueData);
      }
    } else {
      this.storage.set(key, queueData);
    }
  }

  async getQueue(gameType) {
    const key = `queue:${gameType}`;
    if (this.redisEnabled && this.redisClient) {
      try {
        const data = await this.redisClient.get(key);
        return data ? JSON.parse(data) : [];
      } catch (err) {
        console.error('[GameState] Redis queue get error:', err);
        return this.storage.get(key) || [];
      }
    } else {
      return this.storage.get(key) || [];
    }
  }

  async initializeAndStartGame(gameId, io) {
    const game = await this.getGame(gameId);
    // Allow single-player for practice modes like bobs_27
    const isPracticeMode = game && ['bobs_27'].includes(game.gameType);
    const minPlayers = isPracticeMode ? 1 : 2;

    if (!game || !game.players || game.players.length < minPlayers) {
      console.error(`[GameState] Cannot start game ${gameId}: Not found or not enough players for mode ${game?.gameType}.`);
      return;
    }

    if (game.gameType === '501') {
        game.gameState = {
            scores: { [game.players[0].id]: 501, [game.players[1].id]: 501 },
            currentPlayerId: game.players[0].id,
            winner: null,
            lastMessage: `Game starts! It's ${game.players[0].username}'s turn.`,
            throwHistory: { [game.players[0].id]: [], [game.players[1].id]: [] }
        };
    } else if (game.gameType === 'cricket') {
        const initialHits = { 20: 0, 19: 0, 18: 0, 17: 0, 16: 0, 15: 0, 25: 0 };
        game.gameState = {
            scores: { [game.players[0].id]: 0, [game.players[1].id]: 0 },
            hits: {
                [game.players[0].id]: { ...initialHits },
                [game.players[1].id]: { ...initialHits },
            },
            currentPlayerId: game.players[0].id,
            winner: null,
            lastMessage: `Cricket game starts! It's ${game.players[0].username}'s turn.`,
            throwHistory: { [game.players[0].id]: [], [game.players[1].id]: [] }
        };
    } else if (game.gameType === '301_dido') {
        const player1Id = game.players[0].id;
        const player2Id = game.players[1].id;
        game.gameState = {
            scores: { [player1Id]: 301, [player2Id]: 301 },
            isIn: { [player1Id]: false, [player2Id]: false },
            scoreAtStartOfTurn: { [player1Id]: 301, [player2Id]: 301 },
            currentPlayerId: player1Id,
            winner: null,
            lastMessage: `301 DIDO starts! ${game.players[0].username} needs a double to get in.`,
            throwHistory: { [player1Id]: [], [player2Id]: [] }
        };
    } else if (game.gameType === 'bobs_27') {
        game.gameState = {
            score: 27,
            currentPlayerId: game.players[0].id,
            winner: null,
            currentTarget: 1, // Start with Double 1
            throwHistory: { [game.players[0].id]: [] },
            lastMessage: `Bob's 27 practice starts! Aim for D1.`
        };
    }

    await this.setGame(gameId, game);

    // Skicka en renare version av spelobjektet till klienten
    const gameDataForClient = { 
      ...game, 
      players: game.players.map(p => ({ id: p.id, username: p.username })) 
    };
    io.to(gameId).emit('game_start', gameDataForClient);
    console.log(`[GameState] Game ${gameId} (${game.gameType}) has been initialized and started.`);
  }
}

module.exports = new GameStateManager();
