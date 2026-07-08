#!/bin/bash
# startNetwork.sh - Script to generate network artifacts and start Hyperledger Fabric network

# Exit immediately if a command exits with a non-zero status
set -e

# Resolve absolute path of scripts directory
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export FABRIC_CFG_PATH="${DIR}/.."

CHANNEL_NAME="bansochannel"
CHAINCODE_NAME="bansocc"
CHAINCODE_VERSION="1.0"
CHAINCODE_LANG="node"
CHAINCODE_PATH="../../chaincode/bansos"

echo "=== Clean up existing container files and logs ==="
docker-compose -f "${DIR}/../docker-compose.yaml" down -v || true
rm -rf "${DIR}/../crypto-config/" "${DIR}/../channel-artifacts/" || true

echo "=== Generating Crypto Materials using cryptogen ==="
docker run --rm -v "${DIR}/..:/workspace" -w /workspace hyperledger/fabric-tools:2.5.4 cryptogen generate --config=/workspace/crypto-config.yaml --output="/workspace/crypto-config"

echo "=== Copying CA private keys to stable name 'priv_sk' ==="
for org in kemensos.bansochain.gov.id dinsos.bansochain.gov.id bank.bansochain.gov.id; do
  CA_DIR="${DIR}/../crypto-config/peerOrganizations/${org}/ca"
  if [ -d "${CA_DIR}" ]; then
    cp ${CA_DIR}/*_sk ${CA_DIR}/priv_sk 2>/dev/null || true
    echo "Prepared CA private key for ${org} as priv_sk"
  fi
done

mkdir -p "${DIR}/../channel-artifacts"

echo "=== Generating Genesis Block ==="
docker run --rm -v "${DIR}/..:/workspace" -w /workspace hyperledger/fabric-tools:2.5.4 configtxgen -profile ThreeOrgsChannelGenesis -configPath /workspace -channelID system-channel -outputBlock /workspace/channel-artifacts/genesis.block

echo "=== Generating Channel Creation Tx ==="
docker run --rm -v "${DIR}/..:/workspace" -w /workspace hyperledger/fabric-tools:2.5.4 configtxgen -profile BansosChannel -configPath /workspace -channelID $CHANNEL_NAME -outputCreateChannelTx /workspace/channel-artifacts/${CHANNEL_NAME}.tx

echo "=== Generating Anchor Peer Updates ==="
docker run --rm -v "${DIR}/..:/workspace" -w /workspace hyperledger/fabric-tools:2.5.4 configtxgen -profile BansosChannel -configPath /workspace -channelID $CHANNEL_NAME -outputAnchorPeersUpdate /workspace/channel-artifacts/KemensosMSPanchors.tx -asOrg KemensosOrg

docker run --rm -v "${DIR}/..:/workspace" -w /workspace hyperledger/fabric-tools:2.5.4 configtxgen -profile BansosChannel -configPath /workspace -channelID $CHANNEL_NAME -outputAnchorPeersUpdate /workspace/channel-artifacts/DinsosMSPanchors.tx -asOrg DinsosOrg

docker run --rm -v "${DIR}/..:/workspace" -w /workspace hyperledger/fabric-tools:2.5.4 configtxgen -profile BansosChannel -configPath /workspace -channelID $CHANNEL_NAME -outputAnchorPeersUpdate /workspace/channel-artifacts/BankMSPanchors.tx -asOrg BankOrg

echo "=== Starting Containers ==="
docker-compose -f "${DIR}/../docker-compose.yaml" up -d

echo "Waiting for containers to boot..."
sleep 10

# Helper command variables
ORDERER_CA=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/bansochain.gov.id/orderers/orderer.bansochain.gov.id/msp/tlscacerts/tlsca.bansochain.gov.id-cert.pem
PEER0_KEMENSOS_CA=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/kemensos.bansochain.gov.id/peers/peer0.kemensos.bansochain.gov.id/tls/ca.crt
PEER0_DINSOS_CA=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/dinsos.bansochain.gov.id/peers/peer0.dinsos.bansochain.gov.id/tls/ca.crt
PEER0_BANK_CA=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/bank.bansochain.gov.id/peers/peer0.bank.bansochain.gov.id/tls/ca.crt

# Create channel
echo "=== Creating Channel ==="
docker exec -e "CORE_PEER_LOCALMSPID=KemensosMSP" \
  -e "CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/kemensos.bansochain.gov.id/users/Admin@kemensos.bansochain.gov.id/msp" \
  -e "CORE_PEER_TLS_ROOTCERT_FILE=$PEER0_KEMENSOS_CA" \
  -e "CORE_PEER_ADDRESS=peer0.kemensos.bansochain.gov.id:7051" \
  peer0.kemensos.bansochain.gov.id peer channel create \
  -o orderer.bansochain.gov.id:7050 \
  -c $CHANNEL_NAME \
  -f /opt/gopath/src/github.com/hyperledger/fabric/peer/channel-artifacts/${CHANNEL_NAME}.tx \
  --tls \
  --cafile $ORDERER_CA

# Join Peers
echo "=== Join Kemensos Peer ==="
docker exec -e "CORE_PEER_LOCALMSPID=KemensosMSP" \
  -e "CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/kemensos.bansochain.gov.id/users/Admin@kemensos.bansochain.gov.id/msp" \
  -e "CORE_PEER_TLS_ROOTCERT_FILE=$PEER0_KEMENSOS_CA" \
  peer0.kemensos.bansochain.gov.id peer channel join -b ${CHANNEL_NAME}.block

echo "=== Join Dinsos Peer ==="
# Fetch block
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

# Anchor Peer Setup
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

echo "=== Packaging Chaincode ==="
docker exec -e "CORE_PEER_LOCALMSPID=KemensosMSP" \
  -e "CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/kemensos.bansochain.gov.id/users/Admin@kemensos.bansochain.gov.id/msp" \
  peer0.kemensos.bansochain.gov.id peer lifecycle chaincode package /opt/gopath/src/github.com/chaincode/bansocc.tar.gz \
  --path /opt/gopath/src/github.com/chaincode/bansos \
  --lang node \
  --label bansocc_1.0

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
