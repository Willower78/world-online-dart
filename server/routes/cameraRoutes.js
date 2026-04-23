const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const multer = require('multer');
const path = require('path');
const Detection = require('../models/Detection');
const Calibration = require('../models/Calibration'); // Importera Calibration-modellen
const visionService = require('../services/visionService');

/**
 * Camera/Computer Vision Routes
 * Connects mobile camera input to game scoring
 */

// @route   GET /api/camera/calibration
// @desc    Get the latest calibration data for the logged-in user
// @access  Private
router.get('/calibration', auth, async (req, res) => {
    try {
        console.log('--- Entering /api/camera/calibration route ---');
        const calibration = await Calibration.findOne({ userId: req.user.id }).sort({ createdAt: -1 });

        if (!calibration) {
            console.log('No calibration data found for user:', req.user.id);
            return res.status(404).json({ msg: 'No calibration data found for this user.' });
        }

        console.log('Calibration data found:', calibration);
        res.json(calibration);
    } catch (err) {
        console.error('--- Error in /api/camera/calibration route ---');
        console.error('Error object:', err);
        res.status(500).send('Server Error');
    }
});


// Configure multer for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/dart-images/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.random().toString(36).substring(7);
    cb(null, `dart-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files (JPEG, JPG, PNG) are allowed'));
    }
  }
});

module.exports = router; // Exportera routern
