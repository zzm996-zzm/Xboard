#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_DIR="$ROOT_DIR/apps/user-portal"
THEME_DIR="$ROOT_DIR/storage/theme/Northline"

if [[ ! -d "$APP_DIR/node_modules" ]]; then
  npm --prefix "$APP_DIR" ci
fi

npm --prefix "$APP_DIR" run build

mkdir -p "$THEME_DIR/assets"
cp "$APP_DIR/dist/assets/index.js" "$THEME_DIR/assets/index.js"
cp "$APP_DIR/dist/assets/index.css" "$THEME_DIR/assets/index.css"

echo "Northline theme assets updated: $THEME_DIR"
