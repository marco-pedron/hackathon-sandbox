#!/usr/bin/env bash
# Mine <n> regtest blocks to the miner wallet. Usage: ./infra/scripts/mine.sh <n>
set -euo pipefail
source "$(dirname "$0")/lib.sh"
[ -n "${1:-}" ] || _die "usage: $0 <blocks>"
$BITCOIN_CLI -rpcwallet=miner -generate "$1" >/dev/null
echo "height $($BITCOIN_CLI getblockcount)"
