#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

bash scripts/cf-build.sh

# Direct path deploy — bypasses the OpenNext deploy hook (which re-bundles
# and broke the worker twice: 1101 exceptions and shell-only streamed pages).
npx wrangler deploy .open-next/worker.js
