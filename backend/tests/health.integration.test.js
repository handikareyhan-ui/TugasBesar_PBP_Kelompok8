'use strict';

const request = require('supertest');
const { startTestServer, stopTestServer } = require('./utils/testHelper');

const baseURL = 'http://localhost:5057';

beforeAll(async () => {
  await startTestServer();
});

afterAll(() => {
  stopTestServer();
});

describe('🩺 Health & Readiness Endpoints', () => {
  test('GET /health returns HTTP 200 with status UP', async () => {
    const res = await request(baseURL)
      .get('/health');
      
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'UP' });
  });

  test('GET /ready returns HTTP 200 (READY) or 503 (NOT_READY) diagnostics', async () => {
    const res = await request(baseURL)
      .get('/ready');
      
    expect([200, 503]).toContain(res.status);
    expect(res.body).toHaveProperty('status');
    
    if (res.status === 200) {
      expect(res.body.status).toBe('READY');
    } else {
      expect(res.body.status).toBe('NOT_READY');
      expect(res.body).toHaveProperty('diagnostics');
    }
  });
});
