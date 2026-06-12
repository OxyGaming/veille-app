#!/usr/bin/env bash
###############################################################################
# Veille — mise à jour depuis le dépôt distant
#
# Usage :
#   sudo bash deploy/update.sh
#   ou bien :
#   bash deploy/update.sh         (si lancé en tant qu'utilisateur applicatif)
#
# Variables :
#   APP_DIR    Répertoire d'install (défaut /var/www/veille)
#   APP_USER   Owner Unix (défaut ubuntu)
#   PM2_NAME   Nom du process PM2 (défaut veille)
#   BRANCH     Branche à puller (défaut main)
###############################################################################
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/veille}"
APP_USER="${APP_USER:-ubuntu}"
PM2_NAME="${PM2_NAME:-veille}"
BRANCH="${BRANCH:-main}"

color()  { printf "\033[%sm%s\033[0m\n" "$1" "$2"; }
step()   { color "1;34" "▶ $1"; }
ok()     { color "1;32" "✓ $1"; }
warn()   { color "1;33" "⚠ $1"; }
die()    { color "1;31" "✗ $1"; exit 1; }

APP_INNER="$APP_DIR/veille-app"
[ -d "$APP_INNER/.git" ] || [ -d "$APP_DIR/.git" ] || \
  die "Pas de dépôt git dans $APP_DIR — utilise install.sh d'abord."

# Si lancé en root, on bascule sur l'utilisateur applicatif pour la suite.
if [ "$(id -u)" -eq 0 ]; then
  warn "Lancé en root — délégation à $APP_USER."
  RUNNER="sudo -u $APP_USER bash -c"
else
  RUNNER="bash -c"
fi

step "git pull --ff-only ($BRANCH)"
$RUNNER "cd '$APP_DIR' && git fetch origin && git checkout '$BRANCH' && git pull --ff-only origin '$BRANCH'"

step "Installation des dépendances"
$RUNNER "cd '$APP_INNER' && npm ci"

step "Migration schéma Prisma"
$RUNNER "cd '$APP_INNER' && npx prisma generate"
$RUNNER "cd '$APP_INNER' && npx prisma db push"

step "Build production"
$RUNNER "cd '$APP_INNER' && npm run build"

step "Reload PM2"
$RUNNER "pm2 reload '$PM2_NAME' --update-env || pm2 restart '$PM2_NAME' --update-env"
$RUNNER "pm2 save"

ok "Mise à jour terminée."
echo
$RUNNER "pm2 status '$PM2_NAME'" || true
