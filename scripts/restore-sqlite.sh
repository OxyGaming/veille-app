#!/usr/bin/env bash
#
# Restauration d'un backup SQLite — Veille
#
# Remplace `dev.db` par le fichier de backup fourni. Avant remplacement,
# une copie de sécurité de la base actuelle est créée (suffixe
# `.pre-restore-YYYYMMDD-HHMMSS`).
#
# Cf. AUDIT.md §MT-10 / BACKLOG-V2.md US-1.8.
#
# Usage:
#   ./scripts/restore-sqlite.sh <chemin/backup.db> [<chemin/dev.db>]
#
# Exemples:
#   ./scripts/restore-sqlite.sh backups/veille-20260601-030000.db
#   ./scripts/restore-sqlite.sh /var/backups/veille/veille-20260601-030000.db
#
# IMPORTANT — l'application doit être arrêtée pendant la restauration pour
# éviter toute corruption (better-sqlite3 garde un handle ouvert).
#   sudo systemctl stop veille     # adapter au nom réel du service

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

SOURCE="${1:-}"
TARGET="${2:-$PROJECT_ROOT/veille-app/prisma/dev.db}"

log() { printf "[restore %s] %s\n" "$(date -Iseconds)" "$*"; }
err() { printf "[restore %s] ERREUR: %s\n" "$(date -Iseconds)" "$*" >&2; }

# -------- Vérifications --------
if [ -z "$SOURCE" ]; then
  err "Usage: $0 <chemin/backup.db> [<chemin/dev.db>]"
  exit 1
fi

if [ ! -f "$SOURCE" ]; then
  err "fichier de backup introuvable: $SOURCE"
  exit 1
fi

# Sanity check : vérifier que le backup est bien une base SQLite valide.
if ! command -v sqlite3 >/dev/null 2>&1; then
  err "sqlite3 introuvable. Installer : sudo apt install sqlite3"
  exit 1
fi
if ! sqlite3 "$SOURCE" "PRAGMA integrity_check;" | grep -q '^ok$'; then
  err "le backup n'est pas une base SQLite saine: $SOURCE"
  exit 1
fi

# -------- Confirmation --------
log "ATTENTION : la base"
log "  $TARGET"
log "va être remplacée par"
log "  $SOURCE"
log ""
log "L'application doit être ARRÊTÉE pendant l'opération."
log ""
printf "[restore] Confirmer (taper 'oui' pour continuer) : "
read -r ANSWER
if [ "$ANSWER" != "oui" ]; then
  log "annulé"
  exit 0
fi

# -------- Copie de sécurité --------
if [ -f "$TARGET" ]; then
  SAFE="${TARGET}.pre-restore-$(date +%Y%m%d-%H%M%S)"
  cp "$TARGET" "$SAFE"
  log "copie de sécurité créée: $SAFE"
fi

# -------- Restauration --------
cp "$SOURCE" "$TARGET"
log "OK base restaurée depuis $SOURCE"
log ""
log "→ Redémarrez l'application pour qu'elle prenne en compte la nouvelle base."
log "  Exemple : sudo systemctl start veille"
