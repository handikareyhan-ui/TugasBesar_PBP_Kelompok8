#!/bin/bash
set -e

PEER0_KEMENSOS_CA=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/kemensos.bansochain.gov.id/peers/peer0.kemensos.bansochain.gov.id/tls/ca.crt
PEER0_DINSOS_CA=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/dinsos.bansochain.gov.id/peers/peer0.dinsos.bansochain.gov.id/tls/ca.crt
PEER0_BANK_CA=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/bank.bansochain.gov.id/peers/peer0.bank.bansochain.gov.id/tls/ca.crt

echo "=== Installing Chaincode on Kemensos Peer ==="
docker exec -e "CORE_PEER_LOCALMSPID=KemensosMSP" \
  -e "CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/kemensos.bansochain.gov.id/users/Admin@kemensos.bansochain.gov.id/msp" \
  -e "CORE_PEER_TLS_ROOTCERT_FILE=$PEER0_KEMENSOS_CA" \
  peer0.kemensos.bansochain.gov.id peer lifecycle chaincode install /opt/gopath/src/github.com/chaincode/bansocc.tar.gz

echo "=== Installing Chaincode on Dinsos Peer ==="
docker exec -e "CORE_PEER_LOCALMSPID=DinsosMSP" \
  -e "CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/dinsos.bansochain.gov.id/users/Admin@dinsos.bansochain.gov.id/msp" \
  -e "CORE_PEER_TLS_ROOTCERT_FILE=$PEER0_DINSOS_CA" \
  -e "CORE_PEER_ADDRESS=peer0.dinsos.bansochain.gov.id:8051" \
  peer0.dinsos.bansochain.gov.id peer lifecycle chaincode install /opt/gopath/src/github.com/chaincode/bansocc.tar.gz

echo "=== Installing Chaincode on Bank Peer ==="
docker exec -e "CORE_PEER_LOCALMSPID=BankMSP" \
  -e "CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/bank.bansochain.gov.id/users/Admin@bank.bansochain.gov.id/msp" \
  -e "CORE_PEER_TLS_ROOTCERT_FILE=$PEER0_BANK_CA" \
  -e "CORE_PEER_ADDRESS=peer0.bank.bansochain.gov.id:9051" \
  peer0.bank.bansochain.gov.id peer lifecycle chaincode install /opt/gopath/src/github.com/chaincode/bansocc.tar.gz
