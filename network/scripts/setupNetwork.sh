#!/bin/bash
set -e

CHANNEL_NAME="bansochannel"
CHAINCODE_NAME="bansocc"
CHAINCODE_VERSION="1.0"

ORDERER_CA=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/bansochain.gov.id/orderers/orderer.bansochain.gov.id/msp/tlscacerts/tlsca.bansochain.gov.id-cert.pem
PEER0_KEMENSOS_CA=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/kemensos.bansochain.gov.id/peers/peer0.kemensos.bansochain.gov.id/tls/ca.crt
PEER0_DINSOS_CA=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/dinsos.bansochain.gov.id/peers/peer0.dinsos.bansochain.gov.id/tls/ca.crt
PEER0_BANK_CA=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/bank.bansochain.gov.id/peers/peer0.bank.bansochain.gov.id/tls/ca.crt

# 1. Create Channel
echo "=== Creating Channel ==="
docker exec -e "CORE_PEER_LOCALMSPID=KemensosMSP" \
  -e "CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/kemensos.bansochain.gov.id/users/Admin@kemensos.bansochain.gov.id/msp" \
  -e "CORE_PEER_TLS_ROOTCERT_FILE=$PEER0_KEMENSOS_CA" \
  -e "CORE_PEER_ADDRESS=peer0.kemensos.bansochain.gov.id:7051" \
  peer0.kemensos.bansochain.gov.id peer channel create \
  -o orderer.bansochain.gov.id:7050 \
  -c $CHANNEL_NAME \
  -f /opt/gopath/src/github.com/hyperledger/fabric/peer/channel-artifacts/bansochannel.tx \
  --tls \
  --cafile $ORDERER_CA

# 2. Join Peers
echo "=== Join Kemensos Peer ==="
docker exec -e "CORE_PEER_LOCALMSPID=KemensosMSP" \
  -e "CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/kemensos.bansochain.gov.id/users/Admin@kemensos.bansochain.gov.id/msp" \
  -e "CORE_PEER_TLS_ROOTCERT_FILE=$PEER0_KEMENSOS_CA" \
  peer0.kemensos.bansochain.gov.id peer channel join -b ${CHANNEL_NAME}.block

echo "=== Join Dinsos Peer ==="
docker exec -e "CORE_PEER_LOCALMSPID=DinsosMSP" \
  -e "CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/dinsos.bansochain.gov.id/users/Admin@dinsos.bansochain.gov.id/msp" \
  -e "CORE_PEER_TLS_ROOTCERT_FILE=$PEER0_DINSOS_CA" \
  -e "CORE_PEER_ADDRESS=peer0.dinsos.bansochain.gov.id:8051" \
  peer0.dinsos.bansochain.gov.id peer channel fetch 0 ${CHANNEL_NAME}.block -c $CHANNEL_NAME -o orderer.bansochain.gov.id:7050 --tls --cafile $ORDERER_CA

docker exec -e "CORE_PEER_LOCALMSPID=DinsosMSP" \
  -e "CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/dinsos.bansochain.gov.id/users/Admin@dinsos.bansochain.gov.id/msp" \
  -e "CORE_PEER_TLS_ROOTCERT_FILE=$PEER0_DINSOS_CA" \
  -e "CORE_PEER_ADDRESS=peer0.dinsos.bansochain.gov.id:8051" \
  peer0.dinsos.bansochain.gov.id peer channel join -b ${CHANNEL_NAME}.block

echo "=== Join Bank Peer ==="
docker exec -e "CORE_PEER_LOCALMSPID=BankMSP" \
  -e "CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/bank.bansochain.gov.id/users/Admin@bank.bansochain.gov.id/msp" \
  -e "CORE_PEER_TLS_ROOTCERT_FILE=$PEER0_BANK_CA" \
  -e "CORE_PEER_ADDRESS=peer0.bank.bansochain.gov.id:9051" \
  peer0.bank.bansochain.gov.id peer channel fetch 0 ${CHANNEL_NAME}.block -c $CHANNEL_NAME -o orderer.bansochain.gov.id:7050 --tls --cafile $ORDERER_CA

