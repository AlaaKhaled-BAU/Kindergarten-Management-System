#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

bash scripts/cf-build.sh

# Direct path deploy — OPEN_NEXT_DEPLOY=true tells wrangler 4.x to skip its
# auto-delegation to `opennextjs-cloudflare deploy` (which re-bundles, broke
# the worker twice, and fails Miniflare validation on the unsubstituted
# ${HYPERDRIVE_LOCAL_CONNECTION_STRING}). cf-build.sh also removes
# open-next.config.ts, which disables the delegation outright.
OPEN_NEXT_DEPLOY=true npx wrangler deploy .open-next/worker.js
