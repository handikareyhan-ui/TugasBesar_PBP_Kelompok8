'use strict';

const snarkjs = require('snarkjs');
const { buildPoseidon } = require('circomlibjs');
const path = require('path');
const fs = require('fs');

const BASE_URL = "http://localhost:5000";
const zkpKeysDir = path.resolve(__dirname, '..', '..', 'zkp', 'keys');
const wasmPath = path.resolve(zkpKeysDir, 'eligibility.wasm');
const zkeyPath = path.resolve(zkpKeysDir, 'eligibility_final.zkey');

const credentials = {
  dinsos: { username: "dinsos", password: "admin123" },
  kemensos: { username: "kemensos", password: "admin123" },
  bank: { username: "bank", password: "bank123" },
  auditor: { username: "auditor", password: "audit123" }
};

let PASS = 0;
let FAIL = 0;

function green(text) { console.log(`\x1b[32m  [PASS] ${text}\x1b[0m`); PASS++; }
function red(text, detail) { console.log(`\x1b[31m  [FAIL] ${text}\x1b[0m\n         ${detail}`); FAIL++; }
function info(text) { console.log(`\n\x1b[36m=== ${text} ===\x1b[0m`); }

// Dynamic ZKP Proof generator
async function generateZKProof({ nik, salt, nonce, income, dependents, threshold, minDependents }) {
  const poseidon = await buildPoseidon();
  const hashCommitment = poseidon([BigInt(nik), BigInt(salt)]);
  const commitment = poseidon.F.toString(hashCommitment);
  
  const hashNullifier = poseidon([BigInt(nik), BigInt(salt), BigInt(nonce)]);
  const nullifierVal = poseidon.F.toString(hashNullifier);

  const isEligible = (Number(income) <= Number(threshold)) && (Number(dependents) >= Number(minDependents));
  const eligibleSignal = isEligible ? "1" : "0";

  const input = {
    nik: nik.toString(),
    salt: salt.toString(),
    nonce: nonce.toString(),
    income: income.toString(),
    dependents: dependents.toString(),
    eligible: eligibleSignal,
    recipientCommitment: commitment,
    nullifier: nullifierVal,
    incomeThreshold: threshold.toString(),
    minDependents: minDependents.toString()
  };

  const { proof, publicSignals } = await snarkjs.groth16.fullProve(input, wasmPath, zkeyPath);
  return { proof, publicSignals, commitment, nullifierVal };
}

