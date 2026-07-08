'use strict';

const request = require('supertest');
const { startTestServer, stopTestServer, credentials } = require('./utils/testHelper');

const baseURL = 'http://localhost:5057';

beforeAll(async () => {
  await startTestServer();
});

afterAll(() => {
  stopTestServer();
});

describe('🔑 Authentication Integration Tests', () => {
  test('Successful login for Dinsos', async () => {
    const res = await request(baseURL)
      .post('/api/auth/login')
      .send(credentials.dinsos);
      
    expect(res.status).toBe(200);
    expect(res.body.success).toBeUndefined(); // Schema maps to JWT directly
    expect(res.body).toHaveProperty('token');
    expect(res.body.role).toBe('admin');
    expect(res.body.username).toBe('dinsos');
  });

  test('Successful login for Kemensos', async () => {
    const res = await request(baseURL)
      .post('/api/auth/login')
      .send(credentials.kemensos);
      
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body.role).toBe('admin');
    expect(res.body.username).toBe('kemensos');
  });

  test('Successful login for Bank', async () => {
    const res = await request(baseURL)
      .post('/api/auth/login')
      .send(credentials.bank);
      
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body.role).toBe('bank');
    expect(res.body.username).toBe('bank');
  });

  test('Successful login for Auditor', async () => {
    const res = await request(baseURL)
      .post('/api/auth/login')
      .send(credentials.auditor);
      
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body.role).toBe('auditor');
    expect(res.body.username).toBe('auditor');
  });

  test('Invalid credentials should return 401 Unauthorized', async () => {
    const res = await request(baseURL)
      .post('/api/auth/login')
      .send({ username: "dinsos", password: "wrong_password" });
      
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('UNAUTHORIZED');
  });

  test('Missing password should return 400 Bad Request', async () => {
    const res = await request(baseURL)
      .post('/api/auth/login')
      .send({ username: "dinsos" });
      
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('BAD_REQUEST');
  });
});
