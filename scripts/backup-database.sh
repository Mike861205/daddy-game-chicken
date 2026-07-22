#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Daddy Game Chicken - database backup script (Neon PostgreSQL).
# Creates a timestamped SQL dump using pg_dump.
#
# Requires the DATABASE_URL (or DIRECT_URL) to be available in the environment
# or in the project .env file. This script is READ-ONLY against the database.
# ---------------------------------------------------------------------------
set -euo pipefail

PROJECT_DIR="${PROJECT_DIR:-/var/www/daddy-game-chicken}"
BACKUP_DIR="${BACKUP_DIR:-$PROJECT_DIR/backups}"

cd "$PROJECT_DIR"

# Load DATABASE_URL from .env if not already set.
if [ -z "${DATABASE_URL:-}" ] && [ -f ".env" ]; then
  # shellcheck disable=SC1091
  export "$(grep -E '^(DIRECT_URL|DATABASE_URL)=' .env | tail -n1)"
fi

DB_CONN="${DIRECT_URL:-${DATABASE_URL:-}}"

if [ -z "$DB_CONN" ]; then
  echo "ERROR: No database connection string found." >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
OUTFILE="$BACKUP_DIR/daddy-game-chicken_$TIMESTAMP.sql"

echo "==> Creating backup: $OUTFILE"
pg_dump "$DB_CONN" --no-owner --no-privileges > "$OUTFILE"

# Keep only the 14 most recent backups.
echo "==> Pruning old backups (keeping last 14)"
ls -1t "$BACKUP_DIR"/daddy-game-chicken_*.sql 2>/dev/null | tail -n +15 | xargs -r rm -f

echo "==> Backup complete."
