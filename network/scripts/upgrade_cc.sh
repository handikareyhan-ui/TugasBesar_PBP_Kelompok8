#!/bin/bash
# upgrade_cc.sh - Script to upgrade the smart contract inline on the running Fabric network
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export FABRIC_CFG_PATH="${DIR}/.."

CHANNEL_NAME="bansochannel"
CHAINCODE_NAME="bansocc"
CHAINCODE_VERSION="1.3"
CHAINCODE_SEQUENCE="4"

echo "Sleeping 20 seconds to allow containers to stabilize and elect Raft leader..."
sleep 20

ORDERER_CA=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/bansochain.gov.id/orderers/orderer1.bansochain.gov.id/msp/tlscacerts/tlsca.bansochain.gov.id-cert.pem
PEER0_KEMENSOS_CA=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/kemensos.bansochain.gov.id/peers/peer0.kemensos.bansochain.gov.id/tls/ca.crt
PEER0_DINSOS_CA=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/dinsos.bansochain.gov.id/peers/peer0.dinsos.bansochain.gov.id/tls/ca.crt
PEER0_BANK_CA=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/bank.bansochain.gov.id/peers/peer0.bank.bansochain.gov.id/tls/ca.crt

echo "=== Packaging Chaincode Version ${CHAINCODE_VERSION} ==="
docker exec -e "CORE_PEER_LOCALMSPID=KemensosMSP" \
  -e "CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/kemensos.bansochain.gov.id/users/Admin@kemensos.bansochain.gov.id/msp" \
  peer0.kemensos.bansochain.gov.id peer lifecycle chaincode package /opt/gopath/src/github.com/chaincode/bansocc_${CHAINCODE_VERSION}.tar.gz \
  --path /opt/gopath/src/github.com/chaincode/bansos \
  --lang node \
  --label bansocc_${CHAINCODE_VERSION}

echo "=== Installing Chaincode on Kemensos Peer ==="
docker exec -e "CORE_PEER_LOCALMSPID=KemensosMSP" \
  -e "CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/kemensos.bansochain.gov.id/users/Admin@kemensos.bansochain.gov.id/msp" \
  -e "CORE_PEER_TLS_ROOTCERT_FILE=$PEER0_KEMENSOS_CA" \
  peer0.kemensos.bansochain.gov.id peer lifecycle chaincode install /opt/gopath/src/github.com/chaincode/bansocc_${CHAINCODE_VERSION}.tar.gz || true

echo "=== Installing Chaincode on Dinsos Peer ==="
docker exec -e "CORE_PEER_LOCALMSPID=DinsosMSP" \
  -e "CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/dinsos.bansochain.gov.id/users/Admin@dinsos.bansochain.gov.id/msp" \
  -e "CORE_PEER_TLS_ROOTCERT_FILE=$PEER0_DINSOS_CA" \
  -e "CORE_PEER_ADDRESS=peer0.dinsos.bansochain.gov.id:8051" \
  peer0.dinsos.bansochain.gov.id peer lifecycle chaincode install /opt/gopath/src/github.com/chaincode/bansocc_${CHAINCODE_VERSION}.tar.gz || true

echo "=== Installing Chaincode on Bank Peer ==="
docker exec -e "CORE_PEER_LOCALMSPID=BankMSP" \
  -e "CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/bank.bansochain.gov.id/users/Admin@bank.bansochain.gov.id/msp" \
  -e "CORE_PEER_TLS_ROOTCERT_FILE=$PEER0_BANK_CA" \
  -e "CORE_PEER_ADDRESS=peer0.bank.bansochain.gov.id:9051" \
  peer0.bank.bansochain.gov.id peer lifecycle chaincode install /opt/gopath/src/github.com/chaincode/bansocc_${CHAINCODE_VERSION}.tar.gz || true

echo "=== Querying Installed Chaincode to get Package ID ==="
CC_OUTPUT=$(docker exec -e "CORE_PEER_LOCALMSPID=KemensosMSP" \
  -e "CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/kemensos.bansochain.gov.id/users/Admin@kemensos.bansochain.gov.id/msp" \
  peer0.kemensos.bansochain.gov.id peer lifecycle chaincode queryinstalled)
echo "$CC_OUTPUT"

