const mongoose = require('mongoose');

const CalibrationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  calibrationImage: {
    type: String,
    required: true
  },
  boardCorners: {
    topLeft: { x: Number, y: Number },
    topRight: { x: Number, y: Number },
    bottomLeft: { x: Number, y: Number },
    bottomRight: { x: Number, y: Number }
  },
  distanceFromBoard: {
    type: Number,
    default: 237
  },
  lightingConditions: {
    type: String,
    enum: ['low', 'medium', 'high', 'auto'],
    default: 'auto'
  },
  lastCalibrated: {
    type: Date,
    default: Date.now
  },
  calibrationValid: {
    type: Boolean,
    default: true
  }
});

module.exports = mongoose.model('Calibration', CalibrationSchema);
