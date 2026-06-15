#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# update.sh — Mise à jour Veille en production (Ubuntu / Nginx).
#
# Étapes par défaut (alignées sur la prod /var/www/veille, PM2, port 3004) :
#   1. Vérifie que le repo est propre (pas de modifs locales non commit).
#   2. Sauvegarde la base SQLite AVANT migration (data/backups/, horodatée).
#   3. git pull --ff-only (branche par défaut : main).
#   4. npm ci (install reproductible).
#   5. prisma migrate deploy + prisma generate
#      → JAMAIS `db push` en prod, uniquement les migrations versionnées.
#   6. npm run build (build Next.js production).
#   7. pm2 restart veille --update-env && pm2 save.
#   8. Vérification finale : pm2 status veille + curl -I localhost:3004.
#
# Usage :
#   ./update.sh                       # mise à jour complète
#   ./update.sh --branch ma-branche   # pull sur une autre branche
#   ./update.sh --no-backup           # saute l'étape 2 (à vos risques)
#   ./update.sh --no-build            # saute l'étape 6 (hot-reload externe)
#   ./update.sh --no-restart          # saute les étapes 7 + 8
#   ./update.sh --no-verify           # saute uniquement l'étape 8
#   ./update.sh --pm2 nom             # nom du process PM2 (def: veille)
#   ./update.sh --port 3004           # port utilisé par la vérif curl (def: 3004)
#   ./update.sh --systemd nom         # utilise systemctl restart <nom> au lieu de PM2
#   ./update.sh --skip-deps           # ne refait pas npm ci si node_modules existe
#   ./update.sh -y                    # ne demande pas confirmation
#
# Code retour : 0 = OK, ≠ 0 = échec à une étape (set -e).
# -----------------------------------------------------------------------------

set -euo pipefail

# ── Couleurs ─────────────────────────────────────────────────────────────────
if [[ -t 1 ]]; then
  C_RESET=$'\e[0m'; C_BOLD=$'\e[1m'
  C_RED=$'\e[31m'; C_GREEN=$'\e[32m'; C_YELLOW=$'\e[33m'; C_BLUE=$'\e[34m'
else
  C_RESET=; C_BOLD=; C_RED=; C_GREEN=; C_YELLOW=; C_BLUE=
fi
log()   { echo "${C_BLUE}▸${C_RESET} $*"; }
ok()    { echo "${C_GREEN}✓${C_RESET} $*"; }
warn()  { echo "${C_YELLOW}!${C_RESET} $*" >&2; }
fail()  { echo "${C_RED}✗${C_RESET} $*" >&2; exit 1; }

# ── Paramètres CLI ───────────────────────────────────────────────────────────
BRANCH="main"
DO_BACKUP=1
DO_BUILD=1
DO_RESTART=1
DO_VERIFY=1
SKIP_DEPS=0
ASSUME_YES=0
# PM2 par défaut, conforme à la prod /var/www/veille.
PM2_NAME="veille"
SYSTEMD_NAME=""
PORT="3004"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --branch)      BRANCH="$2"; shift 2 ;;
    --no-backup)   DO_BACKUP=0; shift ;;
    --no-build)    DO_BUILD=0; shift ;;
    --no-restart)  DO_RESTART=0; DO_VERIFY=0; shift ;;
    --no-verify)   DO_VERIFY=0; shift ;;
    --skip-deps)   SKIP_DEPS=1; shift ;;
    --pm2)         PM2_NAME="$2"; SYSTEMD_NAME=""; shift 2 ;;
    --port)        PORT="$2"; shift 2 ;;
    --systemd)     SYSTEMD_NAME="$2"; shift 2 ;;
    -y|--yes)      ASSUME_YES=1; shift ;;
    -h|--help)
      grep '^#' "$0" | sed 's/^# \{0,1\}//'
      exit 0 ;;
    *)             fail "Argument inconnu : $1 (voir --help)" ;;
  esac
done

# ── Localisation ─────────────────────────────────────────────────────────────
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$REPO_ROOT/veille-app"
[[ -d "$APP_DIR" ]] || fail "Dossier $APP_DIR introuvable."
[[ -f "$APP_DIR/package.json" ]] || fail "package.json absent dans $APP_DIR."
cd "$REPO_ROOT"

