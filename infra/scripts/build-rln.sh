#!/usr/bin/env bash
# Build the rgb-lightning-node Docker image from a pinned upstream commit.
# Usage: ./infra/scripts/build-rln.sh   (env: CARGO_BUILD_JOBS, default 2)
set -euo pipefail

RLN_REPO=https://github.com/RGB-Tools/rgb-lightning-node.git
RLN_COMMIT=d4762ac3d1b3ca83f2f7b4f894e8569109dc572a
IMAGE=settleup/rln:${RLN_COMMIT:0:7}

INFRA_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$INFRA_DIR/vendor/rgb-lightning-node"

if [ ! -d "$SRC/.git" ]; then
    mkdir -p "$INFRA_DIR/vendor"
    git init -q "$SRC"
    git -C "$SRC" remote add origin "$RLN_REPO"
fi
if [ "$(git -C "$SRC" rev-parse HEAD 2>/dev/null)" != "$RLN_COMMIT" ]; then
    git -C "$SRC" fetch -q --depth 1 origin "$RLN_COMMIT"
    git -C "$SRC" checkout -q --detach "$RLN_COMMIT"
fi
git -C "$SRC" submodule update -q --init --recursive --depth 1

echo "building $IMAGE (CARGO_BUILD_JOBS=${CARGO_BUILD_JOBS:-2}); a cold build takes 15-40 min"
docker build \
    --build-arg CARGO_BUILD_JOBS="${CARGO_BUILD_JOBS:-2}" \
    -f "$INFRA_DIR/rln.Dockerfile" \
    -t "$IMAGE" \
    "$SRC"
echo "built $IMAGE"
