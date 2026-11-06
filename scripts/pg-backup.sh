#!/bin/sh
# Nightly logical dump. This is not PITR and not proof the restore was tested.
set -eu
DEST="${BACKUP_DIR:-/backups}"
KEEP_DAYS="${BACKUP_KEEP_DAYS:-14}"
mkdir -p "$DEST"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
FILE="$DEST/syntrix-${STAMP}.sql.gz"
echo "{\"ts\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",\"level\":\"info\",\"msg\":\"backup_start\",\"file\":\"$FILE\"}"
pg_dump -h "${PGHOST:-postgres}" -U "${PGUSER:-syntrix}" "${PGDATABASE:-syntrix}" | gzip > "$FILE"
echo "{\"ts\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",\"level\":\"info\",\"msg\":\"backup_ok\",\"file\":\"$FILE\",\"bytes\":$(wc -c < "$FILE\")}"
find "$DEST" -name 'syntrix-*.sql.gz' -mtime +"$KEEP_DAYS" -delete 2>/dev/null || true
