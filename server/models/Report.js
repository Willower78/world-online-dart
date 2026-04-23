const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ReportSchema = new Schema({
  reporter: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  reported: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    // Not required for 'Assistance' requests
  },
  gameId: {
    type: String, // Game IDs are generated strings
    required: true,
  },
  type: {
    type: String,
    enum: ['Cheating', 'Harassment', 'TechnicalAssistance'],
    required: true,
  },
  reason: {
    type: String,
    trim: true,
    // Optional, but good to have
  },
  status: {
    type: String,
    enum: ['Open', 'UnderReview', 'Resolved'],
    default: 'Open',
  },
  adminNotes: {
    type: String,
    trim: true,
  },
  resolvedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User', // The admin who resolved it
  }
}, { timestamps: true });

module.exports = mongoose.model('Report', ReportSchema);
