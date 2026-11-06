#!/bin/sh
# Nightly logical dump. This is not PITR and not proof the restore was tested.
# BusyBox ash on postgres:alpine — keep quoting simple.
set -eu
DEST="${BACKUP_DIR:-/backups}"
KEEP_DAYS="${BACKUP_KEEP_DAYS:-14}"
mkdir -p "$DEST"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
FILE="$DEST/syntrix-${STAMP}.sql.gz"
NOW="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "{\"ts\":\"$NOW\",\"level\":\"info\",\"msg\":\"backup_start\",\"file\":\"$FILE\"}"
pg_dump -h "${PGHOST:-postgres}" -U "${PGUSER:-syntrix}" "${PGDATABASE:-syntrix}" | gzip > "$FILE"
BYTES="$(wc -c < "$FILE")"
NOW="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "{\"ts\":\"$NOW\",\"level\":\"info\",\"msg\":\"backup_ok\",\"file\":\"$FILE\",\"bytes\":$BYTES}"
find "$DEST" -name 'syntrix-*.sql.gz' -mtime +"$KEEP_DAYS" -delete 2>/dev/null || true
if [ "${BASEBACKUP:-0}" = "1" ]; then
  BASE="$DEST/base-${STAMP}"
  mkdir -p "$BASE"
  pg_basebackup -h "${PGHOST:-postgres}" -U "${PGUSER:-syntrix}" -D "$BASE" -Fp -Xs -P || echo '{"msg":"basebackup_failed"}'
fi
