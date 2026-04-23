const mongoose = require('mongoose');

const DetectionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  gameId: {
    type: String,
    required: true,
    index: true
  },
  imagePath: {
    type: String,
    required: true
  },
  detected: {
    type: Boolean,
    default: false
  },
  score: {
    number: { type: Number, min: 0, max: 25 },
    multiplier: { type: Number, min: 1, max: 3 },
    points: { type: Number, min: 0, max: 60 }
  },
  position: {
    x: { type: Number, min: 0, max: 1 },
    y: { type: Number, min: 0, max: 1 }
  },
  confidence: {
    type: Number,
    min: 0,
    max: 1
  },
  verified: {
    type: Boolean,
    default: false
  },
  playerConfirmed: {
    type: Boolean
  },
  actualScore: {
    number: { type: Number },
    multiplier: { type: Number },
    points: { type: Number }
  },
  corrected: {
    type: Boolean,
    default: false
  },
  throwNumber: {
    type: Number,
    default: 1
  },
  driveLink: {
    type: String
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
});

DetectionSchema.index({ userId: 1, gameId: 1 });
DetectionSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Detection', DetectionSchema);
