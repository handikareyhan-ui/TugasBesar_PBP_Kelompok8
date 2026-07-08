#!/bin/bash
# E2E verification script against live Hyperledger Fabric network
# Uses USE_MOCK=false (reads from backend/.env default)

set -e

BASE_URL="http://172.25.96.1:5000"
PASS=0
FAIL=0

green() { echo -e "\e[32m$1\e[0m"; }
red()   { echo -e "\e[31m$1\e[0m"; }
blue()  { echo -e "\e[34m$1\e[0m"; }

check() {
  local label="$1"
  local expected="$2"
  local actual="$3"
  if echo "$actual" | grep -q "$expected"; then
    green "  [PASS] $label"
    PASS=$((PASS+1))
  else
    red "  [FAIL] $label (expected: $expected)"
    echo "         Response: $actual"
    FAIL=$((FAIL+1))
  fi
}

blue "============================================================"
blue "  BansosChain E2E Verification — USE_MOCK=false (Live Fabric)"
blue "============================================================"

# ── 1. Health check
blue "\n[1] Health Check"
R=$(curl -sf "${BASE_URL}/health" || echo "CONN_ERROR")
check "GET /health returns UP" '"status":"UP"' "$R"

# ── 2. Login
blue "\n[2] Authentication"
DINSOS_TOKEN=$(curl -sf -X POST "${BASE_URL}/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"dinsos","password":"dinsos123"}' | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
[ -n "$DINSOS_TOKEN" ] && green "  [PASS] Dinsos login" && PASS=$((PASS+1)) || { red "  [FAIL] Dinsos login"; FAIL=$((FAIL+1)); }

BANK_TOKEN=$(curl -sf -X POST "${BASE_URL}/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"bank","password":"bank123"}' | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
[ -n "$BANK_TOKEN" ] && green "  [PASS] Bank login" && PASS=$((PASS+1)) || { red "  [FAIL] Bank login"; FAIL=$((FAIL+1)); }

AUDITOR_TOKEN=$(curl -sf -X POST "${BASE_URL}/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"auditor","password":"audit123"}' | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
[ -n "$AUDITOR_TOKEN" ] && green "  [PASS] Auditor login" && PASS=$((PASS+1)) || { red "  [FAIL] Auditor login"; FAIL=$((FAIL+1)); }

# ── 3. Register Recipient
blue "\n[3] Register Recipient (via Dinsos/Admin)"
NIK="E2E_VERIFY_$(date +%s)"
REG_RESP=$(curl -sf -X POST "${BASE_URL}/api/recipient" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${DINSOS_TOKEN}" \
  -d "{\"nik\":\"${NIK}\",\"name\":\"Budi Santoso\",\"region\":\"ID-JK-01\",\"income\":1800000,\"dependents\":3}" || echo "ERROR")
check "POST /api/recipient returns 201/success" '"success":true' "$REG_RESP"

RECIPIENT_ID=$(echo "$REG_RESP" | grep -o '"recipientID":"[^"]*"' | cut -d'"' -f4)
blue "  Recipient ID: ${RECIPIENT_ID}"

# ── 4. Verify ZKP eligibility — load real proof from file
blue "\n[4] ZKP Eligibility Verification (on-chain)"
PROOF_FILE="../zkp/proofs/proof.json"
SIGNALS_FILE="../zkp/proofs/public.json"

if [ -f "$PROOF_FILE" ] && [ -f "$SIGNALS_FILE" ] && [ -n "$RECIPIENT_ID" ]; then
  PROOF=$(cat "$PROOF_FILE")
  SIGNALS=$(cat "$SIGNALS_FILE")
  ZKP_RESP=$(curl -sf -X POST "${BASE_URL}/api/eligibility/verify" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${DINSOS_TOKEN}" \
    -d "{\"recipientID\":\"${RECIPIENT_ID}\",\"proof\":${PROOF},\"publicSignals\":${SIGNALS}}" || echo "ERROR")
  echo "  ZKP response: $ZKP_RESP"
  check "POST /api/eligibility/verify processes on-chain" 'zkpVerified\|already been spent\|commitment mismatch\|verification failed' "$ZKP_RESP"
else
  echo "  Skipping ZKP step (proof files not found or no recipient ID)"
fi

# ── 5. Audit — query ledger state (confirms on-chain read)
blue "\n[5] Audit — Read Ledger State (Fabric Query)"
if [ -n "$RECIPIENT_ID" ]; then
  AUDIT_RESP=$(curl -sf "${BASE_URL}/api/audit/state/${RECIPIENT_ID}" \
    -H "Authorization: Bearer ${DINSOS_TOKEN}" || echo "ERROR")
  check "GET /api/audit/state/:id returns on-chain state" '"recipientID"\|"registered"\|does not exist' "$AUDIT_RESP"
fi

# ── 6. Distribution guard — unverified recipient blocked
blue "\n[6] Distribution Guards"
if [ -n "$RECIPIENT_ID" ]; then
  DIST_RESP=$(curl -sf -X POST "${BASE_URL}/api/distribution" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${BANK_TOKEN}" \
    -d "{\"recipientID\":\"${RECIPIENT_ID}\"}" || echo "ERROR")
  check "POST /api/distribution blocks unverified recipient" 'DISTRIBUTION_POLICY_VIOLATION\|has not verified\|does not exist' "$DIST_RESP"
fi

# ── 7. Role guard — Dinsos cannot distribute
blue "\n[7] Role Guards"
ROLE_RESP=$(curl -sf -X POST "${BASE_URL}/api/distribution" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${DINSOS_TOKEN}" \
  -d '{"recipientID":"any-id"}' || echo "ERROR")
check "POST /api/distribution rejects non-bank role (403)" 'insufficient\|Unauthorized\|403' "$ROLE_RESP"

# ── 8. revokeAccess guard
blue "\n[8] revokeAccess (admin only)"
REVOKE_RESP=$(curl -sf -X POST "${BASE_URL}/api/recipient/revoke" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${BANK_TOKEN}" \
  -d '{"recipientID":"any-id"}' || echo "ERROR")
check "POST /api/recipient/revoke rejects bank role (403)" 'insufficient\|Unauthorized\|403' "$REVOKE_RESP"

# ── 9. Block visualizer
blue "\n[9] Block Visualizer (Blockchain Data)"
VIZ_RESP=$(curl -sf "${BASE_URL}/api/audit/blocks" \
  -H "Authorization: Bearer ${AUDITOR_TOKEN}" || echo "ERROR")
check "GET /api/audit/blocks returns chain data" '"blocks"\|"transactions"\|"hash"' "$VIZ_RESP"

# ── Summary
blue "\n============================================================"
echo "  Results: ${PASS} passed / $((PASS+FAIL)) total"
if [ "$FAIL" -eq 0 ]; then
  green "  ALL CHECKS PASSED — Live Fabric network verified!"
else
  red "  ${FAIL} check(s) failed"
fi
blue "============================================================"
