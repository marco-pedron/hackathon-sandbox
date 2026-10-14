#!/usr/bin/env bash
# Stop the stack, keep data volumes. Use reset.sh to wipe.
set -euo pipefail
source "$(dirname "$0")/lib.sh"
$COMPOSE down
