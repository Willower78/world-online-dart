const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { check, validationResult } = require('express-validator');

const User = require('../models/User');
const { authLimiter } = require('../middleware/rateLimiter');

// @route   POST api/auth/register
// @desc    Register a user
// @access  Public
router.post(
  '/register',
  authLimiter,
  [
    check('username', 'Please add a name').not().isEmpty(),
    check('email', 'Please include a valid email').isEmail(),
    check('password', 'Please enter a password with 6 or more characters').isLength({ min: 6 }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { username, email, password, realName, nickname, address, city, country, estimatedAverage } = req.body;

    try {
      let user = await User.findOne({ email });
      if (user) {
        return res.status(400).json({ msg: 'User already exists' });
      }

      let classification = 'Unranked';
      if (estimatedAverage) {
          const avg = parseFloat(estimatedAverage);
          if (avg >= 85) classification = 'Pro';
          else if (avg >= 46) classification = 'Amateur';
          else if (avg > 0) classification = 'Beginner';
      }

      user = new User({ 
          username, 
          email, 
          password,
          realName,
          nickname,
          address,
          city,
          country,
          classification,
          // Store estimated average in stats as a starting point? 
          // Or just leave it for classification. Let's just set classification.
      });

      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(password, salt);

      await user.save();

      const payload = { user: { id: user.id } };

      jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: 360000 }, (err, token) => {
        if (err) {
          console.error('JWT Signing Error on register:', err);
          return res.status(500).send('Server Error during token generation.');
        }
        // ---- NY ÄNDRING: Skicka med hela användarobjektet ----
        res.status(201).json({
          token,
          user: {
            ...user.toObject(),
            password: undefined // Ta bort lösenordet från svaret
          }
        });
      });
    } catch (err) {
      console.error(err.message);
      res.status(500).send('Server Error');
    }
  }
);

// @route   POST api/auth/login
// @desc    Auth user & get token
// @access  Public
router.post(
  '/login',
  authLimiter,
  [
    check('email', 'Please include a valid email').isEmail(),
    check('password', 'Password is required').exists(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    try {
      let user = await User.findOne({ email });
      if (!user) {
        return res.status(400).json({ msg: 'Invalid Credentials' });
      }

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(400).json({ msg: 'Invalid Credentials' });
      }

      // Kontrollera om användaren är bannlyst
      if (user.isBanned) {
        return res.status(403).json({ msg: 'This account has been suspended.' });
      }

      const payload = { user: { id: user.id } };

      jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: 360000 }, async (err, token) => {
        if (err) {
          console.error('JWT Signing Error on login:', err);
          return res.status(500).send('Server Error during token generation.');
        }

        const userObject = user.toObject();
        delete userObject.password;

        res.json({
          token,
          user: userObject
        });
      });
    } catch (err) {
      console.error(err.message);
      res.status(500).send('Server Error');
    }
  }
);

module.exports = router;