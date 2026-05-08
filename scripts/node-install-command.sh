#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

COMPOSE_BIN="${COMPOSE_BIN:-docker compose}"
COMPOSE_FILE="$ROOT_DIR/compose.yaml"
if [[ ! -f "$COMPOSE_FILE" ]]; then
  echo "Missing $COMPOSE_FILE. Pull the dev branch before generating node install commands." >&2
  exit 1
fi
COMPOSE=($COMPOSE_BIN -f "$COMPOSE_FILE" --project-directory "$ROOT_DIR")
MACHINE_NAME="${MACHINE_NAME:-node-$(date +%Y%m%d-%H%M%S)}"
MACHINE_ID="${MACHINE_ID:-}"
PANEL_URL="${PANEL_URL:-}"
RESET_TOKEN="${RESET_TOKEN:-0}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --name)
      MACHINE_NAME="$2"
      shift 2
      ;;
    --id)
      MACHINE_ID="$2"
      shift 2
      ;;
    --panel)
      PANEL_URL="$2"
      shift 2
      ;;
    --reset-token)
      RESET_TOKEN=1
      shift
      ;;
    -h|--help)
      cat <<'USAGE'
Usage:
  scripts/node-install-command.sh --panel https://panel.example.com --name tokyo-1
  scripts/node-install-command.sh --id 1 --panel https://panel.example.com
  scripts/node-install-command.sh --id 1 --reset-token

Environment:
  MACHINE_NAME, MACHINE_ID, PANEL_URL, RESET_TOKEN, COMPOSE_BIN
USAGE
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

TINKER_CODE='use App\Models\ServerMachine; $machineId=getenv("MACHINE_ID"); $name=getenv("MACHINE_NAME") ?: ("node-" . date("Ymd-His")); $panel=rtrim(getenv("PANEL_URL") ?: (admin_setting("app_url") ?: config("app.url")), "/"); if (!$panel || str_contains($panel, "localhost")) { fwrite(STDERR, "Warning: PANEL_URL is empty or localhost. Pass --panel https://your-domain.com for remote nodes.\n"); } if ($machineId) { $machine=ServerMachine::findOrFail((int)$machineId); } else { $machine=ServerMachine::where("name", $name)->first(); if (!$machine) { $machine=ServerMachine::create(["name"=>$name, "notes"=>"created by scripts/node-install-command.sh", "is_active"=>true, "token"=>ServerMachine::generateToken()]); } } if ((int)getenv("RESET_TOKEN") === 1) { $machine->token=ServerMachine::generateToken(); $machine->save(); } $installer="https://raw.githubusercontent.com/cedar2025/xboard-node/dev/install.sh"; fwrite(STDERR, "Machine ID: {$machine->id}\nMachine name: {$machine->name}\n"); echo sprintf("curl -fsSL %s | sudo bash -s -- --mode machine --panel %s --token %s --machine-id %d\n", $installer, escapeshellarg($panel), escapeshellarg($machine->token), $machine->id);'

"${COMPOSE[@]}" exec -T \
  -e MACHINE_NAME="$MACHINE_NAME" \
  -e MACHINE_ID="$MACHINE_ID" \
  -e PANEL_URL="$PANEL_URL" \
  -e RESET_TOKEN="$RESET_TOKEN" \
  xboard php artisan tinker --execute="$TINKER_CODE"
