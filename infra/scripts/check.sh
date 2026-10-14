#!/usr/bin/env bash
# Phase 0 acceptance probe. Exits non-zero on the first failing check.
set -euo pipefail
source "$(dirname "$0")/lib.sh"

ok() { echo "  OK   $*"; }
fail() { echo "  FAIL $*"; exit 1; }

echo "[1] containers running"
expected=(bitcoind electrs esplora proxy rln-alice rln-bob rln-charlie)
running=$($COMPOSE ps --status running --services)
for s in "${expected[@]}"; do
    grep -qx "$s" <<<"$running" && ok "$s" || fail "$s not running"
done

echo "[2] bitcoind height >= 103"
height=$($BITCOIN_CLI getblockcount)
[ "$height" -ge 103 ] && ok "height $height" || fail "height $height"

echo "[3] esplora REST tip matches bitcoind"
_wait_until "esplora tip $height" sh -c "[ \"\$(curl -sf $ESPLORA_URL/blocks/tip/height)\" = $height ]" \
    && ok "esplora tip $height" || fail "esplora tip $(curl -s "$ESPLORA_URL/blocks/tip/height")"

echo "[4] RLN /nodeinfo answers on ${RLN_PORTS[*]}"
for port in "${RLN_PORTS[@]}"; do
    body=$(curl -s -w '\n%{http_code}' "http://localhost:$port/nodeinfo") || fail "RLN $port unreachable"
    code=$(tail -1 <<<"$body")
    json=$(sed '$d' <<<"$body")
    node -e 'JSON.parse(process.argv[1])' "$json" 2>/dev/null \
        && ok "RLN $port HTTP $code $json" || fail "RLN $port HTTP $code non-JSON body: $json"
done

echo "[5] rgb-proxy-server answers server.info"
info=$(curl -sf -X POST -H 'Content-Type: application/json' \
    -d '{"jsonrpc":"2.0","id":"0","method":"server.info"}' http://localhost:3000/json-rpc) \
    && ok "proxy $info" || fail "proxy unreachable"

echo "[6] mining 1 block reaches bitcoind and esplora"
"$(dirname "$0")/mine.sh" 1 >/dev/null
new=$((height + 1))
[ "$($BITCOIN_CLI getblockcount)" -eq "$new" ] && ok "bitcoind $new" || fail "bitcoind did not advance"
_wait_until "esplora tip $new" sh -c "[ \"\$(curl -sf $ESPLORA_URL/blocks/tip/height)\" = $new ]" \
    && ok "esplora $new" || fail "esplora did not reach $new"

echo "all checks passed"
