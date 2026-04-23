const gameStateManager = require('../services/gameStateManager');

// Regression tests: the game state manager must accept both compact segment
// identifiers ("T20", "D15", "D25") and the AI-backend style identifiers
// ("triple_20", "double_15", "bull_50", "bull_25") for every game mode.
describe('Segment format compatibility', () => {
  const mockIo = { to: jest.fn().mockReturnThis(), emit: jest.fn() };
  const players = [
    { id: 'player1', username: 'Player One' },
    { id: 'player2', username: 'Player Two' },
  ];

  describe('Cricket with AI-style segments', () => {
    let gameId;
    beforeEach(async () => {
      gameId = `test-cricket-ai-${Date.now()}-${Math.random()}`;
      await gameStateManager.setGame(gameId, { gameId, players, gameType: 'cricket' });
      await gameStateManager.initializeAndStartGame(gameId, mockIo);
    });
    afterEach(async () => { await gameStateManager.deleteGame(gameId); });

    it('should close a number on triple_20', async () => {
      await gameStateManager.registerThrow(gameId, 'player1', 60, 'triple_20', mockIo);
      const game = await gameStateManager.getGame(gameId);
      expect(game.gameState.hits.player1[20]).toBe(3);
    });

    it('should register a single hit on single_19', async () => {
      await gameStateManager.registerThrow(gameId, 'player1', 19, 'single_19', mockIo);
      const game = await gameStateManager.getGame(gameId);
      expect(game.gameState.hits.player1[19]).toBe(1);
    });

    it('should treat bull_50 as a double bull (two hits on 25)', async () => {
      await gameStateManager.registerThrow(gameId, 'player1', 50, 'bull_50', mockIo);
      const game = await gameStateManager.getGame(gameId);
      expect(game.gameState.hits.player1[25]).toBe(2);
    });

    it('should treat bull_25 as a single bull (one hit on 25)', async () => {
      await gameStateManager.registerThrow(gameId, 'player1', 25, 'bull_25', mockIo);
      const game = await gameStateManager.getGame(gameId);
      expect(game.gameState.hits.player1[25]).toBe(1);
    });
  });

  describe('501 with AI-style segments', () => {
    let gameId;
    beforeEach(async () => {
      gameId = `test-501-ai-${Date.now()}-${Math.random()}`;
      await gameStateManager.setGame(gameId, { gameId, players, gameType: '501' });
      await gameStateManager.initializeAndStartGame(gameId, mockIo);
    });
    afterEach(async () => { await gameStateManager.deleteGame(gameId); });

    it('should accept a double-out using the AI "double_N" segment', async () => {
      const g = await gameStateManager.getGame(gameId);
      g.gameState.scores.player1 = 40;
      await gameStateManager.setGame(gameId, g);
      await gameStateManager.registerThrow(gameId, 'player1', 40, 'double_20', mockIo);
      const after = await gameStateManager.getGame(gameId);
      expect(after.gameState.winner).toBe('player1');
      expect(after.gameState.scores.player1).toBe(0);
    });

    it('should bust when finishing on a non-double single_20 for 20 remaining', async () => {
      const g = await gameStateManager.getGame(gameId);
      g.gameState.scores.player1 = 20;
      await gameStateManager.setGame(gameId, g);
      await gameStateManager.registerThrow(gameId, 'player1', 20, 'single_20', mockIo);
      const after = await gameStateManager.getGame(gameId);
      expect(after.gameState.winner).toBeNull();
      expect(after.gameState.scores.player1).toBe(20); // score was not deducted
    });
  });

  describe("Bob's 27 with AI-style segments", () => {
    let gameId;
    beforeEach(async () => {
      gameId = `test-bobs27-ai-${Date.now()}-${Math.random()}`;
      await gameStateManager.setGame(gameId, { gameId, players: [players[0]], gameType: 'bobs_27' });
      await gameStateManager.initializeAndStartGame(gameId, mockIo);
    });
    afterEach(async () => { await gameStateManager.deleteGame(gameId); });

    it('should score a hit on D1 with "double_1" (27 + 2 = 29)', async () => {
      await gameStateManager.registerThrow(gameId, 'player1', 2, 'double_1', mockIo);
      const game = await gameStateManager.getGame(gameId);
      expect(game.gameState.score).toBe(29);
    });

    it('should count "single_1" as a miss on D1 (27 - 2 = 25)', async () => {
      await gameStateManager.registerThrow(gameId, 'player1', 1, 'single_1', mockIo);
      const game = await gameStateManager.getGame(gameId);
      expect(game.gameState.score).toBe(25);
    });
  });

  describe('301 DIDO with AI-style segments', () => {
    let gameId;
    beforeEach(async () => {
      gameId = `test-301-ai-${Date.now()}-${Math.random()}`;
      await gameStateManager.setGame(gameId, { gameId, players, gameType: '301_dido' });
      await gameStateManager.initializeAndStartGame(gameId, mockIo);
    });
    afterEach(async () => { await gameStateManager.deleteGame(gameId); });

    it('should "double in" with a "double_20" throw', async () => {
      await gameStateManager.registerThrow(gameId, 'player1', 40, 'double_20', mockIo);
      const game = await gameStateManager.getGame(gameId);
      expect(game.gameState.isIn.player1).toBe(true);
      expect(game.gameState.scores.player1).toBe(261);
    });

    it('should NOT "double in" on a "triple_20" throw', async () => {
      await gameStateManager.registerThrow(gameId, 'player1', 60, 'triple_20', mockIo);
      const game = await gameStateManager.getGame(gameId);
      expect(game.gameState.isIn.player1).toBe(false);
      expect(game.gameState.scores.player1).toBe(301);
    });
  });
});
