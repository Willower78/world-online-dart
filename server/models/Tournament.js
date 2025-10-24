const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const TournamentSchema = new Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    gameType: {
        type: String,
        enum: ['501', 'cricket'],
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'active', 'completed'],
        default: 'pending'
    },
    participants: [{
        type: Schema.Types.ObjectId,
        ref: 'User'
    }],
    maxParticipants: {
        type: Number,
        default: 8
    },
    owner: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    winner: {
        type: Schema.Types.ObjectId,
        ref: 'User'
    },
    // Vi kommer att generera turneringsschemat (bracket) när turneringen startar
    bracket: {
        type: Object
    }
}, { timestamps: true });

module.exports = mongoose.model('Tournament', TournamentSchema);