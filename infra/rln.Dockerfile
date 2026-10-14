# Same as RGB-Tools/rgb-lightning-node's Dockerfile at the pinned commit, plus a
# CARGO_BUILD_JOBS arg to cap parallelism (and memory) on Docker Desktop.
FROM rust:1.95-slim-trixie AS builder

ARG CARGO_BUILD_JOBS=2
ENV CARGO_BUILD_JOBS=${CARGO_BUILD_JOBS}

COPY . .

RUN cargo build --release


FROM debian:trixie-slim

COPY --from=builder ./target/release/rgb-lightning-node /usr/bin/rgb-lightning-node

RUN apt-get update && apt install -y --no-install-recommends \
    ca-certificates openssl \
    && apt-get clean && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

RUN groupadd -g 1000 user \
    && useradd -u 1000 -g user -M -s /usr/sbin/nologin user \
    && mkdir -p /RLNdata && chown user:user /RLNdata

USER user

ENTRYPOINT ["/usr/bin/rgb-lightning-node"]
