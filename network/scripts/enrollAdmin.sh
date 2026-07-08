#!/bin/bash
# enrollAdmin.sh - Helper script to run Node.js admin enrollment

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
node "$DIR/enrollAdmin.js"
