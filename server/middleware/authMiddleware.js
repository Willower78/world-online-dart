// server/middleware/authMiddleware.js
const jwt = require('jsonwebtoken');
const User = require('../models/User');

module.exports = async function (req, res, next) {
  // Hämta token från headern
  const token = req.header('x-auth-token');

  // Kolla om token inte finns
  if (!token) {
    return res.status(401).json({ msg: 'No token, authorization denied' });
  }

  // Verifiera token
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.user.id).select('-password'); // Hämta användaren, men inte lösenordet
    next(); // Gå vidare till nästa funktion (själva routen)
  } catch (err) {
    res.status(401).json({ msg: 'Token is not valid' });
  }
};