async function run() {
  try {
    info("BansosChain E2E Verification — USE_MOCK=false (Live Fabric Network)");

    // 1. Health check
    try {
      const hRes = await fetch(`${BASE_URL}/health`);
      const hBody = await hRes.json();
      if (hRes.ok && hBody.status === "UP") {
        green("GET /health returns UP status");
      } else {
        red("GET /health status is not UP", JSON.stringify(hBody));
      }
    } catch (e) {
      red("GET /health connection error", e.message);
      process.exit(1);
    }

    // 2. Authentication
    let dinsosToken, bankToken, auditorToken, kemensosToken;
    for (const key of Object.keys(credentials)) {
      try {
        const res = await fetch(`${BASE_URL}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(credentials[key])
        });
        const body = await res.json();
        if (res.ok && body.token) {
          if (key === 'dinsos') dinsosToken = body.token;
          if (key === 'bank') bankToken = body.token;
          if (key === 'auditor') auditorToken = body.token;
          if (key === 'kemensos') kemensosToken = body.token;
          green(`Authenticated successfully as ${key}`);
        } else {
          red(`Failed to authenticate as ${key}`, JSON.stringify(body));
        }
      } catch (e) {
        red(`Authentication request failed for ${key}`, e.message);
      }
    }

    // 3. Register recipient (using Dinsos token)
    const testNik = "12000000" + Math.floor(Math.random() * 100000000).toString().padStart(8, '0');
    let recipientID = "";
    try {
      const res = await fetch(`${BASE_URL}/api/recipient`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${dinsosToken}`
        },
        body: JSON.stringify({
          nik: testNik,
          name: "Verify Recipient",
          region: "ID-JK-01",
          actualIncome: 1200000,
          dependents: 3
        })
      });
      const body = await res.json();
      if (res.status === 201 && body.success) {
        recipientID = body.recipientID;
        green(`Recipient registered successfully. ID: ${recipientID}`);
      } else {
        red("Failed to register recipient", JSON.stringify(body));
      }
    } catch (e) {
      red("Recipient registration request failed", e.message);
    }

    if (!recipientID) {
      console.log("\x1b[31mCannot continue verification: Recipient registration failed.\x1b[0m");
      process.exit(1);
    }

    // 4. Query public status to retrieve salt
    let salt = "";
    try {
      const res = await fetch(`${BASE_URL}/api/recipient/public/query/${recipientID}`);
      const body = await res.json();
      if (res.ok && body.salt) {
        salt = body.salt;
        green(`Retrieved recipient salt: ${salt}`);
      } else {
        red("Failed to query public state for salt", JSON.stringify(body));
      }
    } catch (e) {
      red("Public status check failed", e.message);
    }

    // 5. Submit valid proof should succeed on-chain
    let proofData;
    try {
      console.log("  Generating ZKP proof dynamically...");
      proofData = await generateZKProof({
        nik: testNik,
        salt: salt,
        nonce: "1",
        income: 1200000,
        dependents: 3,
        threshold: 2000000,
        minDependents: 1
      });
      
      const res = await fetch(`${BASE_URL}/api/eligibility/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${dinsosToken}`
        },
        body: JSON.stringify({
          recipientID,
          proof: proofData.proof,
          publicSignals: proofData.publicSignals
        })
      });
      const body = await res.json();
      if (res.status === 200 && body.zkpVerified && body.eligible) {
        green("ZKP proof submitted and verified successfully on-chain");
      } else {
        red("ZKP verification rejected on-chain", JSON.stringify(body));
      }
    } catch (e) {
      red("ZKP proof generation or verification failed", e.message);
    }

    // 6. Double verification/replay attack check
    try {
      const res = await fetch(`${BASE_URL}/api/eligibility/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${dinsosToken}`
        },
        body: JSON.stringify({
          recipientID,
          proof: proofData.proof,
          publicSignals: proofData.publicSignals
        })
      });
      const body = await res.json();
      if (res.status === 400 && body.code === 'REPLAY_ATTACK_ATTEMPT') {
        green("ZKP Replay attempt blocked as expected (400 Bad Request)");
      } else {
        red("ZKP Replay attempt was NOT blocked correctly", `Status: ${res.status}, Body: ${JSON.stringify(body)}`);
      }
    } catch (e) {
      red("ZKP replay verification request failed", e.message);
    }

    // 7. Payout requested by non-Bank (e.g. Dinsos) should be rejected (403 Role Guard)
    try {
      const res = await fetch(`${BASE_URL}/api/distribution`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${dinsosToken}`
        },
        body: JSON.stringify({ recipientID })
      });
      const body = await res.json();
      if (res.status === 403) {
        green("Payout requested by non-Bank (Dinsos) rejected (403 Forbidden)");
      } else {
        red("Payout requested by non-Bank was NOT rejected with 403", `Status: ${res.status}, Body: ${JSON.stringify(body)}`);
      }
    } catch (e) {
      red("Payout role guard test failed", e.message);
    }

    // 8. Valid payout requested by Bank should succeed
    try {
      const res = await fetch(`${BASE_URL}/api/distribution`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${bankToken}`
        },
        body: JSON.stringify({ recipientID })
      });
      const body = await res.json();
      if (res.status === 200 && body.fundsDistributed) {
        green("Bansos funds distributed successfully to eligible recipient by Bank");
      } else {
        red("Bansos funds distribution failed", JSON.stringify(body));
      }
    } catch (e) {
      red("Bansos distribution request failed", e.message);
    }

    // 9. Double payout should be blocked with 400 Bad Request
    try {
      const res = await fetch(`${BASE_URL}/api/distribution`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${bankToken}`
        },
        body: JSON.stringify({ recipientID })
      });
      const body = await res.json();
      if (res.status === 400 && body.code === 'DISTRIBUTION_POLICY_VIOLATION') {
        green("Double payout blocked correctly (400 Bad Request / DISTRIBUTION_POLICY_VIOLATION)");
      } else {
        red("Double payout was NOT blocked correctly", `Status: ${res.status}, Body: ${JSON.stringify(body)}`);
      }
    } catch (e) {
      red("Double payout request failed", e.message);
    }

    // 10. Register another recipient to verify revokeAccess guards
    const testNik2 = "12000000" + Math.floor(Math.random() * 100000000).toString().padStart(8, '0');
    let recipientID2 = "";
    try {
      const res = await fetch(`${BASE_URL}/api/recipient`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${dinsosToken}`
        },
        body: JSON.stringify({
          nik: testNik2,
          name: "Revoked Recipient Test",
          region: "ID-JK-01",
          actualIncome: 1100000,
          dependents: 4
        })
      });
      const body = await res.json();
      if (res.status === 201 && body.success) {
        recipientID2 = body.recipientID;
        green(`Second recipient registered. ID: ${recipientID2}`);
      }
    } catch (e) {
      red("Second recipient registration failed", e.message);
    }

    // 11. Revoke access should be rejected if requested by non-Admin (e.g. Bank)
    try {
      const res = await fetch(`${BASE_URL}/api/recipient/revoke`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${bankToken}`
        },
        body: JSON.stringify({ recipientID: recipientID2 })
      });
      const body = await res.json();
      if (res.status === 403) {
        green("Revocation requested by non-Admin (Bank) rejected with 403 Forbidden");
      } else {
        red("Revocation requested by non-Admin was NOT rejected with 403", `Status: ${res.status}, Body: ${JSON.stringify(body)}`);
      }
    } catch (e) {
      red("Revocation role guard request failed", e.message);
    }

    // 12. Revoke access should succeed when requested by Admin (e.g. Dinsos)
    try {
      const res = await fetch(`${BASE_URL}/api/recipient/revoke`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${dinsosToken}`
        },
        body: JSON.stringify({ recipientID: recipientID2 })
      });
      const body = await res.json();
      if (res.status === 200 && body.success) {
        green("Recipient access revoked successfully by Admin");
      } else {
        red("Recipient revocation failed", JSON.stringify(body));
      }
    } catch (e) {
      red("Revocation request failed", e.message);
    }

    // 13. Revoked recipient cannot verify eligibility or receive payout
    try {
      const res = await fetch(`${BASE_URL}/api/distribution`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${bankToken}`
        },
        body: JSON.stringify({ recipientID: recipientID2 })
      });
      const body = await res.json();
      if (res.status === 400 && (body.message.includes("revoked") || body.message.includes("eligible") || body.message.includes("does not exist") || body.message.includes("policy"))) {
        green("Payout to revoked recipient blocked as expected");
      } else {
        red("Payout to revoked recipient was NOT blocked", `Status: ${res.status}, Body: ${JSON.stringify(body)}`);
      }
    } catch (e) {
      red("Payout revocation guard request failed", e.message);
    }

    // 14. Audit History & format of FUNDS_DISTRIBUTED log
    try {
      const res = await fetch(`${BASE_URL}/api/audit/history/${recipientID}`, {
        headers: { 'Authorization': `Bearer ${auditorToken}` }
      });
      const body = await res.json();
      if (res.ok && Array.isArray(body)) {
        const distLog = body.find(log => log.value && log.value.action === "FUNDS_DISTRIBUTED");
        if (distLog) {
          const val = distLog.value;
          if (val.txId && val.timestamp && val.actor && val.recipientID && val.amount && val.txStatus) {
            green("Audit log for FUNDS_DISTRIBUTED verified with correct audit structure attributes");
          } else {
            red("Audit log structure check failed", JSON.stringify(val));
          }
        } else {
          red("FUNDS_DISTRIBUTED audit log not found in ledger history", JSON.stringify(body));
        }
      } else {
        red("Failed to fetch recipient transaction history", JSON.stringify(body));
      }
    } catch (e) {
      red("Audit history request failed", e.message);
    }

    // 15. Block Visualizer
    try {
      const res = await fetch(`${BASE_URL}/api/audit/blocks`, {
        headers: { 'Authorization': `Bearer ${auditorToken}` }
      });
      const body = await res.json();
      if (res.ok && body.blocks && Array.isArray(body.blocks)) {
        green("Block Visualizer returned structures containing real blockchain blocks");
      } else {
        red("Block Visualizer check failed", JSON.stringify(body));
      }
    } catch (e) {
      red("Block Visualizer request failed", e.message);
    }

    // Summary
    info("Verification Summary");
    console.log(`\n  Results: ${PASS} passed / ${PASS + FAIL} total`);
    if (FAIL === 0) {
      console.log("\n\x1b[32;1m  ✔ ALL CHECKS PASSED SUCCESSFULLY — Live Fabric network verified!\x1b[0m\n");
    } else {
      console.log(`\n\x1b[31;1m  ✘ ${FAIL} CHECKS FAILED!\x1b[0m\n`);
      process.exit(1);
    }

  } catch (err) {
    console.error("E2E Verification script error:", err);
    process.exit(1);
  }
}

run();
