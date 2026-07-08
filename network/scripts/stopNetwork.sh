#!/bin/bash
# stopNetwork.sh - Script to stop Fabric network containers and remove generated crypto/channel data

# Resolve absolute path of scripts directory
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "=== Stopping Docker Containers ==="
docker-compose -f "${DIR}/../docker-compose.yaml" down -v

echo "=== Cleaning local files ==="
rm -rf "${DIR}/../crypto-config"
rm -rf "${DIR}/../channel-artifacts"
rm -rf "${DIR}/../../backend/wallet"/* 2>/dev/null || true

echo "=== Devops: Removing stray chaincode docker images ==="
docker rmi $(docker images | grep "bansocc" | awk '{print $3}') 2>/dev/null || true

echo "=== BansosChain network successfully stopped and cleaned. ==="
