const rateLimit = require('express-rate-limit');

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  skipSuccessfulRequests: true,
  message: 'Too many authentication attempts.',
});

const postLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: 'Posting too quickly.',
});

module.exports = {
  apiLimiter,
  authLimiter,
  postLimiter,
};