# ── Banner ───────────────────────────────────────────────────────────────────
echo "${C_BOLD}== Veille — mise à jour ==${C_RESET}"
log "Repo       : $REPO_ROOT"
log "App        : $APP_DIR"
log "Branche    : $BRANCH"
log "Backup DB  : $([[ $DO_BACKUP -eq 1 ]] && echo oui || echo NON)"
log "Build      : $([[ $DO_BUILD -eq 1 ]] && echo oui || echo NON)"
if [[ $DO_RESTART -eq 1 ]]; then
  if [[ -n "$SYSTEMD_NAME" ]]; then
    log "Restart    : systemctl restart $SYSTEMD_NAME"
  else
    log "Restart    : pm2 restart $PM2_NAME --update-env && pm2 save"
  fi
else
  log "Restart    : NON"
fi
log "Vérif      : $([[ $DO_VERIFY -eq 1 ]] && echo "oui (port $PORT)" || echo NON)"
echo

if [[ $ASSUME_YES -eq 0 ]]; then
  read -r -p "Procéder ? [y/N] " ans
  [[ "$ans" =~ ^[Yy]$ ]] || { warn "Annulé."; exit 0; }
fi

# ── 1. Repo propre ───────────────────────────────────────────────────────────
log "1/8  Vérification de l'état du repo…"
if ! git diff --quiet --ignore-submodules HEAD || \
   ! git diff --quiet --cached --ignore-submodules HEAD; then
  fail "Le repo a des modifications locales. Commit, stash ou reset avant de mettre à jour."
fi
ok "Repo propre."

