# compile.ps1 - PowerShell equivalent of compile.sh for Windows host
$ErrorActionPreference = "Stop"

$CIRCUIT_DIR = "zkp/circuits"
$KEYS_DIR = "zkp/keys"
$BUILD_DIR = "zkp/build"
$FRONTEND_ZKP = "frontend/public/zkp"
$CHAINCODE_LIB = "chaincode/bansos/lib"

# Ensure directories exist
New-Item -ItemType Directory -Force -Path $KEYS_DIR | Out-Null
New-Item -ItemType Directory -Force -Path $BUILD_DIR | Out-Null
New-Item -ItemType Directory -Force -Path $FRONTEND_ZKP | Out-Null

Write-Host "=== Compiling Circom Circuit ==="
& circom "$CIRCUIT_DIR/eligibility.circom" --r1cs --wasm --sym --output $BUILD_DIR

Write-Host "=== Setup Groth16 Proving Key ==="
# Reuse pot12_final.ptau if it exists, otherwise generate it
if (-not (Test-Path "$KEYS_DIR/pot12_final.ptau")) {
    Write-Host "Generating local powers-of-tau ceremony..."
    & npx snarkjs powersoftau new bn128 12 "$KEYS_DIR/pot12_0000.ptau" -v
    & npx snarkjs powersoftau contribute "$KEYS_DIR/pot12_0000.ptau" "$KEYS_DIR/pot12_0001.ptau" --name="Contrib1" -v -e="some random text"
    & npx snarkjs powersoftau prepare phase2 "$KEYS_DIR/pot12_0001.ptau" "$KEYS_DIR/pot12_final.ptau" -v
}

Write-Host "Re-setup Groth16 Proving Key..."
& npx snarkjs groth16 setup "$BUILD_DIR/eligibility.r1cs" "$KEYS_DIR/pot12_final.ptau" "$KEYS_DIR/eligibility_0000.zkey"
& npx snarkjs zkey contribute "$KEYS_DIR/eligibility_0000.zkey" "$KEYS_DIR/eligibility_final.zkey" --name="Contrib2" -v -e="another random text"
& npx snarkjs zkey export verificationkey "$KEYS_DIR/eligibility_final.zkey" "$KEYS_DIR/verification_key.json"

Write-Host "=== Copying Wasm and Keys to deployment folders ==="
Copy-Item "$BUILD_DIR/eligibility_js/eligibility.wasm" "$KEYS_DIR/eligibility.wasm" -Force
Copy-Item "$KEYS_DIR/eligibility.wasm" "$FRONTEND_ZKP/eligibility.wasm" -Force
Copy-Item "$KEYS_DIR/eligibility_final.zkey" "$FRONTEND_ZKP/eligibility_final.zkey" -Force
Copy-Item "$KEYS_DIR/verification_key.json" "$CHAINCODE_LIB/verification_key.json" -Force

Write-Host "=== Circuit compiled and keys successfully distributed! ==="
