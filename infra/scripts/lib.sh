# Shared helpers for infra scripts. Source it, don't run it.
INFRA_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE="docker compose -f $INFRA_DIR/docker-compose.yml"
BITCOIN_CLI="$COMPOSE exec -T -u blits bitcoind bitcoin-cli -regtest"
ESPLORA_URL="${ESPLORA_URL:-http://localhost:3010}"
RLN_PORTS=(3001 3002 3003)
TIMEOUT="${TIMEOUT:-120}"

_die() {
    echo "ERR: $*" >&2
    exit 1
}

# _wait_until <description> <command...>: retry once a second until TIMEOUT
_wait_until() {
    local what="$1"
    shift
    local start
    start=$(date +%s)
    until "$@" >/dev/null 2>&1; do
        if [ $(($(date +%s) - start)) -gt "$TIMEOUT" ]; then
            echo "timeout waiting for $what" >&2
            return 1
        fi
        sleep 1
    done
}
