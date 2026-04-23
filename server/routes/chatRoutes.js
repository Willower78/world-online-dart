const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const mongoose = require('mongoose');

// @route   GET /api/chat/conversations
// @desc    Get all active conversations for the user (Inbox)
// @access  Private
router.get('/conversations', auth, async (req, res) => {
    try {
        const userId = req.user.id;

        // Find conversations where the user is a participant
        let conversations = await Conversation.find({
            participants: userId
        })
        .populate('participants', 'username profilePicture')
        .sort({ updatedAt: -1 }); // Most recent first

        // Add last message preview to each conversation
        const conversationWithDetails = await Promise.all(conversations.map(async (conv) => {
            const lastMessage = await Message.findOne({ conversationId: conv._id })
                .sort({ createdAt: -1 });
            
            return {
                ...conv.toObject(),
                lastMessage: lastMessage ? lastMessage.content : 'No messages yet',
                lastMessageDate: lastMessage ? lastMessage.createdAt : conv.updatedAt
            };
        }));

        res.json(conversationWithDetails);

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

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