# PITR on this VPS (Compose)

Postgres is started with `wal_level=replica`, `archive_mode=on`, and WAL files copied to volume `pgwal`.

This is **not** managed-cloud PITR. It has not been proven by a restore drill on production. Logical dumps (`backup` service) remain the practical recovery path until a restore is tested.

## Archive

WAL segments land in the `pgwal` volume (`/wal` in the postgres container).

```
docker compose exec postgres ls /wal | tail
```

## Restore outline (destructive)

1. Stop api, worker, backup.
2. Keep a copy of `pgdata` and `pgwal`.
3. Restore a base backup (or the latest `pg_dump` if you do not have a base backup — dump restore is not PITR).
4. True PITR needs a **base backup** taken with `pg_basebackup` plus the WAL archive. Example (offline):

```
docker compose exec postgres pg_basebackup -U syntrix -D /tmp/base -Ft -z
```

Store that tarball off-box. To recover to a time, restore the base, then replay `/wal` with `recovery.signal` and `restore_command`.

Until a restore is recorded, treat this as **configuration only**.
