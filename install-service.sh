#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/var/www/limbus"
SERVICE_NAME="limbus"
SERVICE_USER="limbus"
SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"
# Node système (paquet nodejs de NodeSource), pas celui de nvm dans /root
NODE_BIN="/usr/bin/node"

if [ "$(id -u)" -ne 0 ]; then
  echo "Ce script doit être lancé en root."
  exit 1
fi

if [ ! -x "$NODE_BIN" ]; then
  echo "Node.js est introuvable : $NODE_BIN"
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

if ! id "$SERVICE_USER" >/dev/null 2>&1; then
  useradd --system --user-group --no-create-home --home-dir /nonexistent --shell /usr/sbin/nologin "$SERVICE_USER"
fi

# Le code reste à root ; seul .data (uploads) est inscriptible par le service.
# .env reste en root:600 : systemd le lit avant de changer d'utilisateur.
chmod 600 "$APP_DIR/.env"
mkdir -p "$APP_DIR/.data/uploads"
chown -R "$SERVICE_USER:$SERVICE_USER" "$APP_DIR/.data"
chmod 750 "$APP_DIR/.data"

cat > "$SERVICE_FILE" <<EOF
[Unit]
Description=Limbus
After=network.target postgresql.service

[Service]
Type=simple
User=$SERVICE_USER
Group=$SERVICE_USER
WorkingDirectory=$APP_DIR
Environment=HOST=127.0.0.1
Environment=PORT=3000
EnvironmentFile=$APP_DIR/.env
ExecStart=$NODE_BIN .output/server/index.mjs
Restart=always
RestartSec=3
UMask=0027

NoNewPrivileges=true
CapabilityBoundingSet=
AmbientCapabilities=
ProtectSystem=strict
ReadWritePaths=$APP_DIR/.data
ProtectHome=true
PrivateTmp=true
PrivateDevices=true
ProtectKernelTunables=true
ProtectKernelModules=true
ProtectKernelLogs=true
ProtectControlGroups=true
ProtectClock=true
ProtectHostname=true
RestrictSUIDSGID=true
RestrictRealtime=true
RestrictNamespaces=true
LockPersonality=true
RestrictAddressFamilies=AF_INET AF_INET6 AF_UNIX
SystemCallArchitectures=native

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable "$SERVICE_NAME"
systemctl restart "$SERVICE_NAME"
systemctl status "$SERVICE_NAME" --no-pager
