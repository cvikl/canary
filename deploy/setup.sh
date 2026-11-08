#!/usr/bin/env bash
# Canary Cage VM setup. Ubuntu 24.04, run as root once:  ssh root@<ip> 'bash -s' < deploy/setup.sh
# Installs Docker CE, Node 24, strace, Caddy (skip with NO_CADDY=1), creates /opt/canary-cage and the systemd unit.
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive
APP_DIR=/opt/canary-cage

echo "==> base packages"
apt-get update -qq
apt-get install -y -qq ca-certificates curl gnupg strace openssl rsync unzip >/dev/null

if ! command -v docker >/dev/null; then
  echo "==> docker ce"
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" > /etc/apt/sources.list.d/docker.list
  apt-get update -qq
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io >/dev/null
fi
systemctl enable --now docker

if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 24 ]; then
  echo "==> node 24"
  curl -fsSL https://deb.nodesource.com/setup_24.x | bash - >/dev/null
  apt-get install -y -qq nodejs >/dev/null
fi
node --version

if [ "${NO_CADDY:-0}" != "1" ] && ! command -v caddy >/dev/null; then
  echo "==> caddy"
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -qq && apt-get install -y -qq caddy >/dev/null
fi

echo "==> app dir and unit"
mkdir -p $APP_DIR
cat > /etc/systemd/system/canary-cage.service <<'UNIT'
[Unit]
Description=Canary Cage for MCP (orchestrator on the VM host; strace needs host ptrace, so this runs as root and outside Docker)
After=docker.service network-online.target
Requires=docker.service

[Service]
Type=simple
WorkingDirectory=/opt/canary-cage
EnvironmentFile=/opt/canary-cage/.env
ExecStart=/usr/bin/node host/src/server.ts
Restart=always
RestartSec=3
User=root
NoNewPrivileges=false
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
echo "==> done. Next: SERVER=root@<ip> bash deploy/publish.sh"
