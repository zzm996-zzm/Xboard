#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

REMOTE="${REMOTE:-origin}"
BRANCH="${BRANCH:-dev}"
COMPOSE_BIN="${COMPOSE_BIN:-docker compose}"
COMPOSE_FILE="${COMPOSE_FILE:-$ROOT_DIR/compose.yaml}"
BUILD_REPO_URL="${BUILD_REPO_URL:-https://github.com/zzm996-zzm/Xboard.git}"
SKIP_PULL="${SKIP_PULL:-0}"
SKIP_BUILD="${SKIP_BUILD:-0}"
SYNC_EXISTING_CORE_PLUGIN_OVERRIDES="${SYNC_EXISTING_CORE_PLUGIN_OVERRIDES:-1}"

if [[ ! -f "$COMPOSE_FILE" ]]; then
  echo "Missing compose file: $COMPOSE_FILE" >&2
  exit 1
fi

COMPOSE=($COMPOSE_BIN -f "$COMPOSE_FILE" --project-directory "$ROOT_DIR")

echo "==> Production update"
echo "    root:   $ROOT_DIR"
echo "    branch: $REMOTE/$BRANCH"

if [[ "$SKIP_PULL" != "1" ]]; then
  echo "==> Pulling latest code"
  git fetch "$REMOTE" "$BRANCH"
  git pull --ff-only "$REMOTE" "$BRANCH"
fi

if [[ "$SYNC_EXISTING_CORE_PLUGIN_OVERRIDES" == "1" ]] && [[ -d plugins-core ]] && [[ -d plugins ]]; then
  echo "==> Syncing existing mounted core plugin overrides"
  while IFS= read -r -d '' core_plugin_dir; do
    plugin_name="$(basename "$core_plugin_dir")"
    mounted_plugin_dir="plugins/$plugin_name"
    if [[ -d "$mounted_plugin_dir" ]]; then
      echo "    syncing $plugin_name"
      cp -a "$core_plugin_dir/." "$mounted_plugin_dir/"
    fi
  done < <(find plugins-core -mindepth 1 -maxdepth 1 -type d -print0)
fi

if [[ -x scripts/build-user-portal-theme.sh ]]; then
  if command -v npm >/dev/null 2>&1; then
    echo "==> Building Northline user portal theme assets"
    scripts/build-user-portal-theme.sh
  else
    echo "==> Skipping Northline theme asset build; npm is not installed on this host"
    echo "    Using tracked storage/theme/Northline assets from git"
  fi
fi

COMMIT="$(git rev-parse --short=12 HEAD)"
export XBOARD_IMAGE="${XBOARD_IMAGE:-xboard-custom:${BRANCH}-${COMMIT}}"

if [[ "$SKIP_BUILD" != "1" ]]; then
  echo "==> Building custom Xboard image: $XBOARD_IMAGE"
  docker build \
    --pull \
    --build-arg CACHEBUST="$COMMIT" \
    --build-arg REPO_URL="$BUILD_REPO_URL" \
    --build-arg BRANCH_NAME="$BRANCH" \
    -t "$XBOARD_IMAGE" \
    "$ROOT_DIR"
else
  echo "==> Skipping image build; using image: $XBOARD_IMAGE"
fi

echo "==> Starting services with custom image"
"${COMPOSE[@]}" up -d

echo "==> Clearing caches"
"${COMPOSE[@]}" exec -T xboard php artisan optimize:clear >/dev/null || true

echo "==> Applying database migrations, plugin updates, and theme refresh"
"${COMPOSE[@]}" exec -T xboard php artisan xboard:update

echo "==> Clearing caches again"
"${COMPOSE[@]}" exec -T xboard php artisan optimize:clear >/dev/null || true

echo "==> Restarting Xboard"
"${COMPOSE[@]}" restart xboard >/dev/null

echo
echo "Done. Running image: $XBOARD_IMAGE"
