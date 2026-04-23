const Match = require('../models/Match');
const User = require('../models/User');
const gameStateManager = require('./gameStateManager');

class StatsService {

  static async getGlobalStats(onlineUsers = {}) {
    try {
      const totalMatches = await Match.countDocuments();
      const liveGames = await gameStateManager.getAllGames();
      const liveGamesCount = Object.keys(liveGames).length;
      const onlineUsersCount = Object.keys(onlineUsers).length;

      return {
        totalMatches,
        liveGames: liveGamesCount,
        onlineUsers: onlineUsersCount,
      };
    } catch (err) {
      console.error('[Stats Service] Error getting global stats:', err);
      throw err;
    }
  }

  static async getUserStats(userId) {
    try {
      // New approach: return pre-aggregated stats from the User object.
      const user = await User.findById(userId).select('stats username profilePicture');
      if (!user) {
        return null;
      }
      return user.stats;
    } catch (err) {
      console.error('[Stats Service] Error getting user stats:', err);
      throw err;
    }
  }

  static getGameTypeStats(matches, gameType, userId) {
    const typeMatches = matches.filter(m => m.gameType === gameType);
    const wins = typeMatches.filter(m => m.winner?.toString() === userId.toString()).length;
    const losses = typeMatches.filter(m => m.loser?.toString() === userId.toString()).length;
    const total = wins + losses;

    return {
      played: total,
      wins,
      losses,
      winRate: total > 0 ? ((wins / total) * 100).toFixed(2) : 0,
    };
  }

  static async updateUserStatsAfterMatch(match) {
    try {
      if (!match || !match.winner || !match.loser) return;

      const winner = await User.findById(match.winner);
      const loser = await User.findById(match.loser);
      if (!winner || !loser) return;

      // Ensure stats objects exist
      winner.stats = winner.stats || {};
      loser.stats = loser.stats || {};

      // --- Global Stats ---
      winner.stats.wins = (winner.stats.wins || 0) + 1;
      winner.stats.totalMatches = (winner.stats.totalMatches || 0) + 1;
      loser.stats.losses = (loser.stats.losses || 0) + 1;
      loser.stats.totalMatches = (loser.stats.totalMatches || 0) + 1;

      // --- Game-specific stats ---
      if (match.gameType === '501' || match.gameType === '301_dido') {
        const gameStats = winner.stats.game_501 || {};
        gameStats.wins = (gameStats.wins || 0) + 1;
        
        const loserStats = loser.stats.game_501 || {};
        loserStats.losses = (loserStats.losses || 0) + 1;

        // Calculate 3-dart average for both players
        [winner, loser].forEach(player => {
          const playerStats = player.stats.game_501;
          const throwHistory = match.throwHistory[player._id.toString()] || [];
          const dartsThrown = throwHistory.length;
          const scoreDeducted = throwHistory.reduce((acc, p) => acc + p.score, 0);

          playerStats.dartsThrown = (playerStats.dartsThrown || 0) + dartsThrown;
          playerStats.scoreDeducted = (playerStats.scoreDeducted || 0) + scoreDeducted;
          
          if (playerStats.dartsThrown > 0) {
            const totalAverage = (playerStats.scoreDeducted / playerStats.dartsThrown) * 3;
            playerStats.threeDartAverage = parseFloat(totalAverage.toFixed(2));
          }
        });

        winner.stats.game_501 = gameStats;
        loser.stats.game_501 = loserStats;

      } else if (match.gameType === 'cricket') {
        // Similar logic for Cricket
        const gameStats = winner.stats.cricket || {};
        gameStats.wins = (gameStats.wins || 0) + 1;

        const loserStats = loser.stats.cricket || {};
        loserStats.losses = (loserStats.losses || 0) + 1;
        
        // Calculate Marks Per Round (MPR) for both
        [winner, loser].forEach(player => {
          const playerStats = player.stats.cricket;
          const throwHistory = match.throwHistory[player._id.toString()] || [];
          const dartsThrown = throwHistory.length;
          
          let marks = 0;
          const cricketNumbers = [15, 16, 17, 18, 19, 20, 25];
          throwHistory.forEach(t => {
            const multiplier = t.segment.startsWith('T') ? 3 : t.segment.startsWith('D') ? 2 : 1;
            const baseNumber = parseInt(t.segment.replace(/[TDS]/, ''));
            if(cricketNumbers.includes(baseNumber)) {
              marks += multiplier;
            }
          });
          
          playerStats.dartsThrown = (playerStats.dartsThrown || 0) + dartsThrown;
          playerStats.totalMarks = (playerStats.totalMarks || 0) + marks;

          if (playerStats.dartsThrown > 0) {
            const mpr = (playerStats.totalMarks / playerStats.dartsThrown) * 3;
            playerStats.marksPerRound = parseFloat(mpr.toFixed(2));
          }
        });
        
        winner.stats.cricket = gameStats;
        loser.stats.cricket = loserStats;
      }

      await winner.save();
      await loser.save();

      console.log(`[Stats] Updated detailed stats for match ${match._id}`);
    } catch (err) {
      console.error('[Stats Service] Error updating detailed stats:', err);
    }
  }

  static async getLeaderboard(gameType = null, limit = 50) {
    try {
      const pipeline = [
        {
          $lookup: {
            from: 'matches',
            localField: '_id',
            foreignField: 'winner',
            as: 'wonMatches',
          },
        },
        {
          $addFields: {
            totalWins: { $size: '$wonMatches' },
          },
        },
        {
          $match: {
            totalWins: { $gt: 0 },
          },
        },
        {
          $sort: { totalWins: -1 },
        },
        {
          $limit: limit,
        },
        {
          $project: {
            username: 1,
            profilePicture: 1,
            totalWins: 1,
            'stats.totalMatches': 1,
            'stats.wins': 1,
            'stats.losses': 1,
          },
        },
      ];

      return await User.aggregate(pipeline);
    } catch (err) {
      console.error('[Stats Service] Error getting leaderboard:', err);
      throw err;
    }
  }

  static async getMatchHistory(userId, limit = 20) {
    try {
      return await Match.find({ players: userId })
        .populate('winner', 'username profilePicture')
        .populate('loser', 'username profilePicture')
        .populate('players', 'username profilePicture')
        .sort({ createdAt: -1 })
        .limit(limit);
    } catch (err) {
      console.error('[Stats Service] Error getting match history:', err);
      throw err;
    }
  }
}

module.exports = StatsService;
