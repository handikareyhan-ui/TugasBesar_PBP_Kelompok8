#!/bin/bash
# compile.sh - Compile circom circuit and generate keys using snarkjs

# Exit immediately if a command exits with a non-zero status
set -e

CIRCUIT_DIR="../circuits"
KEYS_DIR="../keys"
BUILD_DIR="../build"

mkdir -p $KEYS_DIR
mkdir -p $BUILD_DIR

echo "=== Compiling Circom Circuit ==="
circom $CIRCUIT_DIR/eligibility.circom --r1cs --wasm --sym --output $BUILD_DIR

echo "=== Generating proving and verification keys ==="
# In a real environment, we'd fetch or use a public powers-of-tau file
# For local dev, we run a ceremony locally:
if [ ! -f "$KEYS_DIR/pot12_beacon.ptau" ]; then
    echo "Running local powers-of-tau ceremony phase 1..."
    npx snarkjs powersoftau new bn128 12 $KEYS_DIR/pot12_0000.ptau -v
    npx snarkjs powersoftau contribute $KEYS_DIR/pot12_0000.ptau $KEYS_DIR/pot12_0001.ptau --name="Contrib1" -v -e="some random text"
    npx snarkjs powersoftau prepare phase2 $KEYS_DIR/pot12_0001.ptau $KEYS_DIR/pot12_final.ptau -v
fi

echo "=== Setup Groth16 Proving Key ==="
npx snarkjs groth16 setup $BUILD_DIR/eligibility.r1cs $KEYS_DIR/pot12_final.ptau $KEYS_DIR/eligibility_0000.zkey
npx snarkjs zkey contribute $KEYS_DIR/eligibility_0000.zkey $KEYS_DIR/eligibility_final.zkey --name="Contrib2" -v -e="another random text"
npx snarkjs zkey export verificationkey $KEYS_DIR/eligibility_final.zkey $KEYS_DIR/verification_key.json

echo "=== Copying Wasm to keys directory for easy access ==="
cp $BUILD_DIR/eligibility_js/eligibility.wasm $KEYS_DIR/

echo "=== Circuit compiled. keys generated inside $KEYS_DIR ==="
