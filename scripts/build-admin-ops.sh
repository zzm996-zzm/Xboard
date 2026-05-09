#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR/apps/admin-ops"

npm install
npm run build

echo "Admin ops assets built into $ROOT_DIR/public/assets/admin-ops"
