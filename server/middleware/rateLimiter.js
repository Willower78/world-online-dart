const rateLimit = require('express-rate-limit');

// Disable rate limits during tests so the test suite can hit /login and
// /register freely. `express-rate-limit` respects `skip`, which lets the
// middleware remain mounted in the production config while being a no-op in
// jest.
const skipInTests = () => process.env.NODE_ENV === 'test';

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTests,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  skipSuccessfulRequests: true,
  message: 'Too many authentication attempts.',
  skip: skipInTests,
});

const postLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: 'Posting too quickly.',
  skip: skipInTests,
});

module.exports = {
  apiLimiter,
  authLimiter,
  postLimiter,
};
