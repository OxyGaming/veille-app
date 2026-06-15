#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# update.sh — Mise à jour Veille en production (Ubuntu / Nginx).
#
# Étapes par défaut :
#   1. Vérifie que le repo est propre (pas de modifs locales non commit).
#   2. Sauvegarde la base SQLite dans veille-app/data/backups/.
#   3. git pull (branche par défaut : main).
#   4. npm ci (install reproductible, supprime node_modules si nécessaire).
#   5. prisma generate + db:push (sync schéma sans migration formelle —
#      cohérent avec le README et `db:push` du package.json).
#   6. npm run build (build Next.js production).
#   7. Redémarrage du service (systemd par défaut).
#
# Usage :
#   ./update.sh                       # mise à jour complète
#   ./update.sh --branch ma-branche   # pull sur une autre branche
#   ./update.sh --no-backup           # saute l'étape 2 (à vos risques)
#   ./update.sh --no-build            # saute l'étape 6 (hot-reload externe)
#   ./update.sh --no-restart          # saute l'étape 7 (redémarrage manuel)
#   ./update.sh --service nom         # nom du service systemd (def: veille)
#   ./update.sh --pm2 nom             # utilise pm2 restart <nom> au lieu de systemd
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
SKIP_DEPS=0
ASSUME_YES=0
SERVICE_NAME="veille"
USE_PM2=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --branch)      BRANCH="$2"; shift 2 ;;
    --no-backup)   DO_BACKUP=0; shift ;;
    --no-build)    DO_BUILD=0; shift ;;
    --no-restart)  DO_RESTART=0; shift ;;
    --skip-deps)   SKIP_DEPS=1; shift ;;
    --service)     SERVICE_NAME="$2"; shift 2 ;;
    --pm2)         USE_PM2="$2"; shift 2 ;;
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
  if [[ -n "$USE_PM2" ]]; then
    log "Restart    : pm2 restart $USE_PM2"
  else
    log "Restart    : systemctl restart $SERVICE_NAME"
  fi
else
  log "Restart    : NON"
fi
echo

if [[ $ASSUME_YES -eq 0 ]]; then
  read -r -p "Procéder ? [y/N] " ans
  [[ "$ans" =~ ^[Yy]$ ]] || { warn "Annulé."; exit 0; }
fi

# ── 1. Repo propre ───────────────────────────────────────────────────────────
log "1/7  Vérification de l'état du repo…"
if ! git diff --quiet --ignore-submodules HEAD || \
   ! git diff --quiet --cached --ignore-submodules HEAD; then
  fail "Le repo a des modifications locales. Commit, stash ou reset avant de mettre à jour."
fi
ok "Repo propre."

# ── 2. Backup DB ─────────────────────────────────────────────────────────────
if [[ $DO_BACKUP -eq 1 ]]; then
  log "2/7  Sauvegarde de la base SQLite…"
  BACKUP_DIR="$APP_DIR/data/backups"
  mkdir -p "$BACKUP_DIR"
  # Détecte la DB depuis .env (DATABASE_URL=file:./prod.db) puis fallback prod.db.
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
  [[ -z "$DB_PATH" ]] && DB_PATH="$APP_DIR/prod.db"
  if [[ -f "$DB_PATH" ]]; then
    TS=$(date +%Y%m%d-%H%M%S)
    DEST="$BACKUP_DIR/prod-${TS}.db"
    cp -p "$DB_PATH" "$DEST"
    # SQLite : les fichiers -wal / -shm peuvent contenir des écritures non
    # encore mergées. On les copie aussi quand ils existent.
    [[ -f "${DB_PATH}-wal" ]] && cp -p "${DB_PATH}-wal" "$DEST-wal"
    [[ -f "${DB_PATH}-shm" ]] && cp -p "${DB_PATH}-shm" "$DEST-shm"
    ok "Backup : $DEST ($(du -h "$DEST" | cut -f1))"
  else
    warn "Aucune base trouvée à $DB_PATH — backup ignoré."
  fi
else
  warn "2/7  Backup ignoré (--no-backup)."
fi

# ── 3. git pull ──────────────────────────────────────────────────────────────
log "3/7  git pull origin $BRANCH…"
git fetch origin "$BRANCH"
git checkout "$BRANCH"
git pull --ff-only origin "$BRANCH"
NEW_SHA=$(git rev-parse --short HEAD)
ok "HEAD = $NEW_SHA"

# ── 4. Dépendances ───────────────────────────────────────────────────────────
cd "$APP_DIR"
if [[ $SKIP_DEPS -eq 0 ]]; then
  log "4/7  npm ci…"
  npm ci
  ok "Dépendances synchronisées."
else
  warn "4/7  npm ci ignoré (--skip-deps)."
fi

# ── 5. Prisma ────────────────────────────────────────────────────────────────
log "5/7  Prisma generate + db:push…"
npx prisma generate
npm run db:push
ok "Schéma Prisma à jour."

# ── 6. Build ─────────────────────────────────────────────────────────────────
if [[ $DO_BUILD -eq 1 ]]; then
  log "6/7  npm run build…"
  npm run build
  ok "Build production OK."
else
  warn "6/7  Build ignoré (--no-build)."
fi

# ── 7. Redémarrage ───────────────────────────────────────────────────────────
if [[ $DO_RESTART -eq 1 ]]; then
  if [[ -n "$USE_PM2" ]]; then
    log "7/7  pm2 restart $USE_PM2…"
    pm2 restart "$USE_PM2"
    ok "Service relancé (pm2)."
  else
    log "7/7  systemctl restart $SERVICE_NAME…"
    if ! command -v systemctl >/dev/null 2>&1; then
      warn "systemctl introuvable — relancez le service manuellement."
    else
      # sudo si on n'est pas root.
      if [[ $EUID -ne 0 ]]; then
        sudo systemctl restart "$SERVICE_NAME"
      else
        systemctl restart "$SERVICE_NAME"
      fi
      ok "Service relancé (systemd)."
    fi
  fi
else
  warn "7/7  Redémarrage ignoré (--no-restart) — pensez à relancer le service."
fi

echo
ok "${C_BOLD}Mise à jour terminée — HEAD = $NEW_SHA${C_RESET}"