PACKAGE_ID=$(echo "$CC_OUTPUT" | grep -oE "bansocc_${CHAINCODE_VERSION}:[^, ]+" | head -n 1 || true)
if [ -z "$PACKAGE_ID" ]; then
  PACKAGE_ID=$(echo "$CC_OUTPUT" | sed -n "s/.*Package ID: \([^,]*\),.*/\1/p" | grep "bansocc_${CHAINCODE_VERSION}" | head -n 1)
fi
echo "Package ID: $PACKAGE_ID"

echo "=== Approving Chaincode Definition for Kemensos Org ==="
docker exec -e "CORE_PEER_LOCALMSPID=KemensosMSP" \
  -e "CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/kemensos.bansochain.gov.id/users/Admin@kemensos.bansochain.gov.id/msp" \
  -e "CORE_PEER_TLS_ROOTCERT_FILE=$PEER0_KEMENSOS_CA" \
  peer0.kemensos.bansochain.gov.id peer lifecycle chaincode approveformyorg \
  -o orderer1.bansochain.gov.id:7050 \
  --channelID $CHANNEL_NAME \
  --name $CHAINCODE_NAME \
  --version $CHAINCODE_VERSION \
  --package-id $PACKAGE_ID \
  --sequence $CHAINCODE_SEQUENCE \
  --tls \
  --cafile $ORDERER_CA

echo "=== Approving Chaincode Definition for Dinsos Org ==="
docker exec -e "CORE_PEER_LOCALMSPID=DinsosMSP" \
  -e "CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/dinsos.bansochain.gov.id/users/Admin@dinsos.bansochain.gov.id/msp" \
  -e "CORE_PEER_TLS_ROOTCERT_FILE=$PEER0_DINSOS_CA" \
  -e "CORE_PEER_ADDRESS=peer0.dinsos.bansochain.gov.id:8051" \
  peer0.dinsos.bansochain.gov.id peer lifecycle chaincode approveformyorg \
  -o orderer1.bansochain.gov.id:7050 \
  --channelID $CHANNEL_NAME \
  --name $CHAINCODE_NAME \
  --version $CHAINCODE_VERSION \
  --package-id $PACKAGE_ID \
  --sequence $CHAINCODE_SEQUENCE \
  --tls \
  --cafile $ORDERER_CA

echo "=== Approving Chaincode Definition for Bank Org ==="
docker exec -e "CORE_PEER_LOCALMSPID=BankMSP" \
  -e "CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/bank.bansochain.gov.id/users/Admin@bank.bansochain.gov.id/msp" \
  -e "CORE_PEER_TLS_ROOTCERT_FILE=$PEER0_BANK_CA" \
  -e "CORE_PEER_ADDRESS=peer0.bank.bansochain.gov.id:9051" \
  peer0.bank.bansochain.gov.id peer lifecycle chaincode approveformyorg \
  -o orderer1.bansochain.gov.id:7050 \
  --channelID $CHANNEL_NAME \
  --name $CHAINCODE_NAME \
  --version $CHAINCODE_VERSION \
  --package-id $PACKAGE_ID \
  --sequence $CHAINCODE_SEQUENCE \
  --tls \
  --cafile $ORDERER_CA

echo "=== Committing Chaincode Definition ==="
docker exec -e "CORE_PEER_LOCALMSPID=KemensosMSP" \
  -e "CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/kemensos.bansochain.gov.id/users/Admin@kemensos.bansochain.gov.id/msp" \
  -e "CORE_PEER_TLS_ROOTCERT_FILE=$PEER0_KEMENSOS_CA" \
  peer0.kemensos.bansochain.gov.id peer lifecycle chaincode commit \
  -o orderer1.bansochain.gov.id:7050 \
  --channelID $CHANNEL_NAME \
  --name $CHAINCODE_NAME \
  --version $CHAINCODE_VERSION \
  --sequence $CHAINCODE_SEQUENCE \
  --tls \
  --cafile $ORDERER_CA \
  --peerAddresses peer0.kemensos.bansochain.gov.id:7051 \
  --tlsRootCertFiles $PEER0_KEMENSOS_CA \
  --peerAddresses peer0.dinsos.bansochain.gov.id:8051 \
  --tlsRootCertFiles $PEER0_DINSOS_CA \
  --peerAddresses peer0.bank.bansochain.gov.id:9051 \
  --tlsRootCertFiles $PEER0_BANK_CA

echo "=== Chaincode upgraded successfully to version ${CHAINCODE_VERSION} ==="
