#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/var/www/limbus"
BUILD_DIR="/tmp/limbus-build"
SERVICE_NAME="limbus"

# Construire avec le même Node que celui du service (paquet système), pas celui de nvm
export PATH="/usr/bin:/bin:/usr/sbin:/sbin"

if [ "$(id -u)" -ne 0 ]; then
  echo "Ce script doit être lancé en root."
  exit 1
fi

if ! command -v rsync >/dev/null 2>&1; then
  echo "rsync est requis pour préparer le build hors du dossier actif."
  exit 1
fi

cd "$APP_DIR"

git pull
npm ci --include=dev
npx prisma generate

rm -rf "$BUILD_DIR"
rsync -a --delete \
  --exclude .git \
  --exclude .output \
  --exclude .output-next \
  --exclude .output-prev \
  --exclude .data \
  --exclude node_modules \
  "$APP_DIR/" "$BUILD_DIR/"

cd "$BUILD_DIR"
# Installation propre : un node_modules en lien symbolique casse la résolution
# des imports internes de Nuxt (#internal/nuxt/paths) au prérendu
npm ci --include=dev
npm run build

cd "$APP_DIR"
npx prisma migrate deploy

rm -rf .output-next .output-prev
mv "$BUILD_DIR/.output" .output-next
if [ -d .output ]; then
  mv .output .output-prev
fi
mv .output-next .output

systemctl restart "$SERVICE_NAME"
systemctl status "$SERVICE_NAME" --no-pager
