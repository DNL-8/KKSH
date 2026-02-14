#!/usr/bin/env bash
set -euo pipefail

pnpm build
docker build -f Dockerfile .