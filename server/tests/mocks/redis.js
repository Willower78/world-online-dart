// A basic mock for the redis client to be used in Jest tests.
// It mocks the chainable 'on' and 'connect' methods, and l-rem/l-pop/r-push for matchmaking.
const redisMock = {
  on: jest.fn().mockReturnThis(),
  connect: jest.fn().mockResolvedValue(),
  lRem: jest.fn().mockResolvedValue(0),
  lPop: jest.fn().mockResolvedValue(null),
  rPush: jest.fn().mockResolvedValue(1),
  setEx: jest.fn().mockResolvedValue('OK'),
  get: jest.fn().mockResolvedValue(null),
  del: jest.fn().mockResolvedValue(1),
  keys: jest.fn().mockResolvedValue([]),
};

module.exports = {
  createClient: jest.fn(() => redisMock),
};
