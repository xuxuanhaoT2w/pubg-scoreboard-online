#!/bin/bash
set -Eeuo pipefail

COZE_WORKSPACE_PATH="${COZE_WORKSPACE_PATH:-$(pwd)}"

cd "${COZE_WORKSPACE_PATH}"

# EdgeOne's Linux builder can start with a low file-descriptor limit. Vite's
# module graph (notably lucide-react) may otherwise fail with EMFILE even when
# the source and dependencies are valid. Raise the soft limit when permitted;
# environments that do not allow it can continue with their existing limit.
ulimit -n 65536 2>/dev/null || true

echo "Building frontend with Vite..."
npx --no-install vite build

echo "Bundling Cloudflare Worker..."
mkdir -p dist/server
npx --no-install tsup server/index.ts --format esm --platform neutral --target es2022 --outDir dist/server --no-splitting --no-minify --out-extension .js=.js
cp dist/server/index.mjs dist/server/index.js
mkdir -p dist/client
cp -R dist/assets dist/client/
cp dist/index.html dist/client/index.html
cp -R public/. dist/client/ 2>/dev/null || true

echo "Build completed successfully!"
