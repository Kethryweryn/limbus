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

# Un seul déploiement à la fois (manuel ou depuis la CI)
exec 9>/run/limbus-deploy.lock
if ! flock -n 9; then
  echo "Un déploiement est déjà en cours."
  exit 1
fi

cd "$APP_DIR"

# Depuis la CI (clé SSH à commande forcée), SSH_ORIGINAL_COMMAND porte le commit validé :
# on avance main exactement jusqu'à lui, jamais au-delà. Sans argument : dernier commit de main.
DEPLOY_SHA="${1:-${SSH_ORIGINAL_COMMAND:-}}"
if [ -n "$DEPLOY_SHA" ]; then
  if ! [[ "$DEPLOY_SHA" =~ ^[0-9a-f]{40}$ ]]; then
    echo "Commit invalide : $DEPLOY_SHA"
    exit 1
  fi
  git fetch origin main
  git merge-base --is-ancestor "$DEPLOY_SHA" origin/main || { echo "$DEPLOY_SHA n'est pas sur main"; exit 1; }
  git merge --ff-only "$DEPLOY_SHA"
else
  git pull --ff-only
fi
echo "Déploiement de $(git rev-parse --short HEAD) : $(git log -1 --format=%s)"

rm -rf "$BUILD_DIR"
rsync -a --delete \
  --exclude .git \
  --exclude .output \
  --exclude .output-next \
  --exclude .output-prev \
  --exclude .data \
  --exclude .nuxt \
  --exclude node_modules \
  --exclude generated \
  "$APP_DIR/" "$BUILD_DIR/"

# Une seule installation, dans le dossier de build : elle sert au build, aux migrations,
# puis remplace celle de $APP_DIR (utilisée par les scripts comme npm run user:create).
# .nuxt est exclu de la copie : il contient des chemins absolus vers $APP_DIR
# qui cassent le prérendu (#internal/nuxt/paths introuvable)
cd "$BUILD_DIR"
npm ci --include=dev
npx prisma generate
npm run build
npx prisma migrate deploy

cd "$APP_DIR"
rm -rf .output-next .output-prev
mv "$BUILD_DIR/.output" .output-next
if [ -d .output ]; then
  mv .output .output-prev
fi
mv .output-next .output

rm -rf node_modules generated
mv "$BUILD_DIR/node_modules" "$BUILD_DIR/generated" .
rm -rf "$BUILD_DIR"

systemctl restart "$SERVICE_NAME"
systemctl status "$SERVICE_NAME" --no-pager
