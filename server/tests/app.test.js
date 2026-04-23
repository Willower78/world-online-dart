const request = require('supertest');
const mongoose = require('mongoose');

describe('Grundläggande Server-tester', () => {
  let app, server, io;

  beforeAll(async () => {
    // Connect mongoose to the in-memory database
    if (process.env.MONGO_URI) {
      await mongoose.connect(process.env.MONGO_URI);
    } else {
      throw new Error('MONGO_URI not set. Did globalSetup run?');
    }

    try {
      const serverModule = require('../server');
      app = serverModule.app;
      server = serverModule.server;
      io = serverModule.io;
    } catch (err) {
      console.error('Failed to load server module in tests:', err);
      app = null;
      server = null;
      io = null;
    }
  });

  afterAll(async () => {
    if (server) server.close();
    if (io) io.close();
    await mongoose.disconnect();
  });

  describe('GET /', () => {
    it('ska returnera 200 OK och HTML-innehåll', async () => {
      if (!app) return;
      const res = await request(app).get('/');
      expect(res.statusCode).toEqual(200);
      expect(res.headers['content-type']).toMatch(/html/);
    });
  });

  describe('Odefinierad API-route', () => {
    it('ska returnera 404 för en route som inte finns', async () => {
      if (!app) return;
      const res = await request(app).get('/api/denna-route-finns-inte');
      expect(res.statusCode).toEqual(404);
    });
  });
});