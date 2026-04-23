const mongoose = require('mongoose');

const standingSchema = new mongoose.Schema({
  player: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  wins: {
    type: Number,
    default: 0,
  },
  losses: {
    type: Number,
    default: 0,
  },
  points: {
    type: Number,
    default: 0,
  },
});

const matchSchema = new mongoose.Schema({
  week: {
    type: Number,
    required: true,
  },
  player1: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  player2: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  proposedDate: {
    type: Date,
  },
  matchDate: {
    type: Date,
  },
  winner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  status: {
    type: String,
    enum: ['Scheduled', 'Completed', 'AwaitingConfirmation'],
    default: 'Scheduled',
  }
});

const divisionSchema = new mongoose.Schema({
  divisionNumber: {
    type: Number,
    required: true,
    min: 1,
    max: 6,
  },
  players: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  schedule: [matchSchema],
  standings: [standingSchema],
});

const leagueSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  region: {
    type: String,
    required: true,
    enum: ['Scandinavian', 'British', 'Dutch', 'German', 'Asian', 'American', 'Global'],
  },
  themeColor: {
    type: String, // e.g., '#FF5733' or 'blue'
    default: '#333'
  },
  status: {
    type: String,
    enum: ['Recruiting', 'InProgress', 'Completed'],
    default: 'Recruiting',
  },
  entryFeeEuros: {
    type: Number,
    required: true,
    default: 10,
  },
  perGameFeeSilverStars: {
    type: Number,
    required: true,
    default: 1,
  },
  seasonLengthWeeks: {
    type: Number,
    default: 20,
  },
  maxPlayersPerDivision: {
    type: Number,
    default: 20,
  },
  divisions: [divisionSchema],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', // Admin user
  }
}, {
  timestamps: true,
});

const League = mongoose.model('League', leagueSchema);

module.exports = League;
