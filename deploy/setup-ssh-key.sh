#!/usr/bin/env bash
###############################################################################
# Veille — génère une deploy key SSH et bascule le repo en SSH
#
# À lancer en tant qu'utilisateur applicatif (par défaut ubuntu) :
#   bash deploy/setup-ssh-key.sh
#
# Le script :
#   1. Crée ~/.ssh/id_ed25519 si absent (sans passphrase)
#   2. Affiche la clé publique à copier sur GitHub
#   3. Attend confirmation, teste la connexion, et reconfigure le remote
#      du dépôt en SSH (git@github.com:owner/repo.git).
#
# Variables :
#   APP_DIR   Répertoire du dépôt (défaut /var/www/veille)
#   REPO      <owner/repo> sur GitHub (défaut OxyGaming/veille-app)
###############################################################################
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/veille}"
REPO="${REPO:-OxyGaming/veille-app}"
KEY_FILE="${KEY_FILE:-$HOME/.ssh/id_ed25519}"

color()  { printf "\033[%sm%s\033[0m\n" "$1" "$2"; }
step()   { color "1;34" "▶ $1"; }
ok()     { color "1;32" "✓ $1"; }
warn()   { color "1;33" "⚠ $1"; }
die()    { color "1;31" "✗ $1"; exit 1; }

# Pas root : on veut la clé dans le HOME utilisateur applicatif.
if [ "$(id -u)" -eq 0 ]; then
  die "Lance ce script en tant qu'utilisateur applicatif (ex: sudo -u ubuntu bash ...), pas en root."
fi

step "Génération de la clé SSH"
mkdir -p "$HOME/.ssh"
chmod 700 "$HOME/.ssh"
if [ -f "$KEY_FILE" ]; then
  warn "Clé existante détectée : $KEY_FILE — on ne l'écrase pas."
else
  ssh-keygen -t ed25519 -N "" -C "veille-deploy@$(hostname)" -f "$KEY_FILE"
  ok "Clé générée : $KEY_FILE"
fi

step "Ajout de la clé publique sur GitHub"
echo
color "1;36" "================================================================"
color "1;36" "  COPIE LA CLÉ CI-DESSOUS — sur GitHub :"
color "1;36" "  Repo $REPO → Settings → Deploy keys → Add deploy key"
color "1;36" "  Titre : vps-$(hostname)"
color "1;36" "  ✓ Allow write access  (laissé OFF si lecture seule suffit)"
color "1;36" "================================================================"
echo
cat "${KEY_FILE}.pub"
echo
color "1;36" "================================================================"
echo
read -r -p "Une fois la clé ajoutée sur GitHub, appuie sur ENTRÉE pour tester… " _

step "Test de la connexion SSH GitHub"
# GitHub ne fournit jamais de shell, le code de sortie est toujours non-zero.
# Mais le message « Hi <user>! You've successfully authenticated » confirme.
TEST_OUTPUT="$(ssh -T -o StrictHostKeyChecking=accept-new git@github.com 2>&1 || true)"
echo "$TEST_OUTPUT"
if echo "$TEST_OUTPUT" | grep -q "successfully authenticated"; then
  ok "Authentification SSH OK"
else
  die "Échec authentification SSH — vérifie que la clé est bien ajoutée comme deploy key sur $REPO."
fi

step "Reconfiguration du remote du dépôt"
if [ -d "$APP_DIR/.git" ]; then
  CURRENT_URL="$(cd "$APP_DIR" && git remote get-url origin)"
  TARGET_URL="git@github.com:${REPO}.git"
  if [ "$CURRENT_URL" = "$TARGET_URL" ]; then
    warn "Le remote est déjà en SSH ($TARGET_URL)."
  else
    (cd "$APP_DIR" && git remote set-url origin "$TARGET_URL")
    ok "Remote du dépôt $APP_DIR basculé sur $TARGET_URL"
  fi
  step "Vérification : git fetch"
  (cd "$APP_DIR" && git fetch --quiet origin) && ok "git fetch OK — plus besoin de token."
else
  warn "Pas de dépôt git dans $APP_DIR — la clé est prête mais rien à reconfigurer."
fi

ok "Terminé. Les `git pull` futurs n'auront plus besoin de mot de passe."
