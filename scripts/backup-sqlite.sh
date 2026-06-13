#!/usr/bin/env bash
#
# Backup automatisé SQLite — Veille
#
# Produit une copie atomique de la base via `VACUUM INTO` (méthode officielle
# SQLite ≥ 3.27, atomique, sûre même si l'application écrit en parallèle).
# Purge les backups plus anciens que VEILLE_BACKUP_RETENTION_DAYS jours.
#
# Cf. AUDIT.md §MT-10 / BACKLOG-V2.md US-1.8.
#
# Usage:
#   ./scripts/backup-sqlite.sh
#
# Variables (toutes optionnelles, valeurs par défaut adaptées au repo) :
#   VEILLE_DB_PATH                — chemin de la base (défaut: veille-app/prisma/dev.db)
#   VEILLE_BACKUP_DIR             — destination (défaut: backups/)
#   VEILLE_BACKUP_RETENTION_DAYS  — rétention en jours (défaut: 30)
#
# Sortie :
#   - 0 si OK, > 0 si erreur (vérifier stderr).
#   - Affiche les chemins source/cible et la taille du backup.
#   - Liste les fichiers supprimés par la purge.

set -euo pipefail

# -------- Localisation --------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

DB_PATH="${VEILLE_DB_PATH:-$PROJECT_ROOT/veille-app/prisma/dev.db}"
BACKUP_DIR="${VEILLE_BACKUP_DIR:-$PROJECT_ROOT/backups}"
RETENTION_DAYS="${VEILLE_BACKUP_RETENTION_DAYS:-30}"

log() { printf "[backup %s] %s\n" "$(date -Iseconds)" "$*"; }
err() { printf "[backup %s] ERREUR: %s\n" "$(date -Iseconds)" "$*" >&2; }

# -------- Vérifications --------
if ! command -v sqlite3 >/dev/null 2>&1; then
  err "sqlite3 introuvable. Installer : sudo apt install sqlite3"
  exit 1
fi

if [ ! -f "$DB_PATH" ]; then
  err "base introuvable: $DB_PATH"
  exit 1
fi

mkdir -p "$BACKUP_DIR"

# -------- Backup atomique --------
TS="$(date +%Y%m%d-%H%M%S)"
TARGET="$BACKUP_DIR/veille-${TS}.db"
TMP="${TARGET}.tmp"

log "source=$DB_PATH"
log "cible=$TARGET"

# VACUUM INTO : copie cohérente, sans verrouillage long de l'application.
# La cible doit ne pas exister, d'où le .tmp + rename atomique.
if ! sqlite3 "$DB_PATH" "VACUUM INTO '$TMP'"; then
  err "VACUUM INTO a échoué"
  rm -f "$TMP"
  exit 1
fi

# Rename atomique pour qu'un monitoring ne lise jamais un fichier partiel.
mv "$TMP" "$TARGET"

SIZE="$(du -h "$TARGET" | awk '{print $1}')"
log "OK ${TARGET##*/} (${SIZE})"

# -------- Rétention --------
log "purge des fichiers > ${RETENTION_DAYS} jours dans ${BACKUP_DIR}…"
# -mtime +N : fichier modifié il y a strictement plus de N jours.
PURGED="$(find "$BACKUP_DIR" -maxdepth 1 -name 'veille-*.db' -mtime "+${RETENTION_DAYS}" -print -delete | wc -l | tr -d ' ')"
log "purge terminée (${PURGED} fichier(s) supprimé(s))"