# ── 2. Backup DB (AVANT migration) ───────────────────────────────────────────
# Détection ordonnée :
#   1. DATABASE_URL dans veille-app/.env
#   2. veille-app/prod.db (legacy convention)
#   3. veille-app/prisma/dev.db (convention Prisma par défaut)
# Le backup est volontairement fait avant `git pull` ET avant `prisma
# migrate deploy` — si la migration échoue ou si le build casse plus
# loin, on rollback en restaurant le fichier sauvegardé.
if [[ $DO_BACKUP -eq 1 ]]; then
  log "2/8  Sauvegarde SQLite (avant migration)…"
  BACKUP_DIR="$APP_DIR/data/backups"
  mkdir -p "$BACKUP_DIR"
  DB_PATH=""
  if [[ -f "$APP_DIR/.env" ]]; then
    raw=$(grep -E '^DATABASE_URL=' "$APP_DIR/.env" | head -1 | cut -d= -f2-)
    raw="${raw#\"}"; raw="${raw%\"}"; raw="${raw#\'}"; raw="${raw%\'}"
    case "$raw" in
      file:./*) DB_PATH="$APP_DIR/${raw#file:./}" ;;
      file:/*)  DB_PATH="${raw#file:}" ;;
      file:*)   DB_PATH="$APP_DIR/${raw#file:}" ;;
    esac
  fi
  # Fallbacks dans l'ordre : prod.db puis prisma/dev.db.
  if [[ -z "$DB_PATH" || ! -f "$DB_PATH" ]]; then
    if [[ -f "$APP_DIR/prod.db" ]]; then
      DB_PATH="$APP_DIR/prod.db"
    elif [[ -f "$APP_DIR/prisma/dev.db" ]]; then
      DB_PATH="$APP_DIR/prisma/dev.db"
    fi
  fi
  if [[ -n "$DB_PATH" && -f "$DB_PATH" ]]; then
    TS=$(date +%Y%m%d-%H%M%S)
    BASE=$(basename "$DB_PATH" .db)
    DEST="$BACKUP_DIR/${BASE}-${TS}.db"
    cp -p "$DB_PATH" "$DEST"
    # SQLite : les fichiers -wal / -shm peuvent contenir des écritures non
    # encore mergées. On les copie aussi quand ils existent.
    [[ -f "${DB_PATH}-wal" ]] && cp -p "${DB_PATH}-wal" "$DEST-wal"
    [[ -f "${DB_PATH}-shm" ]] && cp -p "${DB_PATH}-shm" "$DEST-shm"
    ok "Backup : $DEST ($(du -h "$DEST" | cut -f1))"
  else
    fail "Aucune base SQLite trouvée (essayé : DATABASE_URL, prod.db, prisma/dev.db). \
Lancez --no-backup si vous comprenez le risque."
  fi
else
  warn "2/8  Backup ignoré (--no-backup) — RISQUE en cas de migration cassée."
fi

# ── 3. git pull ──────────────────────────────────────────────────────────────
log "3/8  git pull --ff-only origin $BRANCH…"
git fetch origin "$BRANCH"
git checkout "$BRANCH"
git pull --ff-only origin "$BRANCH"
NEW_SHA=$(git rev-parse --short HEAD)
ok "HEAD = $NEW_SHA"

# ── 4. Dépendances ───────────────────────────────────────────────────────────
cd "$APP_DIR"
if [[ $SKIP_DEPS -eq 0 ]]; then
  log "4/8  npm ci…"
  npm ci
  ok "Dépendances synchronisées."
else
  warn "4/8  npm ci ignoré (--skip-deps)."
fi

# ── 5. Prisma ────────────────────────────────────────────────────────────────
# Prod : applique UNIQUEMENT les migrations versionnées. JAMAIS `db push`
# qui altère le schéma sans migration. `prisma migrate deploy` est
# idempotent et sûr (no-op si tout est déjà appliqué).
log "5/8  Prisma migrate deploy + generate…"
npx prisma migrate deploy
npx prisma generate
ok "Migrations appliquées et client Prisma régénéré."

# ── 6. Build ─────────────────────────────────────────────────────────────────
if [[ $DO_BUILD -eq 1 ]]; then
  log "6/8  npm run build…"
  npm run build
  ok "Build production OK."
else
  warn "6/8  Build ignoré (--no-build)."
fi

# ── 7. Redémarrage ───────────────────────────────────────────────────────────
# `--update-env` recharge les variables d'env du shell courant — utile
# si .env a été modifié entre deux deploys. `pm2 save` persiste la
# liste pour qu'elle soit restaurée au boot via `pm2 startup`.
if [[ $DO_RESTART -eq 1 ]]; then
  if [[ -n "$SYSTEMD_NAME" ]]; then
    log "7/8  systemctl restart $SYSTEMD_NAME…"
    if ! command -v systemctl >/dev/null 2>&1; then
      warn "systemctl introuvable — relancez le service manuellement."
    else
      if [[ $EUID -ne 0 ]]; then
        sudo systemctl restart "$SYSTEMD_NAME"
      else
        systemctl restart "$SYSTEMD_NAME"
      fi
      ok "Service relancé (systemd)."
    fi
  else
    log "7/8  pm2 restart $PM2_NAME --update-env && pm2 save…"
    if ! command -v pm2 >/dev/null 2>&1; then
      warn "pm2 introuvable — relancez le process manuellement."
    else
      pm2 restart "$PM2_NAME" --update-env
      pm2 save
      ok "Process PM2 relancé (--update-env) et liste sauvegardée."
    fi
  fi
else
  warn "7/8  Redémarrage ignoré (--no-restart) — pensez à relancer le service."
fi

# ── 8. Vérification finale ──────────────────────────────────────────────────
# `pm2 status` confirme l'état online + uptime court (= vient de
# redémarrer). `curl -I` valide que le serveur HTTP répond. Un statut
# 2xx/3xx (ex. 200 OK, 307 redirect vers /login) est considéré OK.
if [[ $DO_VERIFY -eq 1 ]]; then
  log "8/8  Vérification finale…"
  if [[ -z "$SYSTEMD_NAME" ]] && command -v pm2 >/dev/null 2>&1; then
    echo
    pm2 status "$PM2_NAME" || warn "pm2 status a renvoyé un code non-zéro."
    echo
  fi
  if command -v curl >/dev/null 2>&1; then
    log "  curl -I http://localhost:$PORT"
    # -s silencieux, -S garde les erreurs, -L suit les redirects, --max-time pour ne pas pendre
    if HTTP_LINE=$(curl -s -S -I -L --max-time 10 "http://localhost:$PORT" 2>&1 | head -1); then
      echo "  → $HTTP_LINE"
      # Détecte le code de statut : OK si 2xx ou 3xx
      if [[ "$HTTP_LINE" =~ HTTP/[0-9.]+\ ([23][0-9]{2}) ]]; then
        ok "Serveur HTTP répond (port $PORT)."
      else
        warn "Réponse HTTP inattendue — vérifier manuellement."
      fi
    else
      warn "curl a échoué — le serveur est peut-être encore en démarrage."
    fi
  else
    warn "curl introuvable — vérification HTTP ignorée."
  fi
else
  warn "8/8  Vérification ignorée."
fi

echo
ok "${C_BOLD}Mise à jour terminée — HEAD = $NEW_SHA${C_RESET}"
