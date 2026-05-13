#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

DOMAIN="${1:-${DOMAIN:-www.feizon.com}}"
APP_URL="${APP_URL:-https://$DOMAIN}"
PROXY_PORT="${PROXY_PORT:-7001}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@admin.com}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-}"
CERTBOT_EMAIL="${CERTBOT_EMAIL:-}"
EXTRA_DOMAINS="${EXTRA_DOMAINS:-}"
ORIGIN_SSL="${ORIGIN_SSL:-0}"
SELF_SIGNED_ORIGIN_HTTPS="${SELF_SIGNED_ORIGIN_HTTPS:-1}"
STOP_DOCKER_NGINX="${STOP_DOCKER_NGINX:-exchange-nginx-1}"
COMPOSE_BIN="${COMPOSE_BIN:-docker compose}"
COMPOSE_FILE="$ROOT_DIR/compose.yaml"

if [[ -z "$DOMAIN" ]]; then
  echo "Usage: DOMAIN=www.example.com $0" >&2
  echo "   or: $0 www.example.com" >&2
  exit 1
fi

if [[ "$DOMAIN" == http://* || "$DOMAIN" == https://* ]]; then
  echo "DOMAIN must be a hostname only, for example: www.feizon.com" >&2
  exit 1
fi

if [[ ! -f "$COMPOSE_FILE" ]]; then
  echo "Missing compose file: $COMPOSE_FILE" >&2
  exit 1
fi

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run this script as root so Docker, nginx, and certbot share the same deployment context." >&2
  echo "Example: sudo $0 $DOMAIN" >&2
  exit 1
fi

SUDO=()

COMPOSE=($COMPOSE_BIN -f "$COMPOSE_FILE" --project-directory "$ROOT_DIR")

set_env() {
  local key="$1"
  local value="$2"
  local tmp
  touch .env
  tmp="$(mktemp)"
  awk -v key="$key" -v value="$value" '
    BEGIN { updated = 0 }
    $0 ~ "^" key "=" { print key "=" value; updated = 1; next }
    { print }
    END { if (!updated) print key "=" value }
  ' .env > "$tmp"
  mv "$tmp" .env
}

install_packages() {
  if command -v apt-get >/dev/null 2>&1; then
    "${SUDO[@]}" apt-get update
    "${SUDO[@]}" apt-get install -y git curl nginx openssl
    if [[ "$ORIGIN_SSL" == "1" ]]; then
      "${SUDO[@]}" apt-get install -y certbot python3-certbot-nginx
    fi
  elif command -v dnf >/dev/null 2>&1; then
    "${SUDO[@]}" dnf install -y git curl nginx openssl || {
      "${SUDO[@]}" dnf install -y epel-release
      "${SUDO[@]}" dnf install -y git curl nginx openssl
    }
    if [[ "$ORIGIN_SSL" == "1" ]]; then
      "${SUDO[@]}" dnf install -y certbot python3-certbot-nginx
    fi
  elif command -v yum >/dev/null 2>&1; then
    "${SUDO[@]}" yum install -y git curl nginx openssl || {
      "${SUDO[@]}" yum install -y epel-release
      "${SUDO[@]}" yum install -y git curl nginx openssl
    }
    if [[ "$ORIGIN_SSL" == "1" ]]; then
      "${SUDO[@]}" yum install -y certbot python3-certbot-nginx
    fi
  else
    echo "No supported package manager found. Install nginx and certbot manually, then rerun this script." >&2
    exit 1
  fi
}

ensure_self_signed_origin_cert() {
  local ssl_dir="$1"
  local ssl_cert="$2"
  local ssl_key="$3"
  local san="DNS:$DOMAIN"
  local domain

  if [[ "$ORIGIN_SSL" == "1" ]] || [[ "$SELF_SIGNED_ORIGIN_HTTPS" != "1" ]]; then
    return
  fi

  for domain in $EXTRA_DOMAINS; do
    san="$san,DNS:$domain"
  done

  "${SUDO[@]}" mkdir -p "$ssl_dir"
  if [[ -f "$ssl_cert" && -f "$ssl_key" ]]; then
    return
  fi

  echo "==> Creating self-signed origin certificate for Cloudflare Full mode"
  "${SUDO[@]}" openssl req -x509 -nodes -newkey rsa:2048 -days 3650 \
    -keyout "$ssl_key" \
    -out "$ssl_cert" \
    -subj "/CN=$DOMAIN" \
    -addext "subjectAltName=$san" >/dev/null 2>&1
}

stop_conflicting_docker_nginx() {
  local container
  if [[ -z "$STOP_DOCKER_NGINX" ]] || ! command -v docker >/dev/null 2>&1; then
    return
  fi

  for container in $STOP_DOCKER_NGINX; do
    if docker ps --format '{{.Names}}' | grep -Fxq "$container"; then
      echo "==> Disabling and stopping Docker nginx container: $container"
      docker update --restart=no "$container" >/dev/null
      docker stop "$container" >/dev/null
    fi
  done
}

install_docker_if_missing() {
  if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
    return
  fi

  echo "==> Installing Docker"
  curl -fsSL https://get.docker.com | "${SUDO[@]}" sh
}

write_nginx_config() {
  local nginx_conf
  local nginx_test=(nginx -t)
  local ssl_dir
  local ssl_cert
  local ssl_key
  local server_names="$DOMAIN"
  if [[ -n "$EXTRA_DOMAINS" ]]; then
    server_names="$server_names $EXTRA_DOMAINS"
  fi

  if [[ -f /usr/local/nginx/conf/nginx.conf ]] && grep -q 'include vhost/\*.conf' /usr/local/nginx/conf/nginx.conf; then
    "${SUDO[@]}" mkdir -p /usr/local/nginx/conf/vhost
    nginx_conf="/usr/local/nginx/conf/vhost/$DOMAIN.conf"
    ssl_dir="/usr/local/nginx/conf/ssl"
    if [[ -x /usr/local/nginx/sbin/nginx ]]; then
      nginx_test=(/usr/local/nginx/sbin/nginx -t -c /usr/local/nginx/conf/nginx.conf)
    fi
  elif [[ -d /etc/nginx/conf.d && ! -d /etc/nginx/sites-enabled ]]; then
    nginx_conf="/etc/nginx/conf.d/$DOMAIN.conf"
    ssl_dir="/etc/nginx/ssl"
  else
    "${SUDO[@]}" mkdir -p /etc/nginx/sites-available /etc/nginx/sites-enabled
    nginx_conf="/etc/nginx/sites-available/$DOMAIN"
    ssl_dir="/etc/nginx/ssl"
  fi
  ssl_cert="$ssl_dir/$DOMAIN.crt"
  ssl_key="$ssl_dir/$DOMAIN.key"
  ensure_self_signed_origin_cert "$ssl_dir" "$ssl_cert" "$ssl_key"

  echo "==> Writing nginx reverse proxy: $nginx_conf"
  "${SUDO[@]}" tee "$nginx_conf" >/dev/null <<EOF
server {
    listen 80;
    server_name $server_names;

    location ^~ / {
        proxy_pass http://127.0.0.1:$PROXY_PORT;
        proxy_http_version 1.1;

        proxy_set_header Host \$http_host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;

        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection \$http_connection;

        proxy_read_timeout 60s;
        proxy_buffering off;
        proxy_cache off;
    }
}
EOF

  if [[ "$ORIGIN_SSL" != "1" ]] && [[ "$SELF_SIGNED_ORIGIN_HTTPS" == "1" ]]; then
    "${SUDO[@]}" tee -a "$nginx_conf" >/dev/null <<EOF

server {
    listen 443 ssl;
    server_name $server_names;

    ssl_certificate $ssl_cert;
    ssl_certificate_key $ssl_key;
    ssl_protocols TLSv1.2 TLSv1.3;

    location ^~ / {
        proxy_pass http://127.0.0.1:$PROXY_PORT;
        proxy_http_version 1.1;

        proxy_set_header Host \$http_host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;

        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection \$http_connection;

        proxy_read_timeout 60s;
        proxy_buffering off;
        proxy_cache off;
    }
}
EOF
  fi

  if [[ "$nginx_conf" == /etc/nginx/sites-available/* ]]; then
    "${SUDO[@]}" ln -sfn "$nginx_conf" "/etc/nginx/sites-enabled/$DOMAIN"
  fi
  "${SUDO[@]}" "${nginx_test[@]}"
  "${SUDO[@]}" systemctl enable nginx >/dev/null 2>&1 || true
  if ! "${SUDO[@]}" systemctl reload nginx; then
    "${SUDO[@]}" systemctl restart nginx
  fi
}

issue_certificate() {
  local cert_domains=(-d "$DOMAIN")
  local domain
  for domain in $EXTRA_DOMAINS; do
    cert_domains+=(-d "$domain")
  done

  echo "==> Requesting HTTPS certificate for: $DOMAIN ${EXTRA_DOMAINS:-}"
  if [[ -n "$CERTBOT_EMAIL" ]]; then
    "${SUDO[@]}" certbot --nginx --non-interactive --agree-tos --redirect \
      --email "$CERTBOT_EMAIL" "${cert_domains[@]}"
  else
    "${SUDO[@]}" certbot --nginx --non-interactive --agree-tos --redirect \
      --register-unsafely-without-email "${cert_domains[@]}"
  fi
}

deploy_xboard() {
  if ! command -v docker >/dev/null 2>&1; then
    install_docker_if_missing
  fi

  echo "==> Preparing Xboard runtime env"
  if [[ ! -f .env ]]; then
    cp .env.example .env
  fi
  set_env APP_URL "$APP_URL"
  set_env DB_CONNECTION mysql
  set_env DB_HOST mysql
  set_env DB_PORT 3306
  set_env DB_DATABASE xboard
  set_env DB_USERNAME root
  set_env DB_PASSWORD xboard123
  set_env CACHE_DRIVER redis
  set_env QUEUE_CONNECTION redis
  set_env REDIS_HOST redis
  set_env REDIS_PORT 6379
  set_env REDIS_PASSWORD null

  if grep -q '^INSTALLED=true' .env 2>/dev/null; then
    echo "==> Existing install detected; running production update"
    APP_URL="$APP_URL" scripts/prod-update.sh
  else
    echo "==> Fresh install detected; running initial deploy"
    APP_URL="$APP_URL" ADMIN_EMAIL="$ADMIN_EMAIL" ADMIN_PASSWORD="$ADMIN_PASSWORD" scripts/deploy.sh
  fi
}

configure_xboard_domain() {
  local tinker_code
  tinker_code='admin_setting(["app_url" => getenv("APP_URL"), "force_https" => 0, "frontend_theme" => "Northline"]); app(\App\Services\ThemeService::class)->switch("Northline"); echo "Configured app_url: " . admin_setting("app_url") . PHP_EOL;'

  echo "==> Applying Xboard domain settings"
  "${COMPOSE[@]}" exec -T \
    -e APP_URL="$APP_URL" \
    xboard php artisan tinker --execute="$tinker_code"

  "${COMPOSE[@]}" exec -T xboard php artisan optimize:clear >/dev/null || true
  "${COMPOSE[@]}" restart xboard >/dev/null
}

smoke_test() {
  local ready=0
  local attempt
  echo "==> Smoke testing"
  if command -v curl >/dev/null 2>&1; then
    for attempt in {1..30}; do
      if curl -fsS --max-time 5 "http://127.0.0.1:$PROXY_PORT" >/dev/null; then
        ready=1
        break
      fi
      sleep 2
    done
    if [[ "$ready" != "1" ]]; then
      echo "Local panel check failed: http://127.0.0.1:$PROXY_PORT" >&2
      return 1
    fi
    echo "Local panel OK: http://127.0.0.1:$PROXY_PORT"
    if curl -fsS --max-time 15 "$APP_URL" >/dev/null; then
      echo "Public URL OK: $APP_URL"
    else
      echo "Public URL check failed. If DNS was just changed, wait a few minutes and retry: $APP_URL"
    fi
  else
    echo "curl not found; skipping smoke test"
  fi
}

echo "==> Xboard domain setup"
echo "    domain:  $DOMAIN"
echo "    app url: $APP_URL"
echo "    root:    $ROOT_DIR"
echo "    origin ssl: $ORIGIN_SSL"
echo "    self-signed origin https: $SELF_SIGNED_ORIGIN_HTTPS"

install_packages
install_docker_if_missing
stop_conflicting_docker_nginx
deploy_xboard
write_nginx_config
if [[ "$ORIGIN_SSL" == "1" ]]; then
  issue_certificate
else
  echo "==> Skipping origin SSL; Cloudflare should proxy HTTPS and connect to origin over HTTP"
fi
configure_xboard_domain
smoke_test

echo
echo "Done."
echo "Open: $APP_URL"
echo "Admin email: $ADMIN_EMAIL"
if [[ -z "$ADMIN_PASSWORD" ]]; then
  echo "Admin password: generated during install; check deploy output or run scripts/init-admin.sh"
fi
