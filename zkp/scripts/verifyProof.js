'use strict';

const snarkjs = require('snarkjs');
const fs = require('fs');
const path = require('path');

async function run() {
    const proofPath = path.resolve('proof.json');
    const publicPath = path.resolve('public.json');
    const vkeyPath = path.join(__dirname, '..', 'keys', 'verification_key.json');

    if (!fs.existsSync(proofPath) || !fs.existsSync(publicPath)) {
        console.error("Error: proof.json or public.json not found in execution directory.");
        process.exit(1);
    }

    const proof = JSON.parse(fs.readFileSync(proofPath, 'utf8'));
    const publicSignals = JSON.parse(fs.readFileSync(publicPath, 'utf8'));

    if (!fs.existsSync(vkeyPath)) {
        console.error("Error: Verification key not found at keys directory. Compile the circuit first.");
        process.exit(1);
    }

    try {
        const vKey = JSON.parse(fs.readFileSync(vkeyPath, 'utf8'));
        const res = await snarkjs.groth16.verify(vKey, publicSignals, proof);

        if (res === true) {
            console.log("Verification result: VALID");
            return true;
        } else {
            console.log("Verification result: INVALID");
            return false;
        }
    } catch (err) {
        console.error("Error verifying proof:", err);
        process.exit(1);
    }
}

if (require.main === module) {
    run().then((res) => process.exit(res ? 0 : 1));
}

module.exports = { run };
