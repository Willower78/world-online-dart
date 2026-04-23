const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const auth = require('../middleware/authMiddleware');
const Post = require('../models/Post');
const fs = require('fs');
const User = require('../models/User');

// --- Multer-konfiguration för filuppladdning ---
const storage = multer.diskStorage({
    destination: './uploads/',
    filename: function(req, file, cb){
        cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 25000000 }, // Begränsa filstorlek till 25MB
    fileFilter: function(req, file, cb){
        const filetypes = /jpeg|jpg|png|gif|mp4|mov|avi|mkv/;
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = filetypes.test(file.mimetype);
        if(mimetype && extname){
            return cb(null,true);
        } else {
            cb('Error: Endast bilder och videoklipp är tillåtna!');
        }
    }
}).single('media'); // 'media' är namnet på fältet i formuläret

// @route   POST /api/posts
// @desc    Create a new post
// @access  Private
router.post('/', auth, (req, res) => {
    upload(req, res, async (err) => {
        if(err){
            return res.status(400).json({ msg: err });
        }
        const { content } = req.body;
        if ((!content || content.trim() === '') && !req.file) {
            return res.status(400).json({ msg: 'Inlägget måste innehålla text eller media.' });
        }
        try {
            const user = await User.findById(req.user.id);

            const newPost = new Post({
                user: req.user.id,
                content: content,
                mediaUrl: req.file ? `/uploads/${req.file.filename}` : undefined,
                mediaType: req.file ? (req.file.mimetype.startsWith('image') ? 'image' : 'video') : undefined,
                isGlobal: user.isAdmin // Sätt isGlobal-flaggan om användaren är admin
            });
            await newPost.save();

            // Meddela alla anslutna klienter att flödet har uppdaterats
            req.app.get('socketio').emit('feed_updated');

            res.status(201).json(newPost);
        } catch (err) {
            console.error(err.message);
            res.status(500).send('Server Error');
        }
    });
});

// @route   GET /api/posts/feed
// @desc    Get the user's social feed (posts from friends and self)
// @access  Private
router.get('/feed', auth, async (req, res) => {
    try {
        const currentUser = await User.findById(req.user.id);
        const userAndFriendsIds = [req.user.id, ...currentUser.friends];

        const feedPosts = await Post.find({
            $or: [
                { 'user': { $in: userAndFriendsIds } }, // Inlägg från användaren och vänner
                { 'isGlobal': true }                  // ELLER inlägg som är globala
            ]
        })
            .populate('user', ['username', 'profilePicture'])       // Fyll på med författarens användarnamn och bild
            .populate('comments.user', ['username', 'profilePicture']) // Fyll på med kommentarers författare och bild
            .sort({ createdAt: -1 })       // Sort by newest first
            .limit(50);                     // Limit to 50 posts

        res.json(feedPosts);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   POST /api/posts/react/:id
// @desc    React to a post
// @access  Private
router.post('/react/:id', auth, async (req, res) => {
    try {
        const post = await Post.findById(req.params.id);
        if (!post) return res.status(404).json({ msg: 'Post not found' });

        const { reactionType } = req.body;
        const validReactions = ['likes', 'dislikes', 'hugs', 'hearts'];
        if (!validReactions.includes(reactionType)) {
            return res.status(400).json({ msg: 'Invalid reaction type' });
        }

        const userId = req.user.id;
        let toggledOff = false;

        // Loopa igenom alla reaktionstyper för att se om användaren redan reagerat
        for (const type of validReactions) {
            const index = post.reactions[type].findIndex(u => u.toString() === userId);
            if (index > -1) {
                // Användaren har reagerat, ta bort den gamla reaktionen
                post.reactions[type].splice(index, 1);
                if (type === reactionType) {
                    // Om det var samma reaktionstyp, har vi bara stängt av den
                    toggledOff = true;
                }
                break; // Användaren kan bara ha en reaktion, så vi kan avbryta loopen
            }
        }

        // Om vi inte stängde av en reaktion, lägg till den nya
        if (!toggledOff) {
            post.reactions[reactionType].push(userId);
        }

        await post.save();

        // Meddela alla anslutna klienter att flödet har uppdaterats
        req.app.get('socketio').emit('feed_updated');

        res.json(post);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   POST /api/posts/comment/:id
// @desc    Comment on a post
// @access  Private
router.post('/comment/:id', auth, async (req, res) => {
    try {
        const post = await Post.findById(req.params.id);
        if (!post) return res.status(404).json({ msg: 'Post not found' });

        const { text } = req.body;
        if (!text || text.trim() === '') return res.status(400).json({ msg: 'Comment text cannot be empty' });
        if (text.length > 200) return res.status(400).json({ msg: 'Comment cannot be more than 200 characters' });

        post.comments.unshift({ user: req.user.id, text });

        await post.save();

        // Meddela alla anslutna klienter att flödet har uppdaterats
        req.app.get('socketio').emit('feed_updated');

        const populatedPost = await Post.findById(post._id).populate('comments.user', ['username', 'profilePicture']);
        res.json(populatedPost);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   DELETE /api/posts/:id
// @desc    Delete a post
// @access  Private (Owner or Admin)
router.delete('/:id', auth, async (req, res) => {
    try {
        const post = await Post.findById(req.params.id);
        if (!post) {
            return res.status(404).json({ msg: 'Post not found' });
        }

        const currentUser = await User.findById(req.user.id);

        // Check if user is the owner of the post or an admin
        if (post.user.toString() !== req.user.id && !currentUser.isAdmin) {
            return res.status(401).json({ msg: 'User not authorized' });
        }

        // If post has media, delete the file from the server
        if (post.mediaUrl) {
            // Construct the full path to the file
            // Backa ett steg (från 'routes' till 'server') och lägg till sökvägen
            const relativeMediaUrl = post.mediaUrl.startsWith('/') ? post.mediaUrl.substring(1) : post.mediaUrl;
            const filePath = path.join(__dirname, '..', relativeMediaUrl);
            
            fs.unlink(filePath, (err) => {
                if (err) console.error(`Failed to delete media file: ${filePath}`, err);
            });
        }

        await post.deleteOne();

        req.app.get('socketio').emit('feed_updated');
        res.json({ msg: 'Post removed' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

module.exports = router;