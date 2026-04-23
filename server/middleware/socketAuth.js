const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Socket.IO Authentication Middleware
 * Verifies JWT token on socket connection and attaches user data.
 */
const socketAuth = async (socket, next) => {
  try {
    const token = socket.handshake.auth.token || socket.handshake.query.token;

    if (!token) {
      socket.authenticated = false;
      return next();
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.user.id).select('username isSubscriber');

    if (!user) {
        console.error(`[Socket Auth] ❌ Authenticated user not found in DB: ${decoded.user.id}`);
        return next(new Error('User not found'));
    }

    socket.userId = user._id.toString();
    socket.username = user.username;
    socket.isSubscriber = user.isSubscriber;
    socket.authenticated = true;

    console.log(`[Socket Auth] ✅ User ${socket.username} (${socket.userId}) authenticated (Subscriber: ${socket.isSubscriber})`);
    next();
  } catch (err) {
    console.error('[Socket Auth] ❌ Authentication failed:', err.message);
    // Do not expose internal errors to the client, just fail the connection.
    next(new Error('Authentication error'));
  }
};

module.exports = socketAuth;
