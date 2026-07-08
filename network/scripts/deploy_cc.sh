#!/bin/bash
set -e

CHANNEL_NAME="bansochannel"
CHAINCODE_NAME="bansocc"
CHAINCODE_VERSION="1.0"
# Package ID from previously successful install
PACKAGE_ID="bansocc_1.0:54ad0c82bcd18a6e14a593078307e429094f7025185efbeaa0ddfa2c77c6ad29"

ORDERER_CA=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/bansochain.gov.id/orderers/orderer.bansochain.gov.id/msp/tlscacerts/tlsca.bansochain.gov.id-cert.pem
PEER0_KEMENSOS_CA=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/kemensos.bansochain.gov.id/peers/peer0.kemensos.bansochain.gov.id/tls/ca.crt
PEER0_DINSOS_CA=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/dinsos.bansochain.gov.id/peers/peer0.dinsos.bansochain.gov.id/tls/ca.crt
PEER0_BANK_CA=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/bank.bansochain.gov.id/peers/peer0.bank.bansochain.gov.id/tls/ca.crt

KEMENSOS_MSP=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/kemensos.bansochain.gov.id/users/Admin@kemensos.bansochain.gov.id/msp
DINSOS_MSP=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/dinsos.bansochain.gov.id/users/Admin@dinsos.bansochain.gov.id/msp
BANK_MSP=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/bank.bansochain.gov.id/users/Admin@bank.bansochain.gov.id/msp

echo "Package ID: ${PACKAGE_ID}"

echo "=== [1/4] Approving Chaincode for Kemensos ==="
docker exec \
  -e CORE_PEER_LOCALMSPID=KemensosMSP \
  -e CORE_PEER_MSPCONFIGPATH=${KEMENSOS_MSP} \
  -e CORE_PEER_TLS_ROOTCERT_FILE=${PEER0_KEMENSOS_CA} \
  peer0.kemensos.bansochain.gov.id \
  peer lifecycle chaincode approveformyorg \
  -o orderer.bansochain.gov.id:7050 \
  --channelID ${CHANNEL_NAME} \
  --name ${CHAINCODE_NAME} \
  --version ${CHAINCODE_VERSION} \
  --package-id ${PACKAGE_ID} \
  --sequence 1 \
  --tls \
  --cafile ${ORDERER_CA}

echo "=== [1/4] Approving Chaincode for Dinsos ==="
docker exec \
  -e CORE_PEER_LOCALMSPID=DinsosMSP \
  -e CORE_PEER_MSPCONFIGPATH=${DINSOS_MSP} \
  -e CORE_PEER_TLS_ROOTCERT_FILE=${PEER0_DINSOS_CA} \
  -e CORE_PEER_ADDRESS=peer0.dinsos.bansochain.gov.id:8051 \
  peer0.dinsos.bansochain.gov.id \
  peer lifecycle chaincode approveformyorg \
  -o orderer.bansochain.gov.id:7050 \
  --channelID ${CHANNEL_NAME} \
  --name ${CHAINCODE_NAME} \
  --version ${CHAINCODE_VERSION} \
  --package-id ${PACKAGE_ID} \
  --sequence 1 \
  --tls \
  --cafile ${ORDERER_CA}

echo "=== [1/4] Approving Chaincode for Bank ==="
docker exec \
  -e CORE_PEER_LOCALMSPID=BankMSP \
  -e CORE_PEER_MSPCONFIGPATH=${BANK_MSP} \
  -e CORE_PEER_TLS_ROOTCERT_FILE=${PEER0_BANK_CA} \
  -e CORE_PEER_ADDRESS=peer0.bank.bansochain.gov.id:9051 \
  peer0.bank.bansochain.gov.id \
  peer lifecycle chaincode approveformyorg \
  -o orderer.bansochain.gov.id:7050 \
  --channelID ${CHANNEL_NAME} \
  --name ${CHAINCODE_NAME} \
  --version ${CHAINCODE_VERSION} \
  --package-id ${PACKAGE_ID} \
  --sequence 1 \
  --tls \
  --cafile ${ORDERER_CA}

echo "=== [2/4] Checking Commit Readiness ==="
docker exec \
  -e CORE_PEER_LOCALMSPID=KemensosMSP \
  -e CORE_PEER_MSPCONFIGPATH=${KEMENSOS_MSP} \
  -e CORE_PEER_TLS_ROOTCERT_FILE=${PEER0_KEMENSOS_CA} \
  peer0.kemensos.bansochain.gov.id \
  peer lifecycle chaincode checkcommitreadiness \
  --channelID ${CHANNEL_NAME} \
  --name ${CHAINCODE_NAME} \
  --version ${CHAINCODE_VERSION} \
  --sequence 1 \
  --tls \
  --cafile ${ORDERER_CA} \
  --output json

echo "=== [3/4] Committing Chaincode Definition ==="
docker exec \
  -e CORE_PEER_LOCALMSPID=KemensosMSP \
  -e CORE_PEER_MSPCONFIGPATH=${KEMENSOS_MSP} \
  -e CORE_PEER_TLS_ROOTCERT_FILE=${PEER0_KEMENSOS_CA} \
  peer0.kemensos.bansochain.gov.id \
  peer lifecycle chaincode commit \
  -o orderer.bansochain.gov.id:7050 \
  --channelID ${CHANNEL_NAME} \
  --name ${CHAINCODE_NAME} \
  --version ${CHAINCODE_VERSION} \
  --sequence 1 \
  --tls \
  --cafile ${ORDERER_CA} \
  --peerAddresses peer0.kemensos.bansochain.gov.id:7051 \
  --tlsRootCertFiles ${PEER0_KEMENSOS_CA} \
  --peerAddresses peer0.dinsos.bansochain.gov.id:8051 \
  --tlsRootCertFiles ${PEER0_DINSOS_CA} \
  --peerAddresses peer0.bank.bansochain.gov.id:9051 \
  --tlsRootCertFiles ${PEER0_BANK_CA}

echo "=== [4/4] Invoking initLedger ==="
docker exec \
  -e CORE_PEER_LOCALMSPID=KemensosMSP \
  -e CORE_PEER_MSPCONFIGPATH=${KEMENSOS_MSP} \
  -e CORE_PEER_TLS_ROOTCERT_FILE=${PEER0_KEMENSOS_CA} \
  peer0.kemensos.bansochain.gov.id \
  peer chaincode invoke \
  -o orderer.bansochain.gov.id:7050 \
  --tls \
  --cafile ${ORDERER_CA} \
  -C ${CHANNEL_NAME} \
  -n ${CHAINCODE_NAME} \
  -c '{"Args":["initLedger"]}' \
  --peerAddresses peer0.kemensos.bansochain.gov.id:7051 \
  --tlsRootCertFiles ${PEER0_KEMENSOS_CA} \
  --peerAddresses peer0.dinsos.bansochain.gov.id:8051 \
  --tlsRootCertFiles ${PEER0_DINSOS_CA} \
  --peerAddresses peer0.bank.bansochain.gov.id:9051 \
  --tlsRootCertFiles ${PEER0_BANK_CA}

echo ""
echo "=== CHAINCODE '${CHAINCODE_NAME}' v${CHAINCODE_VERSION} DEPLOYED SUCCESSFULLY ON '${CHANNEL_NAME}' ==="