docker exec -e "CORE_PEER_LOCALMSPID=BankMSP" \
  -e "CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/bank.bansochain.gov.id/users/Admin@bank.bansochain.gov.id/msp" \
  -e "CORE_PEER_TLS_ROOTCERT_FILE=$PEER0_BANK_CA" \
  -e "CORE_PEER_ADDRESS=peer0.bank.bansochain.gov.id:9051" \
  peer0.bank.bansochain.gov.id peer channel join -b ${CHANNEL_NAME}.block

# 3. Anchor Peers Setup
echo "=== Updating Anchor Peers ==="
docker exec -e "CORE_PEER_LOCALMSPID=KemensosMSP" \
  -e "CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/kemensos.bansochain.gov.id/users/Admin@kemensos.bansochain.gov.id/msp" \
  peer0.kemensos.bansochain.gov.id peer channel update -o orderer.bansochain.gov.id:7050 -c $CHANNEL_NAME -f /opt/gopath/src/github.com/hyperledger/fabric/peer/channel-artifacts/KemensosMSPanchors.tx --tls --cafile $ORDERER_CA

docker exec -e "CORE_PEER_LOCALMSPID=DinsosMSP" \
  -e "CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/dinsos.bansochain.gov.id/users/Admin@dinsos.bansochain.gov.id/msp" \
  peer0.dinsos.bansochain.gov.id peer channel update -o orderer.bansochain.gov.id:7050 -c $CHANNEL_NAME -f /opt/gopath/src/github.com/hyperledger/fabric/peer/channel-artifacts/DinsosMSPanchors.tx --tls --cafile $ORDERER_CA

docker exec -e "CORE_PEER_LOCALMSPID=BankMSP" \
  -e "CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/bank.bansochain.gov.id/users/Admin@bank.bansochain.gov.id/msp" \
  peer0.bank.bansochain.gov.id peer channel update -o orderer.bansochain.gov.id:7050 -c $CHANNEL_NAME -f /opt/gopath/src/github.com/hyperledger/fabric/peer/channel-artifacts/BankMSPanchors.tx --tls --cafile $ORDERER_CA

# 4. Packaging Chaincode
echo "=== Packaging Chaincode ==="
docker exec -e "CORE_PEER_LOCALMSPID=KemensosMSP" \
  -e "CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/kemensos.bansochain.gov.id/users/Admin@kemensos.bansochain.gov.id/msp" \
  peer0.kemensos.bansochain.gov.id peer lifecycle chaincode package /opt/gopath/src/github.com/chaincode/bansocc.tar.gz \
  --path /opt/gopath/src/github.com/chaincode/bansos \
  --lang node \
  --label bansocc_1.0

# 5. Installing Chaincode on Peers
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

# 6. Query Installed Chaincode to get Package ID
echo "=== Querying Installed Chaincode to get Package ID ==="
CC_OUTPUT=$(docker exec -e "CORE_PEER_LOCALMSPID=KemensosMSP" \
  -e "CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/kemensos.bansochain.gov.id/users/Admin@kemensos.bansochain.gov.id/msp" \
  peer0.kemensos.bansochain.gov.id peer lifecycle chaincode queryinstalled)
echo "$CC_OUTPUT"

PACKAGE_ID=$(echo "$CC_OUTPUT" | grep -oE 'bansocc_1.0:[^, ]+' | head -n 1 || true)
if [ -z "$PACKAGE_ID" ]; then
  PACKAGE_ID=$(echo "$CC_OUTPUT" | sed -n 's/.*Package ID: \([^,]*\),.*/\1/p' | head -n 1)
fi
echo "Package ID: $PACKAGE_ID"

# 7. Approving Chaincode Definition for all Orgs
echo "=== Approving Chaincode Definition for Kemensos Org ==="
docker exec -e "CORE_PEER_LOCALMSPID=KemensosMSP" \
  -e "CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/kemensos.bansochain.gov.id/users/Admin@kemensos.bansochain.gov.id/msp" \
  -e "CORE_PEER_TLS_ROOTCERT_FILE=$PEER0_KEMENSOS_CA" \
  peer0.kemensos.bansochain.gov.id peer lifecycle chaincode approveformyorg \
  -o orderer.bansochain.gov.id:7050 \
  --channelID $CHANNEL_NAME \
  --name $CHAINCODE_NAME \
  --version $CHAINCODE_VERSION \
  --package-id $PACKAGE_ID \
  --sequence 1 \
  --tls \
  --cafile $ORDERER_CA

