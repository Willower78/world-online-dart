module.exports = {
  testEnvironment: 'node',
  globalSetup: './tests/setup.js',
  globalTeardown: './tests/teardown.js',
  testTimeout: 30000,
  moduleNameMapper: {
    '^redis$': '<rootDir>/tests/mocks/redis.js',
  },
};
