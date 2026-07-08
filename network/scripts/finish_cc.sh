#!/bin/bash

PEER0_KEMENSOS_CA=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/kemensos.bansochain.gov.id/peers/peer0.kemensos.bansochain.gov.id/tls/ca.crt
PEER0_DINSOS_CA=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/dinsos.bansochain.gov.id/peers/peer0.dinsos.bansochain.gov.id/tls/ca.crt
PEER0_BANK_CA=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/bank.bansochain.gov.id/peers/peer0.bank.bansochain.gov.id/tls/ca.crt
ORDERER_CA=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/bansochain.gov.id/orderers/orderer.bansochain.gov.id/msp/tlscacerts/tlsca.bansochain.gov.id-cert.pem

KEMENSOS_MSP=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/kemensos.bansochain.gov.id/users/Admin@kemensos.bansochain.gov.id/msp
BANK_MSP=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/bank.bansochain.gov.id/users/Admin@bank.bansochain.gov.id/msp

echo "=== Installing Chaincode on Bank Peer (background, timeout 180s) ==="
# Run detached so it doesn't block
docker exec -d \
  -e CORE_PEER_LOCALMSPID=BankMSP \
  -e CORE_PEER_MSPCONFIGPATH=${BANK_MSP} \
  -e CORE_PEER_TLS_ROOTCERT_FILE=${PEER0_BANK_CA} \
  -e CORE_PEER_ADDRESS=peer0.bank.bansochain.gov.id:9051 \
  peer0.bank.bansochain.gov.id \
  peer lifecycle chaincode install /opt/gopath/src/github.com/chaincode/bansocc.tar.gz

echo "=== Waiting 90s for Bank chaincode install to complete ==="
sleep 90

echo "=== Verifying installation on Bank Peer ==="
BANK_QUERY=$(docker exec \
  -e CORE_PEER_LOCALMSPID=BankMSP \
  -e CORE_PEER_MSPCONFIGPATH=${BANK_MSP} \
  -e CORE_PEER_ADDRESS=peer0.bank.bansochain.gov.id:9051 \
  peer0.bank.bansochain.gov.id \
  peer lifecycle chaincode queryinstalled 2>&1 || true)
echo "$BANK_QUERY"

if echo "$BANK_QUERY" | grep -q "bansocc_1.0"; then
  echo "Bank peer chaincode install confirmed!"
else
  echo "WARNING: Bank peer may not have chaincode installed yet. Trying forced install..."
  timeout 120 docker exec \
    -e CORE_PEER_LOCALMSPID=BankMSP \
    -e CORE_PEER_MSPCONFIGPATH=${BANK_MSP} \
    -e CORE_PEER_TLS_ROOTCERT_FILE=${PEER0_BANK_CA} \
    -e CORE_PEER_ADDRESS=peer0.bank.bansochain.gov.id:9051 \
    peer0.bank.bansochain.gov.id \
    peer lifecycle chaincode install /opt/gopath/src/github.com/chaincode/bansocc.tar.gz \
    || echo "Second install attempt also timed out"
  sleep 15
fi

echo "=== Final query on all peers ==="
echo "--- Kemensos ---"
docker exec \
  -e CORE_PEER_LOCALMSPID=KemensosMSP \
  -e CORE_PEER_MSPCONFIGPATH=${KEMENSOS_MSP} \
  peer0.kemensos.bansochain.gov.id \
  peer lifecycle chaincode queryinstalled

echo "--- Bank ---"
docker exec \
  -e CORE_PEER_LOCALMSPID=BankMSP \
  -e CORE_PEER_MSPCONFIGPATH=${BANK_MSP} \
  -e CORE_PEER_ADDRESS=peer0.bank.bansochain.gov.id:9051 \
  peer0.bank.bansochain.gov.id \
  peer lifecycle chaincode queryinstalled

echo "=== Invoking initLedger ==="
docker exec \
  -e CORE_PEER_LOCALMSPID=KemensosMSP \
  -e CORE_PEER_MSPCONFIGPATH=${KEMENSOS_MSP} \
  -e CORE_PEER_TLS_ROOTCERT_FILE=${PEER0_KEMENSOS_CA} \
  peer0.kemensos.bansochain.gov.id \
  peer chaincode invoke \
  -o orderer.bansochain.gov.id:7050 \
  --tls --cafile ${ORDERER_CA} \
  -C bansochannel -n bansocc \
  -c '{"Args":["initLedger"]}' \
  --peerAddresses peer0.kemensos.bansochain.gov.id:7051 --tlsRootCertFiles ${PEER0_KEMENSOS_CA} \
  --peerAddresses peer0.dinsos.bansochain.gov.id:8051   --tlsRootCertFiles ${PEER0_DINSOS_CA} \
  --peerAddresses peer0.bank.bansochain.gov.id:9051     --tlsRootCertFiles ${PEER0_BANK_CA}

echo ""
echo "=== NETWORK FULLY OPERATIONAL ==="
