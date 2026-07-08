pragma circom 2.0.0;

include "../../backend/node_modules/circomlib/circuits/poseidon.circom";

template Num2Bits(n) {
    signal input in;
    signal output out[n];
    var lc1 = 0;
    var e2 = 1;
    for (var i = 0; i<n; i++) {
        out[i] <-- (in >> i) & 1;
        out[i] * (out[i] - 1) === 0;
        lc1 += out[i] * e2;
        e2 = e2 + e2;
    }
    lc1 === in;
}

template LessThan(n) {
    signal input in[2];
    signal output out;

    // Checks if in[0] < in[1]
    // Uses 2^n offset to prevent underflow
    component n2b = Num2Bits(n + 1);
    n2b.in <== in[0] + (1 << n) - in[1];
    out <== 1 - n2b.out[n];
}

template LessEqualThan(n) {
    signal input in[2];
    signal output out;

    // Checks if in[0] <= in[1]
    // equivalent to in[0] < in[1] + 1
    component lt = LessThan(n);
    lt.in[0] <== in[0];
    lt.in[1] <== in[1] + 1;
    out <== lt.out;
}

template GreaterEqualThan(n) {
    signal input in[2];
    signal output out;

    // Checks if in[0] >= in[1]
    component lt = LessThan(n);
    lt.in[0] <== in[0];
    lt.in[1] <== in[1];
    out <== 1 - lt.out;
}

template EligibilityCheck() {
    // Private inputs
    signal input nik;
    signal input salt;
    signal input nonce;
    signal input income;
    signal input dependents;
    
    // Public inputs (explicit fixed order)
    signal input eligible;
    signal input recipientCommitment;
    signal input nullifier;
    signal input incomeThreshold;
    signal input minDependents;
    
    // 1. Range Constraints (Field overflow protection)
    component incomeRange = Num2Bits(32);
    incomeRange.in <== income;

    component dependentsRange = Num2Bits(32);
    dependentsRange.in <== dependents;

    component thresholdRange = Num2Bits(32);
    thresholdRange.in <== incomeThreshold;

    component minDependentsRange = Num2Bits(32);
    minDependentsRange.in <== minDependents;

    // 2. Poseidon Commitment: recipientCommitment = Poseidon(nik, salt)
    component commitmentHasher = Poseidon(2);
    commitmentHasher.inputs[0] <== nik;
    commitmentHasher.inputs[1] <== salt;
    recipientCommitment === commitmentHasher.out;

    // 3. Replay Protection: nullifier = Poseidon(nik, salt, nonce)
    component nullifierHasher = Poseidon(3);
    nullifierHasher.inputs[0] <== nik;
    nullifierHasher.inputs[1] <== salt;
    nullifierHasher.inputs[2] <== nonce;
    nullifier === nullifierHasher.out;

    // 4. Eligibility Evaluation
    // income <= incomeThreshold
    component le = LessEqualThan(32);
    le.in[0] <== income;
    le.in[1] <== incomeThreshold;

    // dependents >= minDependents
    component ge = GreaterEqualThan(32);
    ge.in[0] <== dependents;
    ge.in[1] <== minDependents;

    // Constrain public eligibility input to match evaluated logic
    eligible === le.out * ge.out;
}

component main {public [eligible, recipientCommitment, nullifier, incomeThreshold, minDependents]} = EligibilityCheck();
