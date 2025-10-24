const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const mongoose = require('mongoose');

// @route   GET /api/chat/:friendId
// @desc    Get chat history with a friend
// @access  Private
router.get('/:friendId', auth, async (req, res) => {
    try {
        const { friendId } = req.params;
        const userId = req.user.id;

        if (!mongoose.Types.ObjectId.isValid(friendId)) {
            return res.status(400).json({ msg: 'Invalid friend ID' });
        }

        const conversation = await Conversation.findOne({
            participants: { $all: [userId, friendId] }
        });

        if (!conversation) {
            return res.json([]); // No history yet, return empty
        }

        const messages = await Message.find({ conversationId: conversation._id })
            .sort({ createdAt: 'asc' });

        res.json(messages);

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

module.exports = router;