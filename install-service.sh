#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/var/www/limbus"
SERVICE_NAME="limbus"
SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"
NODE_BIN="$(command -v node || true)"

if [ "$(id -u)" -ne 0 ]; then
  echo "Ce script doit être lancé en root."
  exit 1
fi

if [ -z "$NODE_BIN" ]; then
  echo "Node.js est introuvable."
  exit 1
fi

if [ ! -d "$APP_DIR" ]; then
  echo "Dossier introuvable : $APP_DIR"
  exit 1
fi

if [ ! -f "$APP_DIR/.env" ]; then
  echo "Fichier .env introuvable : $APP_DIR/.env"
  exit 1
fi

if [ ! -f "$APP_DIR/.output/server/index.mjs" ]; then
  echo "Build Nuxt introuvable : $APP_DIR/.output/server/index.mjs"
  echo "Lancez d'abord npm run build ou ./deploy.sh."
  exit 1
fi

cat > "$SERVICE_FILE" <<EOF
[Unit]
Description=Limbus
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=$APP_DIR
EnvironmentFile=$APP_DIR/.env
ExecStart=$NODE_BIN .output/server/index.mjs
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable "$SERVICE_NAME"
systemctl restart "$SERVICE_NAME"
systemctl status "$SERVICE_NAME" --no-pager
