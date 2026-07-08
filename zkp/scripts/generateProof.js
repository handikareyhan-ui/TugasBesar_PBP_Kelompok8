const snarkjs = require('snarkjs');
const fs = require('fs');
const path = require('path');
const { buildPoseidon } = require('circomlibjs');

async function run() {
    // Inputs from command line or defaults
    const income = parseInt(process.argv[2] || "1500000");
    const dependents = parseInt(process.argv[3] || "2");
    const salt = parseInt(process.argv[4] || "987654321");
    const incomeThreshold = parseInt(process.argv[5] || "2000000");
    const minDependents = parseInt(process.argv[6] || "1");
    const nikInput = process.argv[7] || "1234567890123456";
    const nonce = parseInt(process.argv[8] || "1");

    const wasmPath = path.join(__dirname, '..', 'keys', 'eligibility.wasm');
    const zkeyPath = path.join(__dirname, '..', 'keys', 'eligibility_final.zkey');

    console.log(`Generating proof for income=${income}, dependents=${dependents}, salt=${salt}, threshold=${incomeThreshold}, minDependents=${minDependents}, NIK=${nikInput}, nonce=${nonce}...`);

    if (!fs.existsSync(wasmPath) || !fs.existsSync(zkeyPath)) {
        console.error("Error: Compiled WASM or Proving Key not found at keys directory. Compile the circuit first.");
        process.exit(1);
    }

    try {
        const poseidon = await buildPoseidon();
        const hashCommitment = poseidon([BigInt(nikInput), BigInt(salt)]);
        const commitment = poseidon.F.toString(hashCommitment);
        
        const hashNullifier = poseidon([BigInt(nikInput), BigInt(salt), BigInt(nonce)]);
        const nullifierVal = poseidon.F.toString(hashNullifier);

        const isEligible = (income <= incomeThreshold) && (dependents >= minDependents);
        const eligibleSignal = isEligible ? "1" : "0";

        const input = {
            nik: nikInput.toString(),
            salt: salt.toString(),
            nonce: nonce.toString(),
            income: income.toString(),
            dependents: dependents.toString(),
            eligible: eligibleSignal,
            recipientCommitment: commitment,
            nullifier: nullifierVal,
            incomeThreshold: incomeThreshold.toString(),
            minDependents: minDependents.toString()
        };

        const { proof, publicSignals } = await snarkjs.groth16.fullProve(
            input,
            wasmPath,
            zkeyPath
        );

        fs.writeFileSync('proof.json', JSON.stringify(proof, null, 2));
        fs.writeFileSync('public.json', JSON.stringify(publicSignals, null, 2));

        console.log("ZK Proof generated successfully!");
        console.log("Proof file: proof.json");
        console.log("Public signals file: public.json");
        console.log("Is Eligible: ", publicSignals[0] === "1" ? "Yes" : "No");
    } catch (err) {
        console.error("Error generating proof:", err);
        process.exit(1);
    }
}

if (require.main === module) {
    run().then(() => process.exit(0));
}

module.exports = { run };
