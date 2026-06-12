#!/usr/bin/env bash
###############################################################################
# Veille — installation initiale sur Ubuntu/Debian
#
# Usage :
#   sudo bash deploy/install.sh
#   ou bien :
#   sudo bash deploy/install.sh https://github.com/<owner>/<repo>.git
#
# Variables surchargeables :
#   REPO_URL   URL du dépôt (défaut : celui du fichier en bas)
#   APP_DIR    Répertoire d'install (défaut /var/www/veille)
#   APP_USER   Owner Unix (défaut ubuntu)
#   PORT       Port HTTP Next.js (défaut 3004)
#   PM2_NAME   Nom du process PM2 (défaut veille)
#
# Prérequis : Node.js >= 20, npm, git, build-essential (le script tente de
# les installer s'ils manquent).
###############################################################################
set -euo pipefail

REPO_URL="${REPO_URL:-${1:-https://github.com/OxyGaming/veille-app.git}}"
APP_DIR="${APP_DIR:-/var/www/veille}"
APP_USER="${APP_USER:-ubuntu}"
PORT="${PORT:-3004}"
PM2_NAME="${PM2_NAME:-veille}"

color()  { printf "\033[%sm%s\033[0m\n" "$1" "$2"; }
step()   { color "1;34" "▶ $1"; }
ok()     { color "1;32" "✓ $1"; }
warn()   { color "1;33" "⚠ $1"; }
die()    { color "1;31" "✗ $1"; exit 1; }

# Doit être root (apt + chown).
[ "$(id -u)" -eq 0 ] || die "Lance ce script avec sudo (apt, chown)."

step "Paramètres"
echo "  Dépôt   : $REPO_URL"
echo "  Cible   : $APP_DIR"
echo "  Owner   : $APP_USER"
echo "  Port    : $PORT"
echo "  PM2     : $PM2_NAME"

step "Dépendances système"
apt-get update -y
apt-get install -y --no-install-recommends \
  git curl ca-certificates build-essential python3

# Node.js >= 20 via NodeSource si absent.
if ! command -v node >/dev/null 2>&1 || \
   [ "$(node -p 'parseInt(process.versions.node, 10)')" -lt 20 ]; then
  step "Installation Node.js 20 (NodeSource)"
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
node -v && npm -v

# PM2 global.
if ! command -v pm2 >/dev/null 2>&1; then
  step "Installation PM2"
  npm install -g pm2
fi

# Cloner ou rebrancher le dépôt.
step "Récupération du code"
mkdir -p "$(dirname "$APP_DIR")"
if [ -d "$APP_DIR/.git" ]; then
  warn "Dépôt déjà présent dans $APP_DIR — on ne reclone pas."
else
  git clone "$REPO_URL" "$APP_DIR"
fi
chown -R "$APP_USER:$APP_USER" "$APP_DIR"

APP_INNER="$APP_DIR/veille-app"
[ -d "$APP_INNER" ] || die "Structure inattendue : $APP_INNER absent."

# .env
ENV_FILE="$APP_INNER/.env"
if [ ! -f "$ENV_FILE" ]; then
  step "Génération du .env"
  AUTH_SECRET="$(openssl rand -hex 32)"
  SA_KEY="$(openssl rand -base64 32)"
  cat > "$ENV_FILE" <<EOF
# === Veille — configuration production ===
NODE_ENV=production

# Base SQLite (chemin relatif à veille-app/)
DATABASE_URL="file:./prisma/dev.db"

# Secret pour les cookies d'auth (16 chars min)
VEILLE_AUTH_SECRET="$AUTH_SECRET"

# Clé pour les Server Actions (Next.js)
NEXT_SERVER_ACTIONS_ENCRYPTION_KEY="$SA_KEY"

# Dossier des photos uploadées (défaut public/uploads)
# VEILLE_UPLOAD_DIR=""

# Port d'écoute
PORT=$PORT
EOF
  chown "$APP_USER:$APP_USER" "$ENV_FILE"
  chmod 600 "$ENV_FILE"
  ok ".env créé ($ENV_FILE)"
else
  warn ".env existant — on respecte la configuration en place."
fi

# Tout ce qui suit doit s'exécuter en tant qu'utilisateur applicatif.
step "Installation des dépendances npm"
sudo -u "$APP_USER" bash -c "cd '$APP_INNER' && npm ci"

step "Génération du client Prisma + schéma SQLite"
sudo -u "$APP_USER" bash -c "cd '$APP_INNER' && npx prisma generate"
sudo -u "$APP_USER" bash -c "cd '$APP_INNER' && npx prisma db push"

# Seed initial : crée admin, équipe, procédures, templates. Idempotent.
step "Seed initial"
sudo -u "$APP_USER" bash -c "cd '$APP_INNER' && npx tsx prisma/seed.ts" || warn "Seed déjà appliqué ou non bloquant."

step "Build production"
sudo -u "$APP_USER" bash -c "cd '$APP_INNER' && npm run build"

# Dossier des photos uploadées (utilise public/uploads si pas surchargé).
sudo -u "$APP_USER" mkdir -p "$APP_INNER/public/uploads"

# PM2 — on tue l'ancien process si existant, on remonte avec le bon port.
step "Démarrage PM2 ($PM2_NAME sur :$PORT)"
sudo -u "$APP_USER" bash -c "pm2 delete '$PM2_NAME' >/dev/null 2>&1 || true"
sudo -u "$APP_USER" bash -c \
  "cd '$APP_INNER' && PORT=$PORT pm2 start npm --name '$PM2_NAME' -- start"
sudo -u "$APP_USER" pm2 save

# Démarrage au boot (génère puis copie la commande systemd).
step "Activation au boot"
STARTUP_CMD="$(sudo -u "$APP_USER" pm2 startup systemd -u "$APP_USER" --hp "/home/$APP_USER" 2>&1 | tail -1)"
echo "$STARTUP_CMD"
if echo "$STARTUP_CMD" | grep -q "^sudo "; then
  eval "$STARTUP_CMD" || warn "Impossible d'exécuter automatiquement le startup PM2 — fais-le à la main."
fi
sudo -u "$APP_USER" pm2 save

ok "Installation terminée."
echo
echo "  Logs        : sudo -u $APP_USER pm2 logs $PM2_NAME"
echo "  Statut      : sudo -u $APP_USER pm2 status"
echo "  Test local  : curl -I http://127.0.0.1:$PORT/"
echo
echo "Identifiants par défaut (à changer dans /admin/users) :"
echo "  email    admin@veille.local"
echo "  password admin"
