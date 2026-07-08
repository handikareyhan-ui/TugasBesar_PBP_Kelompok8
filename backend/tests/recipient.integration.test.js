'use strict';

const request = require('supertest');
const { startTestServer, stopTestServer, credentials } = require('./utils/testHelper');

const baseURL = 'http://localhost:5057';

describe('📝 Recipient API Integration Tests', () => {
  let dinsosToken;
  let bankToken;
  const testNik = "1200000000000001"; // Unique test NIK

  beforeAll(async () => {
    await startTestServer();
    
    // Fetch authorization tokens
    const dinsosLogin = await request(baseURL)
      .post('/api/auth/login')
      .send(credentials.dinsos);
    dinsosToken = dinsosLogin.body.token;

    const bankLogin = await request(baseURL)
      .post('/api/auth/login')
      .send(credentials.bank);
    bankToken = bankLogin.body.token;
  });

  afterAll(() => {
    stopTestServer();
  });

  test('Register recipient using Dinsos token should succeed', async () => {
    const payload = {
      nik: testNik,
      name: "Toni Stark",
      address: "Mansion Malibu",
      region: "ID-JK-01",
      actualIncome: 1200000,
      dependents: 3
    };

    const res = await request(baseURL)
      .post('/api/recipient')
      .set('Authorization', `Bearer ${dinsosToken}`)
      .send(payload);

    expect(res.status).toBe(201);
    expect(res.body.message).toBe("Recipient registered successfully");
    expect(res.body).toHaveProperty('recipientID');
    expect(res.body.region).toBe("ID-JK-01");
  });

  test('Duplicate registration should be rejected with 409 Conflict', async () => {
    const payload = {
      nik: testNik,
      name: "Toni Stark Duplicate",
      address: "Mansion Malibu",
      region: "ID-JK-01",
      actualIncome: 1200000,
      dependents: 3
    };

    const res = await request(baseURL)
      .post('/api/recipient')
      .set('Authorization', `Bearer ${dinsosToken}`)
      .send(payload);

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('DUPLICATE_RECORD');
  });

  test('Registration with Bank token should be rejected with 403 Forbidden', async () => {
    const payload = {
      nik: "1200000000000002",
      name: "Bruce Banner",
      region: "ID-JK-01",
      actualIncome: 800000,
      dependents: 1
    };

    const res = await request(baseURL)
      .post('/api/recipient')
      .set('Authorization', `Bearer ${bankToken}`)
      .send(payload);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('UNAUTHORIZED');
  });

  test('Registration with missing NIK should return 400 Bad Request', async () => {
    const payload = {
      name: "Thor Odinson",
      region: "ID-JK-01",
      actualIncome: 500000
    };

    const res = await request(baseURL)
      .post('/api/recipient')
      .set('Authorization', `Bearer ${dinsosToken}`)
      .send(payload);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('BAD_REQUEST');
  });

  test('Registration without JWT token should return 401 Unauthorized', async () => {
    const payload = {
      nik: "1200000000000003",
      name: "Steve Rogers",
      region: "ID-JK-01",
      actualIncome: 1000000
    };

    const res = await request(baseURL)
      .post('/api/recipient')
      .send(payload);

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});
