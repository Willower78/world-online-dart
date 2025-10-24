const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const PostSchema = new Schema({
    user: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    content: {
        type: String,
        // Inte längre obligatorisk, ett inlägg kan vara bara en bild/video
    },
    mediaUrl: {
        type: String
    },
    mediaType: {
        type: String // 'image' eller 'video'
    },
    isGlobal: {
        type: Boolean,
        default: false
    },
    reactions: {
        likes: [{ type: Schema.Types.ObjectId, ref: 'User' }],
        dislikes: [{ type: Schema.Types.ObjectId, ref: 'User' }],
        hugs: [{ type: Schema.Types.ObjectId, ref: 'User' }],
        hearts: [{ type: Schema.Types.ObjectId, ref: 'User' }]
    },
    comments: [
        {
            user: { type: Schema.Types.ObjectId, ref: 'User' },
            text: { type: String, required: true, maxlength: 200 },
            createdAt: { type: Date, default: Date.now }
        }
    ],
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Post', PostSchema);