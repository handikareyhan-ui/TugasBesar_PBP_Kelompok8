'use strict';

const request = require('supertest');
const crypto = require('crypto');
const { startTestServer, stopTestServer, credentials } = require('./utils/testHelper');

const baseURL = 'http://localhost:5057';

describe('🔍 Audit & History API Integration Tests', () => {
  let dinsosToken;
  let bankToken;
  let auditorToken;
  const testNik = "1200000000000007";
  let recipientID;

  beforeAll(async () => {
    await startTestServer();

    // Login
    const dinsosLogin = await request(baseURL)
      .post('/api/auth/login')
      .send(credentials.dinsos);
    dinsosToken = dinsosLogin.body.token;

    const bankLogin = await request(baseURL)
      .post('/api/auth/login')
      .send(credentials.bank);
    bankToken = bankLogin.body.token;

    const auditorLogin = await request(baseURL)
      .post('/api/auth/login')
      .send(credentials.auditor);
    auditorToken = auditorLogin.body.token;

    recipientID = crypto.createHash('sha256').update(testNik).digest('hex');

    // Register test recipient
    await request(baseURL)
      .post('/api/recipient')
      .set('Authorization', `Bearer ${dinsosToken}`)
      .send({
        nik: testNik,
        name: "Clint Barton",
        region: "ID-JK-01",
        actualIncome: 1300000,
        dependents: 3
      });
  });

  afterAll(() => {
    stopTestServer();
  });

  test('Retrieve recipient ledger history using Auditor token should succeed', async () => {
    const res = await request(baseURL)
      .get(`/api/audit/history/${recipientID}`)
      .set('Authorization', `Bearer ${auditorToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0]).toHaveProperty('txId');
  });

  test('Retrieve recipient state details using Dinsos token should succeed', async () => {
    const res = await request(baseURL)
      .get(`/api/audit/state/${recipientID}`)
      .set('Authorization', `Bearer ${dinsosToken}`);

    expect(res.status).toBe(200);
    expect(res.body.recipientID).toBe(recipientID);
    expect(res.body.region).toBe("ID-JK-01");
  });

  test('Querying history using Bank token should be rejected with 403 Forbidden', async () => {
    const res = await request(baseURL)
      .get(`/api/audit/history/${recipientID}`)
      .set('Authorization', `Bearer ${bankToken}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('UNAUTHORIZED');
  });

  test('Querying nonexistent recipient state should return 404 Not Found', async () => {
    const res = await request(baseURL)
      .get(`/api/audit/state/non_existent_id_12345`)
      .set('Authorization', `Bearer ${auditorToken}`);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('NOT_FOUND');
  });

  test('Retrieve all blocks structures for visualizer should succeed', async () => {
    const res = await request(baseURL)
      .get('/api/audit/blocks')
      .set('Authorization', `Bearer ${auditorToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});
