'use strict';

const fs = require('fs');
const path = require('path');
const snarkjs = require('snarkjs');
const { buildPoseidon } = require('circomlibjs');

// Set mock mode for testing
process.env.USE_MOCK = 'true';
const { getContract } = require('../../backend/config/fabricConfig');

const wasmPath = path.join(__dirname, '..', 'keys', 'eligibility.wasm');
const zkeyPath = path.join(__dirname, '..', 'keys', 'eligibility_final.zkey');
const vkeyPath = path.join(__dirname, '..', 'keys', 'verification_key.json');

async function runTests() {
    console.log("====================================================");
    console.log("       BANSOSCHAIN ZKP REGRESSION TEST SUITE        ");
    console.log("====================================================\n");

    const poseidon = await buildPoseidon();
    const vKey = JSON.parse(fs.readFileSync(vkeyPath, 'utf8'));

    const testResults = [];
    
    function logTestResult(name, success, message = "") {
        console.log(`[${success ? "PASS" : "FAIL"}] - ${name} ${message ? `(${message})` : ""}`);
        testResults.push({ name, success, message });
    }

    // Helper to generate proof parameters
    async function generateProofData({ income, dependents, salt, threshold, minDependents, nik, nonce }) {
        const hashCommitment = poseidon([BigInt(nik), BigInt(salt)]);
        const commitment = poseidon.F.toString(hashCommitment);
        
        const hashNullifier = poseidon([BigInt(nik), BigInt(salt), BigInt(nonce)]);
        const nullifierVal = poseidon.F.toString(hashNullifier);

        const isEligible = (income <= threshold) && (dependents >= minDependents);
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

        return await snarkjs.groth16.fullProve(input, wasmPath, zkeyPath);
    }

    // --- TEST 1: Valid Proof ---
    try {
        const nik = "1234567890123456";
        const salt = "987654321";
        const nonce = "1";
        const income = 1500000;
        const dependents = 2;
        const threshold = 2000000;
        const minDependents = 1;

        const { proof, publicSignals } = await generateProofData({
            income, dependents, salt, threshold, minDependents, nik, nonce
        });

        // 1. Cryptographic verify
        const cryptoSuccess = await snarkjs.groth16.verify(vKey, publicSignals, proof);
        
        // 2. Submit to Ledger
        const recipientID = "test_recipient_1";
        const hashCommitment = poseidon([BigInt(nik), BigInt(salt)]);
        const commitment = poseidon.F.toString(hashCommitment);

        const contract = await getContract();
        // Register recipient
        await contract.submitTransaction('registerRecipient', recipientID, 'ID-JK-01', 'hash123', commitment, 'KemensosAdmin');
        
        // Submit ZKP verify
        await contract.submitTransaction('verifyZKP', recipientID, JSON.stringify(proof), JSON.stringify(publicSignals), 'KemensosSystem');

        // Fetch state to verify eligibility update
        const recipientBytes = await contract.evaluateTransaction('getRecipient', recipientID);
        const recipient = JSON.parse(recipientBytes.toString());

        if (cryptoSuccess && recipient.zkpVerified && recipient.eligible) {
            logTestResult("Valid Proof", true);
        } else {
            logTestResult("Valid Proof", false, "State check failed");
        }
    } catch (err) {
        logTestResult("Valid Proof", false, err.message);
    }

    // --- TEST 2: Replay Protection ---
    try {
        const nik = "1234567890123456";
        const salt = "987654321";
        const nonce = "20"; // Unique nonce for replay protection test
        const income = 1500000;
        const dependents = 2;
        const threshold = 2000000;
        const minDependents = 1;

        const { proof, publicSignals } = await generateProofData({
            income, dependents, salt, threshold, minDependents, nik, nonce
        });

        const recipientID2 = "test_recipient_2";
        const hashCommitment = poseidon([BigInt(nik), BigInt(salt)]);
        const commitment = poseidon.F.toString(hashCommitment);

        const contract = await getContract();
        await contract.submitTransaction('registerRecipient', recipientID2, 'ID-JK-01', 'hash123', commitment, 'KemensosAdmin');

        // First submit should work
        await contract.submitTransaction('verifyZKP', recipientID2, JSON.stringify(proof), JSON.stringify(publicSignals), 'KemensosSystem');

        // Second submit with the same nullifier should throw an error
        const recipientID3 = "test_recipient_3";
        await contract.submitTransaction('registerRecipient', recipientID3, 'ID-JK-01', 'hash123', commitment, 'KemensosAdmin');

        try {
            await contract.submitTransaction('verifyZKP', recipientID3, JSON.stringify(proof), JSON.stringify(publicSignals), 'KemensosSystem');
            logTestResult("Replay Protection", false, "Accepted duplicate nullifier");
        } catch (err) {
            if (err.message.includes("spent")) {
                logTestResult("Replay Protection", true);
            } else {
                logTestResult("Replay Protection", false, err.message);
            }
        }
    } catch (err) {
        logTestResult("Replay Protection", false, err.message);
    }

    // --- TEST 3: Modified Commitment ---
    try {
        const nik = "1234567890123456";
        const salt = "987654321";
        const nonce = "2";
        const income = 1500000;
        const dependents = 2;
        const threshold = 2000000;
        const minDependents = 1;

        const { proof, publicSignals } = await generateProofData({
            income, dependents, salt, threshold, minDependents, nik, nonce
        });

        const recipientID4 = "test_recipient_4";
        const commitment = "different_commitment_hash";

        const contract = await getContract();
        await contract.submitTransaction('registerRecipient', recipientID4, 'ID-JK-01', 'hash123', commitment, 'KemensosAdmin');

        try {
            await contract.submitTransaction('verifyZKP', recipientID4, JSON.stringify(proof), JSON.stringify(publicSignals), 'KemensosSystem');
            logTestResult("Modified Commitment", false, "Accepted mismatching commitment");
        } catch (err) {
            if (err.message.includes("commitment mismatch")) {
                logTestResult("Modified Commitment", true);
            } else {
                logTestResult("Modified Commitment", false, err.message);
            }
        }
    } catch (err) {
        logTestResult("Modified Commitment", false, err.message);
    }

    // --- TEST 4: Modified Nullifier ---
    try {
        const nik = "1234567890123456";
        const salt = "987654321";
        const nonce = "3";
        const income = 1500000;
        const dependents = 2;
        const threshold = 2000000;
        const minDependents = 1;

        const { proof, publicSignals } = await generateProofData({
            income, dependents, salt, threshold, minDependents, nik, nonce
        });

        const modifiedSignals = [...publicSignals];
        modifiedSignals[2] = "9999999999999999999999999"; // Alter nullifier

        // Verify cryptographically
        const cryptoSuccess = await snarkjs.groth16.verify(vKey, modifiedSignals, proof);
        if (!cryptoSuccess) {
            logTestResult("Modified Nullifier", true);
        } else {
            logTestResult("Modified Nullifier", false, "Verification succeeded for altered nullifier");
        }
    } catch (err) {
        logTestResult("Modified Nullifier", false, err.message);
    }

    // --- TEST 5: Wrong Threshold ---
    try {
        const nik = "1234567890123456";
        const salt = "987654321";
        const nonce = "4";
        const income = 1500000;
        const dependents = 2;
        const threshold = 3000000; // Wrong threshold in proof
        const minDependents = 1;

        const { proof, publicSignals } = await generateProofData({
            income, dependents, salt, threshold, minDependents, nik, nonce
        });

        const recipientID5 = "test_recipient_5";
        const hashCommitment = poseidon([BigInt(nik), BigInt(salt)]);
        const commitment = poseidon.F.toString(hashCommitment);

        const contract = await getContract();
        await contract.submitTransaction('registerRecipient', recipientID5, 'ID-JK-01', 'hash123', commitment, 'KemensosAdmin');

        try {
            await contract.submitTransaction('verifyZKP', recipientID5, JSON.stringify(proof), JSON.stringify(publicSignals), 'KemensosSystem');
            logTestResult("Wrong Threshold", false, "Accepted incorrect policy threshold");
        } catch (err) {
            if (err.message.includes("Policy threshold mismatch")) {
                logTestResult("Wrong Threshold", true);
            } else {
                logTestResult("Wrong Threshold", false, err.message);
            }
        }
    } catch (err) {
        logTestResult("Wrong Threshold", false, err.message);
    }

    // --- TEST 6: Wrong MinDependents ---
    try {
        const nik = "1234567890123456";
        const salt = "987654321";
        const nonce = "5";
        const income = 1500000;
        const dependents = 2;
        const threshold = 2000000;
        const minDependents = 2; // Wrong minDependents in proof (expected: 1)

        const { proof, publicSignals } = await generateProofData({
            income, dependents, salt, threshold, minDependents, nik, nonce
        });

        const recipientID6 = "test_recipient_6";
        const hashCommitment = poseidon([BigInt(nik), BigInt(salt)]);
        const commitment = poseidon.F.toString(hashCommitment);

        const contract = await getContract();
        await contract.submitTransaction('registerRecipient', recipientID6, 'ID-JK-01', 'hash123', commitment, 'KemensosAdmin');

        try {
            await contract.submitTransaction('verifyZKP', recipientID6, JSON.stringify(proof), JSON.stringify(publicSignals), 'KemensosSystem');
            logTestResult("Wrong MinDependents", false, "Accepted incorrect policy minDependents");
        } catch (err) {
            if (err.message.includes("Policy threshold mismatch")) {
                logTestResult("Wrong MinDependents", true);
            } else {
                logTestResult("Wrong MinDependents", false, err.message);
            }
        }
    } catch (err) {
        logTestResult("Wrong MinDependents", false, err.message);
    }

    // --- TEST 7: Invalid Eligibility ---
    try {
        const nik = "1234567890123456";
        const salt = "987654321";
        const nonce = "6";
        const income = 2500000; // Higher than threshold (2000000)
        const dependents = 2;
        const threshold = 2000000;
        const minDependents = 1;

        const { proof, publicSignals } = await generateProofData({
            income, dependents, salt, threshold, minDependents, nik, nonce
        });

        const recipientID7 = "test_recipient_7";
        const hashCommitment = poseidon([BigInt(nik), BigInt(salt)]);
        const commitment = poseidon.F.toString(hashCommitment);

        const contract = await getContract();
        await contract.submitTransaction('registerRecipient', recipientID7, 'ID-JK-01', 'hash123', commitment, 'KemensosAdmin');

        try {
            await contract.submitTransaction('verifyZKP', recipientID7, JSON.stringify(proof), JSON.stringify(publicSignals), 'KemensosSystem');
            logTestResult("Invalid Eligibility", false, "Accepted ineligible recipient proof");
        } catch (err) {
            if (err.message.includes("not eligible")) {
                logTestResult("Invalid Eligibility", true);
            } else {
                logTestResult("Invalid Eligibility", false, err.message);
            }
        }
    } catch (err) {
        logTestResult("Invalid Eligibility", false, err.message);
    }

    // --- TEST 8: 32-bit Range Constraint ---
    try {
        const nik = "1234567890123456";
        const salt = "987654321";
        const nonce = "7";
        const income = 4294967296; // Overflow (2^32)
        const dependents = 2;
        const threshold = 2000000;
        const minDependents = 1;

        try {
            await generateProofData({
                income, dependents, salt, threshold, minDependents, nik, nonce
            });
            logTestResult("32-bit Range Constraint", false, "Circuit generated proof for overflow input");
        } catch (err) {
            // Check that it's a constraint error or assert failed in SnarkJS
            if (err.message.includes("Not all inputs have been set") || 
                err.message.includes("constraint") || 
                err.message.includes("unsatisfied") || 
                err.message.includes("Error: Only") ||
                err.message.includes("Assert Failed")) {
                logTestResult("32-bit Range Constraint", true, "Rejected overflow input as expected");
            } else {
                logTestResult("32-bit Range Constraint", false, err.message);
            }
        }
    } catch (err) {
        logTestResult("32-bit Range Constraint", false, err.message);
    }

    // --- TEST 9: Corrupted Proof ---
    try {
        const nik = "1234567890123456";
        const salt = "987654321";
        const nonce = "8";
        const income = 1500000;
        const dependents = 2;
        const threshold = 2000000;
        const minDependents = 1;

        const { proof, publicSignals } = await generateProofData({
            income, dependents, salt, threshold, minDependents, nik, nonce
        });

        const corruptedProof = { ...proof };
        corruptedProof.pi_a[0] = "1111111111111111111111111111111111111111"; // Corrupt proof element

        const cryptoSuccess = await snarkjs.groth16.verify(vKey, publicSignals, corruptedProof);
        if (!cryptoSuccess) {
            logTestResult("Corrupted Proof", true);
        } else {
            logTestResult("Corrupted Proof", false, "Verification succeeded for corrupted proof");
        }
    } catch (err) {
        logTestResult("Corrupted Proof", true, "Error thrown: " + err.message);
    }

    // --- TEST 10: Corrupted Verification Key ---
    try {
        const nik = "1234567890123456";
        const salt = "987654321";
        const nonce = "9";
        const income = 1500000;
        const dependents = 2;
        const threshold = 2000000;
        const minDependents = 1;

        const { proof, publicSignals } = await generateProofData({
            income, dependents, salt, threshold, minDependents, nik, nonce
        });

        const corruptedVKey = { ...vKey };
        corruptedVKey.vk_alpha_1 = ["0", "0", "0"]; // Corrupt key element

        try {
            const cryptoSuccess = await snarkjs.groth16.verify(corruptedVKey, publicSignals, proof);
            if (!cryptoSuccess) {
                logTestResult("Corrupted Verification Key", true);
            } else {
                logTestResult("Corrupted Verification Key", false, "Verification succeeded with corrupted key");
            }
        } catch (err) {
            logTestResult("Corrupted Verification Key", true, "Error thrown: " + err.message);
        }
    } catch (err) {
        logTestResult("Corrupted Verification Key", false, err.message);
    }

    console.log("\n====================================================");
    console.log("                  TEST SUMMARY                      ");
    console.log("====================================================");
    const passed = testResults.filter(r => r.success).length;
    console.log(`Total Tests Run: ${testResults.length}`);
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${testResults.length - passed}`);
    console.log("====================================================");

    if (passed === testResults.length) {
        console.log("\nALL TESTS PASSED SUCCESSFULLY! 🎉\n");
        process.exit(0);
    } else {
        console.log("\nSOME TESTS FAILED! ❌\n");
        process.exit(1);
    }
}

runTests().catch(err => {
    console.error("Test runner crashed:", err);
    process.exit(1);
});
