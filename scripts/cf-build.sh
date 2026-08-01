#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

MIN_WASM="$(pwd)/scripts/min.wasm"

# instrumentation.ts breaks OpenNext's copyTracedFiles (Next 16 bug)
if [ -f instrumentation.ts ]; then
  mv instrumentation.ts /tmp/instrumentation.ts.cf
  echo "instrumentation.ts moved aside for Cloudflare build"
fi

trap 'if [ -f /tmp/instrumentation.ts.cf ]; then mv /tmp/instrumentation.ts.cf instrumentation.ts; fi' EXIT

npx opennextjs-cloudflare build

# Wrangler 4.x auto-delegates `wrangler deploy` to `opennextjs-cloudflare
# deploy` whenever open-next.config.ts is present, and that delegation runs
# Miniflare validation that chokes on the unsubstituted
# ${HYPERDRIVE_LOCAL_CONNECTION_STRING} (CI has no env) and previously broke
# the worker twice. The built worker is self-contained, so drop the config to
# force plain `wrangler deploy` uploads.
rm -f open-next.config.ts

SF=".open-next/server-functions/default"
NODE_MODS="$SF/node_modules"

# Junk that got traced in from the working directory
rm -rf "$SF/Backups" "$SF/kindergarten.db" "$SF/Logs"

# Cloudflare compiles every bundled .wasm module. The runtime only loads
# .prisma/client/query_engine_bg.wasm (workerd loader). The other 13 wasm
# files (prisma CLI engines + node-only fast compiler) are never loaded on
# Workers -- stub them with a minimal valid wasm (magic + version) so the
# bundle stays under the 3 MiB free-plan limit.
cp "$MIN_WASM" "$NODE_MODS/.prisma/client/query_compiler_fast_bg.wasm"
for f in "$NODE_MODS"/prisma/build/*.wasm; do cp "$MIN_WASM" "$f"; done
