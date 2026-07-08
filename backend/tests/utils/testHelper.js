'use strict';

const snarkjs = require('snarkjs');
const { buildPoseidon } = require('circomlibjs');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const absoluteBackendDir = path.resolve(__dirname, '..', '..');
const wasmPath = path.resolve(absoluteBackendDir, '..', 'zkp', 'keys', 'eligibility.wasm');
const zkeyPath = path.resolve(absoluteBackendDir, '..', 'zkp', 'keys', 'eligibility_final.zkey');

let serverProcess = null;

// Reusable test credentials (pre-configured users)
const credentials = {
  kemensos: { username: "kemensos", password: "admin123" },
  dinsos: { username: "dinsos", password: "admin123" },
  bank: { username: "bank", password: "bank123" },
  auditor: { username: "auditor", password: "audit123" }
};

// Start the backend Express server on test port 5057
function startTestServer() {
  return new Promise(async (resolve, reject) => {
    if (serverProcess) {
      return resolve();
    }

    // Clear the test database to ensure a clean test state without locking issues
    try {
      const mongoose = require('mongoose');
      await mongoose.connect("mongodb://localhost:27017/bansoschain_integration_db?directConnection=true", { serverSelectionTimeoutMS: 2000 });
      const collections = mongoose.connection.collections;
      for (const key in collections) {
        try {
          await collections[key].deleteMany({});
        } catch (e) {}
      }
      await mongoose.disconnect();
    } catch (dbErr) {
      // Ignore database cleanup errors
    }

    const testEnv = {
      ...process.env,
      NODE_ENV: "development",
      PORT: "5057",
      JWT_SECRET: "integration_test_secret_key_2026",
      MONGODB_URI: "mongodb://localhost:27017/bansoschain_integration_db?directConnection=true",
      USE_MOCK: "true",
      FABRIC_NETWORK_PATH: "../network/connection-profile.json",
      FABRIC_WALLET_PATH: "./wallet",
      FABRIC_CHANNEL: "bansochannel",
      FABRIC_CHAINCODE: "bansocc"
    };

    serverProcess = spawn('node', ['server.js'], {
      cwd: absoluteBackendDir,
      env: testEnv
    });

    let started = false;

    serverProcess.stdout.on('data', (d) => {
      const output = d.toString();
      if (output.includes("running on port 5057") && !started) {
        started = true;
        resolve();
      }
    });

    serverProcess.stderr.on('data', (d) => {
      // Quiet stderr during test runs to clean output
    });

    serverProcess.on('error', (err) => {
      reject(err);
    });

    setTimeout(() => {
      if (!started) {
        reject(new Error("Timeout starting test server on port 5057"));
      }
    }, 8000);
  });
}

// Stop the test server subprocess
function stopTestServer() {
  if (serverProcess) {
    serverProcess.kill('SIGTERM');
    serverProcess = null;
  }
}

// Generate valid / invalid Groth16 eligibility ZKP proofs
async function generateZKProof({
  nik = "1234567890123456",
  salt = "987654321",
  nonce = "1",
  income = 1500000,
  dependents = 2,
  threshold = 2000000,
  minDependents = 1
} = {}) {
  if (!fs.existsSync(wasmPath) || !fs.existsSync(zkeyPath)) {
    throw new Error("WASM or Proving key missing. Cannot generate mock proofs.");
  }

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

  const { proof, publicSignals } = await snarkjs.groth16.fullProve(
    input,
    wasmPath,
    zkeyPath
  );

  return { proof, publicSignals, commitment, nullifierVal };
}

module.exports = {
  credentials,
  startTestServer,
  stopTestServer,
  generateZKProof
};