echo "=== Approving Chaincode Definition for Dinsos Org ==="
docker exec -e "CORE_PEER_LOCALMSPID=DinsosMSP" \
  -e "CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/dinsos.bansochain.gov.id/users/Admin@dinsos.bansochain.gov.id/msp" \
  -e "CORE_PEER_TLS_ROOTCERT_FILE=$PEER0_DINSOS_CA" \
  -e "CORE_PEER_ADDRESS=peer0.dinsos.bansochain.gov.id:8051" \
  peer0.dinsos.bansochain.gov.id peer lifecycle chaincode approveformyorg \
  -o orderer.bansochain.gov.id:7050 \
  --channelID $CHANNEL_NAME \
  --name $CHAINCODE_NAME \
  --version $CHAINCODE_VERSION \
  --package-id $PACKAGE_ID \
  --sequence 1 \
  --tls \
  --cafile $ORDERER_CA

echo "=== Approving Chaincode Definition for Bank Org ==="
docker exec -e "CORE_PEER_LOCALMSPID=BankMSP" \
  -e "CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/bank.bansochain.gov.id/users/Admin@bank.bansochain.gov.id/msp" \
  -e "CORE_PEER_TLS_ROOTCERT_FILE=$PEER0_BANK_CA" \
  -e "CORE_PEER_ADDRESS=peer0.bank.bansochain.gov.id:9051" \
  peer0.bank.bansochain.gov.id peer lifecycle chaincode approveformyorg \
  -o orderer.bansochain.gov.id:7050 \
  --channelID $CHANNEL_NAME \
  --name $CHAINCODE_NAME \
  --version $CHAINCODE_VERSION \
  --package-id $PACKAGE_ID \
  --sequence 1 \
  --tls \
  --cafile $ORDERER_CA

# 8. Committing Chaincode Definition
echo "=== Committing Chaincode Definition ==="
docker exec -e "CORE_PEER_LOCALMSPID=KemensosMSP" \
  -e "CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/kemensos.bansochain.gov.id/users/Admin@kemensos.bansochain.gov.id/msp" \
  -e "CORE_PEER_TLS_ROOTCERT_FILE=$PEER0_KEMENSOS_CA" \
  peer0.kemensos.bansochain.gov.id peer lifecycle chaincode commit \
  -o orderer.bansochain.gov.id:7050 \
  --channelID $CHANNEL_NAME \
  --name $CHAINCODE_NAME \
  --version $CHAINCODE_VERSION \
  --sequence 1 \
  --tls \
  --cafile $ORDERER_CA \
  --peerAddresses peer0.kemensos.bansochain.gov.id:7051 \
  --tlsRootCertFiles $PEER0_KEMENSOS_CA \
  --peerAddresses peer0.dinsos.bansochain.gov.id:8051 \
  --tlsRootCertFiles $PEER0_DINSOS_CA \
  --peerAddresses peer0.bank.bansochain.gov.id:9051 \
  --tlsRootCertFiles $PEER0_BANK_CA

# 9. Invoking initLedger transaction
echo "=== Invoking initLedger transaction ==="
docker exec -e "CORE_PEER_LOCALMSPID=KemensosMSP" \
  -e "CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/kemensos.bansochain.gov.id/users/Admin@kemensos.bansochain.gov.id/msp" \
  -e "CORE_PEER_TLS_ROOTCERT_FILE=$PEER0_KEMENSOS_CA" \
  peer0.kemensos.bansochain.gov.id peer chaincode invoke \
  -o orderer.bansochain.gov.id:7050 \
  --tls \
  --cafile $ORDERER_CA \
  -C $CHANNEL_NAME \
  -n $CHAINCODE_NAME \
  -c '{"Args":["initLedger"]}' \
  --peerAddresses peer0.kemensos.bansochain.gov.id:7051 \
  --tlsRootCertFiles $PEER0_KEMENSOS_CA \
  --peerAddresses peer0.dinsos.bansochain.gov.id:8051 \
  --tlsRootCertFiles $PEER0_DINSOS_CA \
  --peerAddresses peer0.bank.bansochain.gov.id:9051 \
  --tlsRootCertFiles $PEER0_BANK_CA

echo "=== Fabric Network Ready! Channel '$CHANNEL_NAME' setup, active, and chaincode '$CHAINCODE_NAME' committed! ==="
