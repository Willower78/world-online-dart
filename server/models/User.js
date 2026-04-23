const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const UserSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
  },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    password: {
      type: String,
      required: true,
    },
    goldStars: {
      type: Number,
      default: 0,
    },
    silverStars: {
      type: Number,
      default: 0,
    },
    classification: {
      type: String,
      enum: ['Unranked', 'Beginner', 'Amateur', 'Pro'],
      default: 'Unranked',
    },
    averageScore: {
      type: Number,
      default: 0,
    },
    placementGamesPlayed: {
      type: Number,
      default: 0,
    },
    subscriptionStatus: {
      type: String,
      default: 'inactive', // e.g., 'active', 'inactive', 'cancelled'
    },
    isAdmin: {
      type: Boolean,
      default: false
    },
    role: {
      type: String,
      enum: ['player', 'admin', 'federation', 'company'],
      default: 'player'
    },
    federationRegion: {
      type: String, // e.g. "Stockholm" or "Sweden"
      trim: true
    },
    organizationDetails: {
      name: { type: String },
      website: { type: String },
      contactEmail: { type: String }
    },
    friends: [{
      type: Schema.Types.ObjectId,
      ref: 'User'
    }],
    friendRequests: [{
      type: Schema.Types.ObjectId,
      ref: 'User'
    }],
  // --- Nya profilfält ---
  realName: { type: String, trim: true },
  nickname: { type: String, trim: true },
  address: { type: String, trim: true },
  city: { type: String, trim: true },
  country: { type: String, trim: true },
  profilePicture: {
    type: String,
    default: '/uploads/default-avatar.png' // En standardbild
  },
  location: {
    type: String,
    trim: true
  },
  birthdate: {
    type: Date
  },
  stats: {
    totalMatches: { type: Number, default: 0 },
    wins: { type: Number, default: 0 },
    losses: { type: Number, default: 0 },
    game_501: {
      wins: { type: Number, default: 0 },
      losses: { type: Number, default: 0 },
      threeDartAverage: { type: Number, default: 0 },
      dartsThrown: { type: Number, default: 0 },
      scoreDeducted: { type: Number, default: 0 },
      oneEighties: { type: Number, default: 0 },
      highOut: { type: Number, default: 0 },
    },
    cricket: {
      wins: { type: Number, default: 0 },
      losses: { type: Number, default: 0 },
      marksPerRound: { type: Number, default: 0 },
      dartsThrown: { type: Number, default: 0 },
      totalMarks: { type: Number, default: 0 },
    }
  }
});

module.exports = mongoose.model('User', UserSchema);