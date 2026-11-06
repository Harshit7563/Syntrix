# Backup & Recovery

## Compose job (this repo)

`docker compose up` starts a `backup` container. Every `BACKUP_INTERVAL_SEC` (default 86400) it runs `scripts/pg-backup.sh`:

- `pg_dump | gzip` into volume `pgbackups` as `syntrix-YYYYMMDDTHHMMSSZ.sql.gz`
- deletes dumps older than `BACKUP_KEEP_DAYS` (default 14)

This is a **logical dump on one VPS**. WAL archiving is on (`pgwal` volume) but a restore drill is **not** proven until you run `scripts/restore-drill.sh` against a copy. Treat dumps as last-resort, not proof of recoverability. Set `BASEBACKUP=1` on the backup service to also take `pg_basebackup`.

List dumps:

```
docker compose exec backup ls -lh /backups
```

Restore (destructive — confirm the target database first):

```
gunzip -c syntrix-TIMESTAMP.sql.gz | docker compose exec -T postgres psql -U syntrix -d syntrix
```

Then `prisma migrate deploy`, start worker, start API, run reconciliation. Confirm ledger `sum(debit)=sum(credit)` per ledger transaction.

## Managed Postgres (target)

Nightly snapshots + PITR on RDS/Cloud SQL. Test restores quarterly.

## Redis

AOF is enabled. Treat Redis as disposable — workers resume from the Postgres outbox and pending webhook deliveries.

## Object storage

Enable bucket versioning for KYC documents.

## Retention

Audit logs ≥ 5 years (or your policy); KYC per regulation; export invoices monthly.
