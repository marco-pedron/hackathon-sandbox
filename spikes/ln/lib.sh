# Spike helpers. Source it. Every call is appended to calls.log (request + response).
LOG="$(dirname "${BASH_SOURCE[0]}")/calls.log"
port() { case $1 in alice) echo 3001;; bob) echo 3002;; charlie) echo 3003;; dave) echo 3004;; esac; }
# rln <node> <path> [json]
rln() {
  local n=$1 p=$2 body=${3:-} out
  if [ -n "$body" ]; then
    out=$(curl -s -m 120 -X POST -H 'Content-Type: application/json' -d "$body" "localhost:$(port $n)$p")
  else
    out=$(curl -s -m 120 "localhost:$(port $n)$p")
  fi
  printf '### %s %s %s\nREQ %s\nRES %s\n\n' "$(date +%T)" "$n" "$p" "$body" "$out" \
    | sed -E 's/"(password|mnemonic)":"[^"]*"/"\1":"<redacted>"/g' >> "$LOG"
  echo "$out"
}
mine() { docker compose -f "$(dirname "${BASH_SOURCE[0]}")/../../infra/docker-compose.yml" exec -T -u blits bitcoind bitcoin-cli -regtest -rpcwallet=miner -generate "$1" >/dev/null; }
# chstate <node>: one line per channel
chstate() { rln $1 /listchannels | python3 -c '
import json,sys
for c in json.load(sys.stdin)["channels"]:
  print(c["channel_id"][:8], c["peer_pubkey"][:8], c["status"], "ready=%s usable=%s pub=%s"%(c["ready"],c["is_usable"],c["public"]), "sat=%s/%s"%(c["local_balance_sat"],c["capacity_sat"]), "out_msat=%s in_msat=%s"%(c["outbound_balance_msat"],c["inbound_balance_msat"]), "asset=%s/%s"%(c.get("asset_local_amount"),c.get("asset_remote_amount")), "scid=%s"%c["short_channel_id"])'; }
height() { curl -s localhost:3010/blocks/tip/height; }
