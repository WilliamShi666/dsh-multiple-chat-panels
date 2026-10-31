#!/bin/bash
# Build: compile src/ → lib/ with the package's own TypeScript, then bundle the
# client half into lib/client.js with tsdown.
#
# Requires `pnpm install` first (devDependencies pin the DSH client API this
# build targets; keep them in step with the Harness version in the README).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

TSC="node_modules/.bin/tsc"
TSDOWN="node_modules/.bin/tsdown"
if [ ! -x "$TSC" ] || [ ! -x "$TSDOWN" ]; then
  echo "build: dev dependencies missing — run 'pnpm install' first" >&2
  exit 1
fi

echo "=== Compiling src → lib (tsc) ==="
"$TSC" -p tsconfig.json

echo "=== Bundling client → lib/client.js (tsdown) ==="
"$TSDOWN"

echo "=== Build complete ==="
