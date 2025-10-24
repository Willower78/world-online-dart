// server/routes/userRoutes.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const auth = require('../middleware/authMiddleware'); // Importera vår middleware
const User = require('../models/User');
const Match = require('../models/Match');

// --- Multer-konfiguration för profilbild-uppladdning ---
const storage = multer.diskStorage({
    destination: './uploads/',
    filename: function(req, file, cb){
        // Skapa ett unikt filnamn för att undvika konflikter
        cb(null, 'avatar-' + req.user.id + '-' + Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({
    storage: storage,
    limits: { fileSize: 5000000 }, // Begränsa filstorlek till 5MB
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) return cb(null, true);
        cb(new Error('Only image files are allowed!'), false);
    }
}).single('profilePicture');

// @route   GET /api/users/me
// @desc    Hämta inloggad användares data
// @access  Private
router.get('/me', auth, async (req, res) => {
  try {
    // Hämta hela användarobjektet från databasen.
    // Vi specificerar exakt vilka fält vi vill ha för att vara säkra på att få med allt.
    const user = await User.findById(req.user.id).select(
      'username email createdAt friends friendRequests isAdmin stripeCustomerId subscriptionStatus profilePicture location birthdate'
    );
    res.json(user);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   PUT /api/users/me
// @desc    Update current user's profile (location, birthdate)
// @access  Private
router.put('/me', auth, async (req, res) => {
  const { location, birthdate } = req.body;
  try {
    // ---- KRITISK KORRIGERING: Hämta hela dokumentet ----
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ msg: 'User not found' });

    if (location !== undefined) user.location = location;
    if (birthdate !== undefined) user.birthdate = birthdate;

    await user.save();

    // Skicka tillbaka ett "rent" objekt utan lösenordet för att uppdatera klienten
    const userObject = user.toObject();
    delete userObject.password;
    res.json(userObject);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   POST /api/users/me/picture
// @desc    Upload a profile picture
// @access  Private
router.post('/me/picture', auth, (req, res) => {
  upload(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ msg: 'Error uploading file.', error: err.message });
    }
    if (req.file == undefined) {
      return res.status(400).json({ msg: 'No file selected.' });
    }

    try {
      const user = await User.findById(req.user.id).select('-password');
      // TODO: Ta bort den gamla profilbilden från servern för att spara utrymme
      user.profilePicture = `/uploads/${req.file.filename}`;
      await user.save();
      res.json({ msg: 'Profile picture updated!', user });
    } catch (err) {
      console.error(err.message);
      res.status(500).send('Server Error');
    }
  });
});

// @route   GET /api/users/search
// @desc    Search for users by username
// @access  Private
router.get('/search', auth, async (req, res) => {
    try {
        const searchQuery = req.query.q;
        if (!searchQuery || searchQuery.trim() === '') { return res.json([]); }
        const users = await User.find({ username: { $regex: searchQuery, $options: 'i' }, _id: { $ne: req.user.id } }).limit(10).select('username');
        res.json(users);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   GET /api/users/leaderboard
// @desc    Get the top players by wins
// @access  Private
router.get('/leaderboard', auth, async (req, res) => {
  try {
    const leaderboard = await Match.aggregate([
      // Steg 1: Gruppera alla matcher efter vinnare och räkna antalet vinster
      { $group: { _id: "$winner", wins: { $sum: 1 } } },
      // Steg 1.5: Se till att vi inte har null-värden (om en match saknar vinnare)
      { $match: { _id: { $ne: null } } },
      // Steg 2: Sortera efter flest vinster
      { $sort: { wins: -1 } },
      // Steg 3: Begränsa till topp 20
      { $limit: 20 },
      // Steg 4: Hämta användardetaljer för varje vinnare
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
      // Steg 5: Rensa upp resultatet
      { $unwind: '$user' }, // $unwind för att omvandla 'user'-arrayen till ett objekt
      // Steg 6: Formatera output
      { $project: { _id: 0, userId: '$user._id', username: '$user.username', wins: '$wins' } }
    ]);
    res.json(leaderboard);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET /api/users/:userId
// @desc    Get public user profile by ID
// @access  Private (you must be logged in to see other profiles)
router.get('/:userId', auth, async (req, res) => {
  try {
    // Välj vilka fält som ska vara publika
    const user = await User.findById(req.params.userId).select('username createdAt profilePicture location birthdate');
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }
    res.json(user);
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
        return res.status(404).json({ msg: 'User not found' });
    }
    res.status(500).send('Server Error');
  }
});

// @route   GET /api/users/admin/stats
// @desc    Get user statistics for admin
// @access  Admin
router.get('/admin/stats', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user.isAdmin) {
      return res.status(403).json({ msg: 'Access denied. Admins only.' });
    }

    const totalUsers = await User.countDocuments();
    const premiumUsers = await User.countDocuments({ subscriptionStatus: 'active' });
    const latestUsers = await User.find().sort({ createdAt: -1 }).limit(5).select('username createdAt');

    res.json({
      totalUsers,
      premiumUsers,
      latestUsers
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET /api/users/admin/all
// @desc    Get all users for admin
// @access  Admin
router.get('/admin/all', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user.isAdmin) {
      return res.status(403).json({ msg: 'Access denied. Admins only.' });
    }

    const allUsers = await User.find().select('username email isAdmin createdAt isBanned').sort({ createdAt: -1 });
    res.json(allUsers);

  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   PUT /api/users/admin/manage/:userId
// @desc    Update a user's admin status
// @access  Admin
router.put('/admin/manage/:userId', auth, async (req, res) => {
  try {
    const adminUser = await User.findById(req.user.id);
    if (!adminUser.isAdmin) {
      return res.status(403).json({ msg: 'Access denied. Admins only.' });
    }

    const { isAdmin } = req.body;
    const targetUser = await User.findById(req.params.userId);
    if (!targetUser) {
      return res.status(404).json({ msg: 'User not found.' });
    }

    targetUser.isAdmin = isAdmin;
    await targetUser.save();
    res.json({ msg: `User ${targetUser.username} has been updated.`, user: { _id: targetUser._id, isAdmin: targetUser.isAdmin } });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   PUT /api/users/admin/ban/:userId
// @desc    Ban or unban a user
// @access  Admin
router.put('/admin/ban/:userId', auth, async (req, res) => {
  try {
    const adminUser = await User.findById(req.user.id);
    if (!adminUser.isAdmin) {
      return res.status(403).json({ msg: 'Access denied. Admins only.' });
    }

    const { isBanned } = req.body;
    const targetUser = await User.findById(req.params.userId);
    if (!targetUser) {
      return res.status(404).json({ msg: 'User not found.' });
    }
    if (targetUser.isAdmin) {
      return res.status(400).json({ msg: 'Cannot ban another administrator.' });
    }

    targetUser.isBanned = isBanned;
    await targetUser.save();
    res.json({ msg: `User ${targetUser.username} has been ${isBanned ? 'banned' : 'unbanned'}.` });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET /api/users/:userId/matches
// @desc    Get a user's match history
// @access  Private
router.get('/:userId/matches', auth, async (req, res) => {
  try {
    const matches = await Match.find({ players: req.params.userId })
      .sort({ playedAt: -1 })
      .limit(10)
      .populate('winner', 'username')
      .populate('loser', 'username');

    res.json(matches);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   POST /api/users/me/grant-premium-dev
// @desc    DEV ONLY: Grant premium status to the current user
// @access  Private
router.post('/me/grant-premium-dev', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    user.subscriptionStatus = 'active';
    await user.save();

    res.json({ msg: 'Premium status granted!', user: user.toObject() });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   POST /api/users/admin/seed-bots
// @desc    DEV ONLY: Create a specified number of bot users
// @access  Admin
router.post('/admin/seed-bots', auth, async (req, res) => {
  try {
    const adminUser = await User.findById(req.user.id);
    if (!adminUser.isAdmin) {
      return res.status(403).json({ msg: 'Access denied. Admins only.' });
    }

    const { count } = req.body;
    if (!count || isNaN(count) || count <= 0) {
      return res.status(400).json({ msg: 'Please provide a valid number of bots to create.' });
    }

    let createdCount = 0;
    for (let i = 1; i <= count; i++) {
      const botUsername = `Bot_${Date.now()}_${i}`;
      const botEmail = `bot_${Date.now()}_${i}@example.com`;

      const botUser = new User({
        username: botUsername,
        email: botEmail,
        password: 'password123', // Simple password for bots
      });

      await botUser.save();
      createdCount++;
    }

    res.json({ msg: `${createdCount} bot users created successfully.` });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   POST /api/users/admin/grant-all-premium
// @desc    DEV ONLY: Grant premium to all non-premium users
// @access  Admin
router.post('/admin/grant-all-premium', auth, async (req, res) => {
  try {
    const adminUser = await User.findById(req.user.id);
    if (!adminUser.isAdmin) {
      return res.status(403).json({ msg: 'Access denied. Admins only.' });
    }

    const result = await User.updateMany(
      { subscriptionStatus: { $ne: 'active' } },
      { $set: { subscriptionStatus: 'active' } }
    );

    res.json({ msg: `${result.modifiedCount} users were upgraded to Premium.` });

  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;