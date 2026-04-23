const gameStateManager = require('../services/gameStateManager');

describe('Bob\'s 27 Game Logic - GameStateManager', () => {
  let gameId;
  let player;
  let mockIo;

  beforeEach(async () => {
    gameId = `test-bobs27-game-${Date.now()}`;
    player = { id: 'player1', username: 'Player One' };
    mockIo = {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
    };

    const gameSetup = {
        gameId,
        players: [player],
        gameType: 'bobs_27'
    };
    await gameStateManager.setGame(gameId, gameSetup);
    await gameStateManager.initializeAndStartGame(gameId, mockIo);
  });

  afterEach(async () => {
    await gameStateManager.deleteGame(gameId);
  });

  it('should initialize with score 27 and target D1', async () => {
    const game = await gameStateManager.getGame(gameId);
    expect(game.gameState.score).toBe(27);
    expect(game.gameState.currentTarget).toBe(1);
    expect(game.gameState.currentPlayerId).toBe(player.id);
  });

  it('should add score if target double is hit', async () => {
    // Initial score 27, target D1
    await gameStateManager.registerThrow(gameId, player.id, 2, 'D1', mockIo); // Hit D1 (1*2=2 points)
    const game = await gameStateManager.getGame(gameId);
    expect(game.gameState.score).toBe(27 + (1 * 2)); // 29
    expect(game.gameState.currentTarget).toBe(1); // Target remains 1 until end of turn
  });

  it('should subtract score if target double is missed', async () => {
    // Initial score 27, target D1
    await gameStateManager.registerThrow(gameId, player.id, 1, 'S1', mockIo); // Miss D1, hit S1 (1*2=2 points subtracted)
    const game = await gameStateManager.getGame(gameId);
    expect(game.gameState.score).toBe(27 - (1 * 2)); // 25
    expect(game.gameState.currentTarget).toBe(1); // Target remains 1 until end of turn
  });

  it('should change target and turn after 3 throws, regardless of hit/miss', async () => {
    // 3 throws for D1
    await gameStateManager.registerThrow(gameId, player.id, 2, 'D1', mockIo); // Hit D1, score +2, total 29
    await gameStateManager.registerThrow(gameId, player.id, 1, 'S1', mockIo); // Miss D1, score -2, total 27
    await gameStateManager.registerThrow(gameId, player.id, 3, 'D3', mockIo); // Miss D1, score -2, total 25

    const game = await gameStateManager.getGame(gameId);
    expect(game.gameState.score).toBe(27 - 2 + 2 - 2); // 25
    expect(game.gameState.currentTarget).toBe(2); // Should move to D2
    expect(game.gameState.throwHistory[player.id].length).toBe(3); // Should have 3 throws
  });

  it('should end game if score drops to 0 or below', async () => {
    let game = await gameStateManager.getGame(gameId);
    // Artificially set score to be close to bust
    game.gameState.score = 2; // Target D1. If missed, score becomes 2 - 2 = 0
    await gameStateManager.setGame(gameId, game);

    await gameStateManager.registerThrow(gameId, player.id, 1, 'S1', mockIo); // Miss D1
    
    game = await gameStateManager.getGame(gameId);
    expect(game.gameState.score).toBe(0);
    expect(game.gameState.winner).toBe('player_lost');
    expect(game.gameState.lastMessage).toContain('score fell to or below zero');
  });

  it('should progress through targets D1 to D20 and then D25 (Bull)', async () => {
    let game = await gameStateManager.getGame(gameId);
    game.gameState.score = 100; // Give high score to avoid bust
    await gameStateManager.setGame(gameId, game);

    for (let i = 1; i <= 20; i++) {
        // Assume player hits D(i) once and misses twice
        await gameStateManager.registerThrow(gameId, player.id, i * 2, `D${i}`, mockIo); // Hit D(i)
        await gameStateManager.registerThrow(gameId, player.id, i * 2, `D${i}`, mockIo); // Hit D(i) again
        await gameStateManager.registerThrow(gameId, player.id, i * 2, `D${i}`, mockIo); // Hit D(i) again
        game = await gameStateManager.getGame(gameId);
        if (i < 20) {
            expect(game.gameState.currentTarget).toBe(i + 1);
        } else {
            expect(game.gameState.currentTarget).toBe(25); // After D20, target becomes D25 (Bull)
        }
        expect(game.gameState.winner).toBeNull();
    }

    // Now at D25 (Bull)
    // Assume player hits D25 once and misses twice
    await gameStateManager.registerThrow(gameId, player.id, 50, 'D25', mockIo);
    await gameStateManager.registerThrow(gameId, player.id, 25, 'S25', mockIo);
    await gameStateManager.registerThrow(gameId, player.id, 1, 'S1', mockIo); // Any throw to complete turn

    game = await gameStateManager.getGame(gameId);
    expect(game.gameState.winner).toBe('practice_complete');
    expect(game.gameState.lastMessage).toContain('Bob\'s 27 complete!');
  });
});
