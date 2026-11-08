#!/usr/bin/env bash
# Publish Canary Cage to the Vultr VM:  SERVER=root@<ip> bash deploy/publish.sh
# rsync the tree, npm ci, build images, (re)start the unit, health check. Needs ./.env with VULTR_INFERENCE_KEY and OPERATOR_TOKEN.
set -euo pipefail
HOST=${SERVER:?set SERVER=user@host}
APP_DIR=/opt/canary-cage
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
[ -f "$ROOT/.env" ] || { echo "missing $ROOT/.env (copy .env.example)"; exit 1; }
grep -q '^OPERATOR_TOKEN=.\+' "$ROOT/.env" || { echo "OPERATOR_TOKEN must be set in .env"; exit 1; }

echo "==> rsync to $HOST:$APP_DIR"
ssh "$HOST" "mkdir -p $APP_DIR"
rsync -az --delete --exclude node_modules --exclude data --exclude .local --exclude .git --exclude '.env' "$ROOT/" "$HOST:$APP_DIR/"
rsync -az "$ROOT/.env" "$HOST:$APP_DIR/.env"

echo "==> install, images"
ssh "$HOST" "cd $APP_DIR && npm install --omit=dev --no-audit --no-fund >/dev/null && node host/src/cli.ts build-images >/dev/null && echo images built"

if [ -n "${CADDY_DOMAIN:-}" ]; then
  echo "==> caddy for $CADDY_DOMAIN"
  sed "s/__DOMAIN__/$CADDY_DOMAIN/" "$ROOT/deploy/Caddyfile" | ssh "$HOST" "cat > /etc/caddy/Caddyfile && systemctl reload caddy || systemctl restart caddy"
fi

echo "==> restart"
ssh "$HOST" "systemctl enable canary-cage >/dev/null 2>&1; systemctl restart canary-cage; sleep 3; systemctl is-active canary-cage"

echo "==> health"
ssh "$HOST" "curl -fsS http://127.0.0.1:8080/healthz"
echo
IP=$(ssh "$HOST" "curl -fsS --max-time 3 http://169.254.169.254/v1/interfaces/0/ipv4/address 2>/dev/null || hostname -I | awk '{print \$1}'")
echo "public URL: http://$IP/  (or https://${CADDY_DOMAIN:-<domain>}/ once DNS points here)"
