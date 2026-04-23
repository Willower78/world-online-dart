const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const User = require('../models/User');

// @route   POST /api/friends/request/:userId
// @desc    Send a friend request
// @access  Private
router.post('/request/:userId', auth, async (req, res) => {
    try {
        const targetUser = await User.findById(req.params.userId);
        const currentUser = await User.findById(req.user.id);

        if (!targetUser) {
            return res.status(404).json({ msg: 'User not found' });
        }

        if (targetUser.id === currentUser.id) {
            return res.status(400).json({ msg: 'You cannot be friends with yourself' });
        }

        // Check if they are already friends
        if (targetUser.friends.includes(currentUser.id)) {
            return res.status(400).json({ msg: 'You are already friends with this user' });
        }

        // Check if a request has already been sent
        if (targetUser.friendRequests.includes(currentUser.id)) {
            return res.status(400).json({ msg: 'Friend request already sent' });
        }
        
        // Check if the other user has already sent a request to you
        if (currentUser.friendRequests.includes(targetUser.id)) {
            return res.status(400).json({ msg: 'This user has already sent you a friend request. Please accept or reject it.' });
        }

        targetUser.friendRequests.push(currentUser.id);
        await targetUser.save();

        // --- NYTT: Skicka notis via Socket.IO ---
        const io = req.app.get('socketio');
        const onlineUsers = req.app.get('onlineUsers');
        const targetSocketId = onlineUsers[targetUser.id];

        if (targetSocketId) {
            io.to(targetSocketId).emit('new_friend_request', {
                from: {
                    _id: currentUser.id,
                    username: currentUser.username
                }
            });
            console.log(`Skickade notis om vänförfrågan till ${targetUser.username} (${targetSocketId})`);
        }

        res.json({ msg: 'Friend request sent' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   POST /api/friends/accept/:userId
// @desc    Accept a friend request
// @access  Private
router.post('/accept/:userId', auth, async (req, res) => {
    try {
        const requestingUser = await User.findById(req.params.userId);
        const currentUser = await User.findById(req.user.id);

        if (!requestingUser) {
            return res.status(404).json({ msg: 'User not found' });
        }

        // Check if a request exists
        if (!currentUser.friendRequests.includes(requestingUser.id)) {
            return res.status(400).json({ msg: 'No friend request from this user' });
        }

        // Add each other to friends lists
        currentUser.friends.push(requestingUser.id);
        requestingUser.friends.push(currentUser.id);

        // Remove the request
        currentUser.friendRequests = currentUser.friendRequests.filter(
            (id) => id.toString() !== requestingUser.id.toString()
        );

        await currentUser.save();
        await requestingUser.save();

        res.json({ msg: 'Friend request accepted' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   POST /api/friends/reject/:userId
// @desc    Reject a friend request
// @access  Private
router.post('/reject/:userId', auth, async (req, res) => {
    try {
        const currentUser = await User.findById(req.user.id);
        
        // Check if a request exists
        if (!currentUser.friendRequests.includes(req.params.userId)) {
            return res.status(400).json({ msg: 'No friend request from this user' });
        }

        // Remove the request
        currentUser.friendRequests = currentUser.friendRequests.filter(
            (id) => id.toString() !== req.params.userId.toString()
        );

        await currentUser.save();

        res.json({ msg: 'Friend request rejected' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});


// @route   GET /api/friends
// @desc    Get all friends and friend requests for the current user
// @access  Private
router.get('/', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id)
            .populate('friends', ['username', 'profilePicture']) // Hämta även profilbild
            .populate('friendRequests', ['username', 'profilePicture']);

        if (!user) {
            return res.status(404).json({ msg: 'User not found' });
        }

        const onlineUsers = req.app.get('onlineUsers');
        const friendsWithStatus = user.friends
            .filter(friend => friend) // Filter out null/undefined friends
            .map(friend => {
                const friendObj = friend.toObject();
                friendObj.isOnline = !!onlineUsers[friend._id.toString()];
                return friendObj;
            });

        res.json({
            friends: friendsWithStatus,
            friendRequests: user.friendRequests.filter(req => req) // Filter null requests too
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

module.exports = router;