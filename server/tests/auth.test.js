const request = require('supertest');
const mongoose = require('mongoose');

describe('Auth Routes', () => {
  let app, server, io;
  let User;

  beforeAll(async () => {
    // The globalSetup should have set this environment variable.
    if (!process.env.MONGO_URI) {
      throw new Error('MONGO_URI not set. Did globalSetup run?');
    }
    // Connect mongoose to the in-memory database
    await mongoose.connect(process.env.MONGO_URI);

    const serverModule = require('../server');
    app = serverModule.app;
    server = serverModule.server;
    io = serverModule.io;
  });

  afterAll(async () => {
    if (server) server.close();
    if (io) io.close();
    await mongoose.disconnect();
  });

  beforeEach(async () => {
    User = mongoose.model('User');
    await User.deleteMany({});
  });

  afterEach(async () => {
    await User.deleteMany({});
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user and return a token', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'testuser',
          email: 'test@example.com',
          password: 'password123',
        });
      expect(res.statusCode).toEqual(201);
      expect(res.body).toHaveProperty('token');
      expect(res.body).toHaveProperty('user');
      expect(res.body.user.username).toBe('testuser');
    });

    it('should not register a user with an existing email', async () => {
      await request(app)
        .post('/api/auth/register')
        .send({
          username: 'testuser',
          email: 'test@example.com',
          password: 'password123',
        });

      const res = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'testuser2',
          email: 'test@example.com',
          password: 'password123',
        });
      expect(res.statusCode).toEqual(400);
      expect(res.body.msg).toBe('User already exists');
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      await request(app)
        .post('/api/auth/register')
        .send({
          username: 'testuser',
          email: 'test@example.com',
          password: 'password123',
        });
    });

    it('should login a registered user and return a token', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password123',
        });
      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('token');
      expect(res.body).toHaveProperty('user');
      expect(res.body.user.email).toBe('test@example.com');
    });

    it('should not login with invalid credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'wrongpassword',
        });
      expect(res.statusCode).toEqual(400);
      expect(res.body.msg).toBe('Invalid Credentials');
    });
  });
});
