const gameStateManager = require('../services/gameStateManager');

describe('Cricket Game Logic - GameStateManager', () => {
  let gameId;
  let players;
  let mockIo;

  beforeEach(async () => {
    gameId = `test-cricket-game-${Date.now()}`;
    players = [
      { id: 'player1', username: 'Player One' },
      { id: 'player2', username: 'Player Two' },
    ];
    mockIo = {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
    };

    // Manually create a game object to pass to initializeAndStartGame
    const gameSetup = {
        gameId,
        players,
        gameType: 'cricket'
    };
    await gameStateManager.setGame(gameId, gameSetup);
    await gameStateManager.initializeAndStartGame(gameId, mockIo);
  });

  afterEach(async () => {
    await gameStateManager.deleteGame(gameId);
  });

  it('should correctly register a single hit on a cricket number', async () => {
    await gameStateManager.registerThrow(gameId, 'player1', 20, 'S20', mockIo);
    const game = await gameStateManager.getGame(gameId);
    expect(game.gameState.hits.player1[20]).toBe(1);
    expect(game.gameState.scores.player1).toBe(0);
  });

  it('should close a number after three hits (with a triple)', async () => {
    await gameStateManager.registerThrow(gameId, 'player1', 60, 'T20', mockIo);
    const game = await gameStateManager.getGame(gameId);
    expect(game.gameState.hits.player1[20]).toBe(3);
    expect(game.gameState.scores.player1).toBe(0);
  });

  it('should start scoring points after a number is closed', async () => {
    // Player 1 closes 20s
    await gameStateManager.registerThrow(gameId, 'player1', 60, 'T20', mockIo);
    // Player 1 throws another 20
    await gameStateManager.registerThrow(gameId, 'player1', 20, 'S20', mockIo);
    
    const game = await gameStateManager.getGame(gameId);
    expect(game.gameState.hits.player1[20]).toBe(3);
    expect(game.gameState.scores.player1).toBe(20);
  });

  it('should NOT score points if the opponent has also closed the number', async () => {
    // Player 1 closes 20s
    await gameStateManager.setGame(gameId, {
      ...await gameStateManager.getGame(gameId),
      gameState: {
        ... (await gameStateManager.getGame(gameId)).gameState,
        hits: {
          player1: { ... (await gameStateManager.getGame(gameId)).gameState.hits.player1, 20: 3 },
          player2: { ... (await gameStateManager.getGame(gameId)).gameState.hits.player2, 20: 3 }
        }
      }
    });

    await gameStateManager.registerThrow(gameId, 'player1', 20, 'S20', mockIo);
    const game = await gameStateManager.getGame(gameId);
    expect(game.gameState.scores.player1).toBe(0);
  });

  it('should change turns after 3 throws', async () => {
    await gameStateManager.registerThrow(gameId, 'player1', 20, 'S20', mockIo);
    await gameStateManager.registerThrow(gameId, 'player1', 19, 'S19', mockIo);
    await gameStateManager.registerThrow(gameId, 'player1', 18, 'S18', mockIo);

    const game = await gameStateManager.getGame(gameId);
    expect(game.gameState.currentPlayerId).toBe('player2');
  });

  it('should declare a winner when all numbers are closed and score is higher', async () => {
    const game = await gameStateManager.getGame(gameId);
    const cricketNumbers = [15, 16, 17, 18, 19, 20, 25];
    
    // Manually set player1's hits to be closed on all numbers
    cricketNumbers.forEach(num => {
      game.gameState.hits.player1[num] = 3;
    });
    // Give player 1 a higher score
    game.gameState.scores.player1 = 100;
    game.gameState.scores.player2 = 50;
    await gameStateManager.setGame(gameId, game);

    // Make the winning throw (in this case, any valid throw will trigger the check)
    await gameStateManager.registerThrow(gameId, 'player1', 20, 'S20', mockIo);

    const finalGame = await gameStateManager.getGame(gameId);
    expect(finalGame.gameState.winner).toBe('player1');
  });

  it('should NOT declare a winner if score is lower at the moment of closing the last number', async () => {
    const game = await gameStateManager.getGame(gameId);
    const cricketNumbers = [16, 17, 18, 19, 20, 25]; // All but 15
    
    // Close all numbers for player1 except for 15
    cricketNumbers.forEach(num => {
      game.gameState.hits.player1[num] = 3;
    });
    // Set scores so player1 is behind
    game.gameState.scores.player1 = 40;
    game.gameState.scores.player2 = 100;
    await gameStateManager.setGame(gameId, game);

    // Player 1 now closes their last number (15) with a T15. No points should be awarded for this throw.
    await gameStateManager.registerThrow(gameId, 'player1', 45, 'T15', mockIo);

    const finalGame = await gameStateManager.getGame(gameId);
    expect(finalGame.gameState.hits.player1[15]).toBe(3);
    expect(finalGame.gameState.scores.player1).toBe(40); // Score should not change
    expect(finalGame.gameState.winner).toBeNull(); // No winner yet
  });

  it('should register two hits for a double bullseye (D25)', async () => {
    await gameStateManager.registerThrow(gameId, 'player1', 50, 'D25', mockIo);
    const game = await gameStateManager.getGame(gameId);
    expect(game.gameState.hits.player1[25]).toBe(2);
  });
});
