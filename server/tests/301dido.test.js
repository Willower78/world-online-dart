const gameStateManager = require('../services/gameStateManager');

describe('301 DIDO Game Logic - GameStateManager', () => {
  let gameId;
  let players;
  let mockIo;

  beforeEach(async () => {
    gameId = `test-301dido-game-${Date.now()}`;
    players = [
      { id: 'player1', username: 'Player One' },
      { id: 'player2', username: 'Player Two' },
    ];
    mockIo = {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
    };

    const gameSetup = {
        gameId,
        players,
        gameType: '301_dido'
    };
    await gameStateManager.setGame(gameId, gameSetup);
    await gameStateManager.initializeAndStartGame(gameId, mockIo);
  });

  afterEach(async () => {
    await gameStateManager.deleteGame(gameId);
  });

  it('should initialize with scores at 301 and "isIn" as false for all players', async () => {
    const game = await gameStateManager.getGame(gameId);
    expect(game.gameState.scores.player1).toBe(301);
    expect(game.gameState.scores.player2).toBe(301);
    expect(game.gameState.isIn.player1).toBe(false);
    expect(game.gameState.isIn.player2).toBe(false);
    expect(game.gameState.currentPlayerId).toBe('player1');
  });

  it('should require a double to "get in" and only count double throws when not in', async () => {
    // Player 1 throws S20 (not a double)
    await gameStateManager.registerThrow(gameId, 'player1', 20, 'S20', mockIo);
    let game = await gameStateManager.getGame(gameId);
    expect(game.gameState.scores.player1).toBe(301); // Score should not change
    expect(game.gameState.isIn.player1).toBe(false);
    expect(game.gameState.lastMessage).toContain('needs a double to get in');
    expect(game.gameState.currentPlayerId).toBe('player1'); // Turn not changed yet for first throw of turn

    // Player 1 throws D10 (double)
    await gameStateManager.registerThrow(gameId, 'player1', 20, 'D10', mockIo);
    game = await gameStateManager.getGame(gameId);
    expect(game.gameState.scores.player1).toBe(301 - 20); // Score should update
    expect(game.gameState.isIn.player1).toBe(true);
    expect(game.gameState.lastMessage).toContain('is in!');
  });

  it('should score normally after getting in', async () => {
    // Player 1 gets in with D20 (40 points)
    await gameStateManager.registerThrow(gameId, 'player1', 40, 'D20', mockIo);
    // Player 1 throws S20
    await gameStateManager.registerThrow(gameId, 'player1', 20, 'S20', mockIo);
    let game = await gameStateManager.getGame(gameId);
    expect(game.gameState.scores.player1).toBe(301 - 40 - 20); // 241
  });

  it('should bust and reset score if score goes below 0 or equals 1', async () => {
    // Player 1 gets in with D1 (2 points), score 299
    await gameStateManager.registerThrow(gameId, 'player1', 2, 'D1', mockIo);
    let game = await gameStateManager.getGame(gameId);
    expect(game.gameState.scores.player1).toBe(299);
    
    game.gameState.scores.player1 = 20;
    game.gameState.scoreAtStartOfTurn.player1 = 20; // Manually update this too
    await gameStateManager.setGame(gameId, game);

    // Player 1 throws S20 (score becomes 0, but not a double out)
    await gameStateManager.registerThrow(gameId, 'player1', 20, 'S20', mockIo);
    game = await gameStateManager.getGame(gameId);
    expect(game.gameState.scores.player1).toBe(20); // Score should be reset to start of turn
    expect(game.gameState.lastMessage).toContain('Bust!');
    expect(game.gameState.currentPlayerId).toBe('player2'); // Turn should pass
  });

  it('should bust and reset score if score goes to 0 but is not a double', async () => {
    // Player 1 gets in
    await gameStateManager.registerThrow(gameId, 'player1', 40, 'D20', mockIo);
    let game = await gameStateManager.getGame(gameId);
    
    // Set score to be 20, player throws S20
    game.gameState.scores.player1 = 20;
    game.gameState.scoreAtStartOfTurn.player1 = 20; // Manually update this too
    await gameStateManager.setGame(gameId, game);
    await gameStateManager.registerThrow(gameId, 'player1', 20, 'S20', mockIo);
    
    game = await gameStateManager.getGame(gameId);
    expect(game.gameState.scores.player1).toBe(20); // Score reset
    expect(game.gameState.lastMessage).toContain('Bust!');
    expect(game.gameState.currentPlayerId).toBe('player2');
  });

  it('should win only by hitting a double that brings score to 0', async () => {
    // Player 1 gets in
    await gameStateManager.registerThrow(gameId, 'player1', 40, 'D20', mockIo);
    let game = await gameStateManager.getGame(gameId);
    
    // Set score to be 40, player throws D20
    game.gameState.scores.player1 = 40;
    await gameStateManager.setGame(gameId, game);
    await gameStateManager.registerThrow(gameId, 'player1', 40, 'D20', mockIo);
    
    game = await gameStateManager.getGame(gameId);
    expect(game.gameState.scores.player1).toBe(0);
    expect(game.gameState.winner).toBe('player1');
    expect(game.gameState.lastMessage).toContain('wins with a double out!');
  });

  it('should change turns after 3 throws (after getting in)', async () => {
    // Player 1 gets in with D20 (40 points), score 261
    await gameStateManager.registerThrow(gameId, 'player1', 40, 'D20', mockIo);
    // Player 1 throws S20 (score 241)
    await gameStateManager.registerThrow(gameId, 'player1', 20, 'S20', mockIo);
    // Player 1 throws S10 (score 231)
    await gameStateManager.registerThrow(gameId, 'player1', 10, 'S10', mockIo);
    
    const game = await gameStateManager.getGame(gameId);
    expect(game.gameState.currentPlayerId).toBe('player2');
    expect(game.gameState.scores.player1).toBe(231);
    expect(game.gameState.scoreAtStartOfTurn.player2).toBe(301); // Player 2's score should be saved
  });

  it('should save score at start of turn for bust handling', async () => {
    // Player 1 gets in with D20 (40 points), score 261
    await gameStateManager.registerThrow(gameId, 'player1', 40, 'D20', mockIo); // Turn 1, throw 1
    // Player 1 throws S20 (score 241)
    await gameStateManager.registerThrow(gameId, 'player1', 20, 'S20', mockIo); // Turn 1, throw 2
    // Player 1 throws S10 (score 231)
    await gameStateManager.registerThrow(gameId, 'player1', 10, 'S10', mockIo); // Turn 1, throw 3 (turn passes)
    
    // Player 2's turn. Score at start of turn should be 301.
    let game = await gameStateManager.getGame(gameId);
    expect(game.gameState.currentPlayerId).toBe('player2');
    expect(game.gameState.scoreAtStartOfTurn.player2).toBe(301);

    // Player 2 tries to get in with S20 (miss)
    await gameStateManager.registerThrow(gameId, 'player2', 20, 'S20', mockIo); // Turn 2, throw 1
    game = await gameStateManager.getGame(gameId);
    expect(game.gameState.scores.player2).toBe(301); // Score still 301
    expect(game.gameState.scoreAtStartOfTurn.player2).toBe(301); // Score at start of turn still 301
  });
});
