'use strict';

const request = require('supertest');
const crypto = require('crypto');
const { startTestServer, stopTestServer, credentials, generateZKProof } = require('./utils/testHelper');

const baseURL = 'http://localhost:5057';

describe('💵 Distribution API Integration Tests', () => {
  let dinsosToken;
  let bankToken;
  const testNik = "1200000000000006";
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

    recipientID = crypto.createHash('sha256').update(testNik).digest('hex');

    // 1. Register Recipient
    await request(baseURL)
      .post('/api/recipient')
      .set('Authorization', `Bearer ${dinsosToken}`)
      .send({
        nik: testNik,
        name: "Wanda Maximoff",
        region: "ID-JK-01",
        actualIncome: 1000000,
        dependents: 4
      });

    // 2. Query public status to retrieve the registered salt
    const queryRes = await request(baseURL)
      .get(`/api/recipient/public/query/${recipientID}`);
    const registeredSalt = queryRes.body.salt;

    // 3. Generate ZK Proof using retrieved salt
    const proofData = await generateZKProof({
      nik: testNik,
      salt: registeredSalt,
      nonce: "10",
      income: 1000000,
      dependents: 4
    });

    // 4. Verify ZK Proof to mark as eligible on-ledger
    await request(baseURL)
      .post('/api/eligibility/verify')
      .set('Authorization', `Bearer ${dinsosToken}`)
      .send({
        recipientID,
        proof: proofData.proof,
        publicSignals: proofData.publicSignals
      });
  }, 25000);

  afterAll(() => {
    stopTestServer();
  });

  test('Valid payout requested by Bank should succeed', async () => {
    const res = await request(baseURL)
      .post('/api/distribution')
      .set('Authorization', `Bearer ${bankToken}`)
      .send({ recipientID });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Bansos funds distributed successfully");
    expect(res.body.fundsDistributed).toBe(true);
  });

  test('Double payout should be blocked with 400 Bad Request', async () => {
    const res = await request(baseURL)
      .post('/api/distribution')
      .set('Authorization', `Bearer ${bankToken}`)
      .send({ recipientID });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('DISTRIBUTION_POLICY_VIOLATION');
  });

  test('Payout requested by Dinsos should be rejected with 403 Forbidden', async () => {
    const res = await request(baseURL)
      .post('/api/distribution')
      .set('Authorization', `Bearer ${dinsosToken}`)
      .send({ recipientID: "some_other_id" });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('UNAUTHORIZED');
  });

  test('Payout with missing recipientID should return 400 Bad Request', async () => {
    const res = await request(baseURL)
      .post('/api/distribution')
      .set('Authorization', `Bearer ${bankToken}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('BAD_REQUEST');
  });

  test('Revoked recipient should not be able to receive funds', async () => {
    const testNikRevoke = "1200000000000009";
    const recipientIDRevoke = crypto.createHash('sha256').update(testNikRevoke).digest('hex');

    // Register
    await request(baseURL)
      .post('/api/recipient')
      .set('Authorization', `Bearer ${dinsosToken}`)
      .send({
        nik: testNikRevoke,
        name: "Revoke User",
        region: "ID-JK-01",
        actualIncome: 1000000,
        dependents: 4
      });

    // Query salt
    const queryRes = await request(baseURL)
      .get(`/api/recipient/public/query/${recipientIDRevoke}`);
    const salt = queryRes.body.salt;

    // Verify ZKP
    const proofData = await generateZKProof({
      nik: testNikRevoke,
      salt: salt,
      nonce: "11",
      income: 1000000,
      dependents: 4
    });

    await request(baseURL)
      .post('/api/eligibility/verify')
      .set('Authorization', `Bearer ${dinsosToken}`)
      .send({
        recipientID: recipientIDRevoke,
        proof: proofData.proof,
        publicSignals: proofData.publicSignals
      });

    // Revoke access (restricted to admin, using dinsosToken)
    const revokeRes = await request(baseURL)
      .post('/api/recipient/revoke')
      .set('Authorization', `Bearer ${dinsosToken}`)
      .send({
        recipientID: recipientIDRevoke,
        reason: "Test revocation reason"
      });
    expect(revokeRes.status).toBe(200);
    expect(revokeRes.body.eligible).toBe(false);

    // Try distributing funds (should fail)
    const disburseRes = await request(baseURL)
      .post('/api/distribution')
      .set('Authorization', `Bearer ${bankToken}`)
      .send({ recipientID: recipientIDRevoke });

    expect(disburseRes.status).toBe(400);
    expect(disburseRes.body.success).toBe(false);
    expect(disburseRes.body.code).toBe('DISTRIBUTION_POLICY_VIOLATION');
    expect(disburseRes.body.error).toContain('is not marked as eligible');
  });

  test('Unverified recipient should not be able to receive funds', async () => {
    const testNikUnverified = "1200000000000010";
    const recipientIDUnverified = crypto.createHash('sha256').update(testNikUnverified).digest('hex');

    // Register but do not verify ZKP
    await request(baseURL)
      .post('/api/recipient')
      .set('Authorization', `Bearer ${dinsosToken}`)
      .send({
        nik: testNikUnverified,
        name: "Unverified User",
        region: "ID-JK-01",
        actualIncome: 1000000,
        dependents: 4
      });

    // Try distributing funds (should fail)
    const disburseRes = await request(baseURL)
      .post('/api/distribution')
      .set('Authorization', `Bearer ${bankToken}`)
      .send({ recipientID: recipientIDUnverified });

    expect(disburseRes.status).toBe(400);
    expect(disburseRes.body.success).toBe(false);
    expect(disburseRes.body.code).toBe('DISTRIBUTION_POLICY_VIOLATION');
    expect(disburseRes.body.error).toContain('has not verified eligibility via Zero-Knowledge Proof');
  });

  test('Ineligible (nonexistent) recipient should not receive funds', async () => {
    const nonexistentID = "0000000000000000000000000000000000000000000000000000000000000000";
    const disburseRes = await request(baseURL)
      .post('/api/distribution')
      .set('Authorization', `Bearer ${bankToken}`)
      .send({ recipientID: nonexistentID });

    expect(disburseRes.status).toBe(404);
  });
});
