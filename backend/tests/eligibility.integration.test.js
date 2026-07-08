'use strict';

const request = require('supertest');
const crypto = require('crypto');
const { startTestServer, stopTestServer, credentials, generateZKProof } = require('./utils/testHelper');

const baseURL = 'http://localhost:5057';

describe('🛡️ ZKP Verification Integration Tests', () => {
  let dinsosToken;
  const testNik = "1200000000000004";
  const testNonce = "42"; // Unique test nonce
  let recipientID;
  let validProof;
  let validPublicSignals;

  beforeAll(async () => {
    await startTestServer();

    // Login
    const dinsosLogin = await request(baseURL)
      .post('/api/auth/login')
      .send(credentials.dinsos);
    dinsosToken = dinsosLogin.body.token;

    recipientID = crypto.createHash('sha256').update(testNik).digest('hex');

    // 1. Register recipient off-chain (generates salt automatically)
    await request(baseURL)
      .post('/api/recipient')
      .set('Authorization', `Bearer ${dinsosToken}`)
      .send({
        nik: testNik,
        name: "Peter Parker",
        region: "ID-JK-01",
        actualIncome: 1500000,
        dependents: 2,
        documentText: "doc-verif-peter"
      });

    // 2. Query public mapping to retrieve the registered salt
    const queryRes = await request(baseURL)
      .get(`/api/recipient/public/query/${recipientID}`);
    const registeredSalt = queryRes.body.salt;

    // 3. Generate ZKP proof dynamically using the retrieved salt
    const proofData = await generateZKProof({
      nik: testNik,
      salt: registeredSalt,
      nonce: testNonce,
      income: 1500000,
      dependents: 2,
      threshold: 2000000,
      minDependents: 1
    });

    validProof = proofData.proof;
    validPublicSignals = proofData.publicSignals;
  }, 25000); // Allow time for compilation

  afterAll(() => {
    stopTestServer();
  });

  test('Submit valid proof should succeed on-chain', async () => {
    const res = await request(baseURL)
      .post('/api/eligibility/verify')
      .set('Authorization', `Bearer ${dinsosToken}`)
      .send({
        recipientID,
        proof: validProof,
        publicSignals: validPublicSignals
      });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("ZKP verification succeeded");
    expect(res.body.zkpVerified).toBe(true);
    expect(res.body.eligible).toBe(true);
  });

  test('Submit replayed nullifier should be blocked', async () => {
    // Replay valid proof containing the already spent nullifier for the same recipientID
    const res = await request(baseURL)
      .post('/api/eligibility/verify')
      .set('Authorization', `Bearer ${dinsosToken}`)
      .send({
        recipientID,
        proof: validProof,
        publicSignals: validPublicSignals
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('REPLAY_ATTACK_ATTEMPT');
  });

  test('Submit corrupted proof should be rejected', async () => {
    const corruptedProof = { ...validProof };
    corruptedProof.pi_a = ["111111111111111111111111111111111111111", "222222222222222222222222222222"];

    const res = await request(baseURL)
      .post('/api/eligibility/verify')
      .set('Authorization', `Bearer ${dinsosToken}`)
      .send({
        recipientID,
        proof: corruptedProof,
        publicSignals: validPublicSignals
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('INVALID_PROOF');
  });

  test('Submit modified publicSignals should fail cryptographic verification', async () => {
    const modifiedSignals = [...validPublicSignals];
    // Alter threshold signal
    modifiedSignals[3] = "9999999"; 

    const res = await request(baseURL)
      .post('/api/eligibility/verify')
      .set('Authorization', `Bearer ${dinsosToken}`)
      .send({
        recipientID,
        proof: validProof,
        publicSignals: modifiedSignals
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('INVALID_PROOF');
  });

  test('Submit commitment mismatch should trigger error', async () => {
    const mismatchNik = "1200000000000005";
    const mismatchID = crypto.createHash('sha256').update(mismatchNik).digest('hex');

    // Register recipient with mismatch commitment
    await request(baseURL)
      .post('/api/recipient')
      .set('Authorization', `Bearer ${dinsosToken}`)
      .send({
        nik: mismatchNik,
        name: "Carol Danvers",
        region: "ID-JK-01",
        actualIncome: 1000000,
        dependents: 1
      });

    // Try to verify, but send validProof (which has Peter Parker's commitment instead of Carol's)
    const res = await request(baseURL)
      .post('/api/eligibility/verify')
      .set('Authorization', `Bearer ${dinsosToken}`)
      .send({
        recipientID: mismatchID,
        proof: validProof, // commitment mismatch against registered commitment
        publicSignals: validPublicSignals
      });

    expect(res.status).toBe(503); // Mismatches return 503 ledger write failed errors on contract validations
    expect(res.body.success).toBe(false);
  });

  test('Submit malformed JSON should return 400 Bad Request', async () => {
    const res = await request(baseURL)
      .post('/api/eligibility/verify')
      .set('Authorization', `Bearer ${dinsosToken}`)
      .send({
        recipientID,
        proof: "not-an-object",
        publicSignals: "not-an-array"
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('BAD_REQUEST');
  });
});
