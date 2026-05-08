#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

COMPOSE_BIN="${COMPOSE_BIN:-docker compose}"
COMPOSE_FILE="$ROOT_DIR/compose.yaml"
if [[ ! -f "$COMPOSE_FILE" ]]; then
  echo "Missing $COMPOSE_FILE. Pull the dev branch before managing admin." >&2
  exit 1
fi
COMPOSE=($COMPOSE_BIN -f "$COMPOSE_FILE" --project-directory "$ROOT_DIR")
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@admin.com}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-}"

if [[ -z "$ADMIN_PASSWORD" ]]; then
  if command -v openssl >/dev/null 2>&1; then
    ADMIN_PASSWORD="$(openssl rand -base64 18 | tr -d '\n')"
  else
    ADMIN_PASSWORD="ChangeMe$(date +%s)"
  fi
fi

if [[ "${#ADMIN_PASSWORD}" -lt 8 ]]; then
  echo "ADMIN_PASSWORD must be at least 8 characters." >&2
  exit 1
fi

TINKER_CODE='use App\Models\User; use App\Utils\Helper; $email=getenv("ADMIN_EMAIL"); $password=getenv("ADMIN_PASSWORD"); $user=User::byEmail($email)->first(); if (!$user) { $user=new User(); $user->email=$email; $user->uuid=Helper::guid(true); $user->token=Helper::guid(); } if (!$user->uuid) { $user->uuid=Helper::guid(true); } if (!$user->token) { $user->token=Helper::guid(); } $user->password=password_hash($password, PASSWORD_DEFAULT); $user->password_algo=null; $user->password_salt=null; $user->is_admin=1; $user->banned=0; $user->save(); $securePath=admin_setting("secure_path", admin_setting("frontend_admin_path", hash("crc32b", config("app.key")))); $appUrl=rtrim(admin_setting("app_url") ?: config("app.url"), "/"); echo "Admin ready\nEmail: {$email}\nPassword: {$password}\nAdmin URL: {$appUrl}/{$securePath}\n";'

"${COMPOSE[@]}" exec -T \
  -e ADMIN_EMAIL="$ADMIN_EMAIL" \
  -e ADMIN_PASSWORD="$ADMIN_PASSWORD" \
  xboard php artisan tinker --execute="$TINKER_CODE"
