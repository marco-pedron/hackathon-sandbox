#!/usr/bin/env bash
# Wipe all regtest data (chain, indexes, RLN wallets) and start from a cold stack.
set -euo pipefail
source "$(dirname "$0")/lib.sh"
$COMPOSE down -v --remove-orphans
"$(dirname "$0")/up.sh"
