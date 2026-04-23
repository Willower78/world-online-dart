const mongoose = require('mongoose');

const RewardSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  type: {
    type: String,
    enum: ['match_win', 'tournament_win', 'achievement', 'referral', 'admin_grant'],
    required: true,
  },
  amount: {
    type: Number,
    required: true,
  },
  currency: {
    type: String,
    default: 'USD',
  },
  status: {
    type: String,
    enum: ['pending', 'active', 'redeemed', 'expired', 'cancelled'],
    default: 'active',
  },
  code: {
    type: String,
    unique: true,
    sparse: true,
  },
  description: {
    type: String,
  },
  metadata: {
    matchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Match' },
    tournamentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tournament' },
    achievementName: String,
    referredUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  redeemedAt: {
    type: Date,
  },
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

RewardSchema.index({ userId: 1, status: 1 });
RewardSchema.index({ code: 1 });
RewardSchema.index({ expiresAt: 1 });

module.exports = mongoose.model('Reward', RewardSchema);
