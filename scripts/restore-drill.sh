#!/bin/sh
# Restore drill outline. Destructive. Do not run against live syntrix without a snapshot.
# This script prints the steps and exits unless CONFIRM_RESTORE_DRILL=YES.
set -eu
echo "PITR/dump restore drill is not proven until you run it on a copy of the data."
echo "1. docker compose exec backup ls -lh /backups"
echo "2. Copy the latest syntrix-*.sql.gz off-box"
echo "3. Restore into a NEW database/container, never the live volume first"
echo "4. gunzip -c FILE.sql.gz | docker compose exec -T postgres psql -U syntrix -d syntrix"
echo "5. npx prisma migrate deploy --schema apps/api/prisma/schema.prisma"
echo "6. Check ledger: sum(debit)=sum(credit) per ledgerTxnId"
echo "WAL files live in volume pgwal. True PITR still needs pg_basebackup + recovery.signal — see scripts/pitr.md"
if [ "${CONFIRM_RESTORE_DRILL:-}" != "YES" ]; then
  echo "Refusing to mutate data (CONFIRM_RESTORE_DRILL!=YES)."
  exit 0
fi
echo "CONFIRM set — this script still will not drop live data automatically."
exit 0
