#!/usr/bin/env bash
# Send regtest BTC from the miner wallet. Usage: ./infra/scripts/fund.sh <address> <btc>
# Prints the txid. Does not mine: call mine.sh afterwards.
set -euo pipefail
source "$(dirname "$0")/lib.sh"
[ -n "${1:-}" ] && [ -n "${2:-}" ] || _die "usage: $0 <address> <btc>"
$BITCOIN_CLI -rpcwallet=miner sendtoaddress "$1" "$2"
