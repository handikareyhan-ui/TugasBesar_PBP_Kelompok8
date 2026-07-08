#!/bin/bash
# resetNetwork.sh - devops recovery script to reset network state and restart fresh

# Exit immediately if a command exits with a non-zero status
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "=== Devops Recovery: Resetting Network State ==="

# Execute stopping sequence
if [ -f "$DIR/stopNetwork.sh" ]; then
    chmod +x "$DIR/stopNetwork.sh"
    "$DIR/stopNetwork.sh"
else
    echo "Warning: stopNetwork.sh not found."
fi

echo "=== Network Stopped. Rebooting Fresh Network ==="

# Execute starting sequence
if [ -f "$DIR/startNetwork.sh" ]; then
    chmod +x "$DIR/startNetwork.sh"
    "$DIR/startNetwork.sh"
else
    echo "Error: startNetwork.sh not found!"
    exit 1
fi

echo "=== Devops Recovery Complete. Network is clean and active! ==="
