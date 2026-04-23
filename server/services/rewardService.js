const Reward = require('../models/Reward');
const crypto = require('crypto');

class RewardService {
  static generateRewardCode() {
    return `WOD-${crypto.randomBytes(8).toString('hex').toUpperCase()}`;
  }

  static async createReward({ userId, type, amount, description, metadata = {} }) {
    try {
      const reward = new Reward({
        userId,
        type,
        amount,
        description,
        metadata,
        code: this.generateRewardCode(),
        currency: process.env.REWARD_CURRENCY || 'USD',
        status: 'active',
      });

      await reward.save();
      console.log(`[Reward] Created reward ${reward.code} for user ${userId}`);
      return reward;
    } catch (err) {
      console.error('[Reward Service] Error creating reward:', err);
      throw err;
    }
  }

  static async awardMatchWin(userId, matchId) {
    const amount = parseInt(process.env.REWARD_WIN_AMOUNT) || 10;
    return await this.createReward({
      userId,
      type: 'match_win',
      amount,
      description: 'Match victory reward',
      metadata: { matchId },
    });
  }

  static async awardTournamentWin(userId, tournamentId) {
    const amount = parseInt(process.env.REWARD_TOURNAMENT_WIN_AMOUNT) || 50;
    return await this.createReward({
      userId,
      type: 'tournament_win',
      amount,
      description: 'Tournament championship reward',
      metadata: { tournamentId },
    });
  }

  static async getUserRewards(userId, status = 'active') {
    return await Reward.find({ userId, status }).sort({ createdAt: -1 });
  }

  static async getUserBalance(userId) {
    const rewards = await Reward.find({ userId, status: 'active' });
    return rewards.reduce((sum, reward) => sum + reward.amount, 0);
  }

  static async redeemReward(userId, rewardId) {
    const reward = await Reward.findOne({ _id: rewardId, userId, status: 'active' });

    if (!reward) {
      throw new Error('Reward not found or already redeemed');
    }

    if (reward.expiresAt && reward.expiresAt < new Date()) {
      reward.status = 'expired';
      await reward.save();
      throw new Error('Reward has expired');
    }

    reward.status = 'redeemed';
    reward.redeemedAt = new Date();
    await reward.save();

    console.log(`[Reward] User ${userId} redeemed reward ${reward.code}`);
    return reward;
  }

  static async cancelReward(rewardId) {
    const reward = await Reward.findById(rewardId);
    if (!reward) {
      throw new Error('Reward not found');
    }
    reward.status = 'cancelled';
    await reward.save();
    return reward;
  }

  static async getAllRewards(filters = {}) {
    return await Reward.find(filters)
      .populate('userId', 'username email')
      .sort({ createdAt: -1 })
      .limit(100);
  }
}

module.exports = RewardService;
