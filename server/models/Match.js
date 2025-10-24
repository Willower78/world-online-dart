const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const MatchSchema = new Schema({
    gameType: {
        type: String,
        required: true,
        enum: ['501', 'cricket']
    },
    players: [{
        type: Schema.Types.ObjectId,
        ref: 'User'
    }],
    winner: {
        type: Schema.Types.ObjectId,
        ref: 'User'
    },
    loser: {
        type: Schema.Types.ObjectId,
        ref: 'User'
    },
    finalScores: Schema.Types.Mixed,
    throwHistory: Schema.Types.Mixed,
    playedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Match', MatchSchema);