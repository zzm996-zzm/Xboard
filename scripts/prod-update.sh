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
