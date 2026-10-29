# Backup & Recovery
- **Postgres (source of truth)**: nightly `pg_dump` + WAL/PITR on managed PG; test restores quarterly. Example: `docker compose exec postgres pg_dump -U syntrix syntrix > backup.sql` / restore with `psql`.
- **Redis**: AOF enabled; treat as disposable — on loss, workers resume from the Postgres outbox and pending webhook deliveries in Postgres.
- **Object storage**: enable bucket versioning + cross-region replication for KYC documents.
- **Recovery drill**: restore DB → run `prisma migrate deploy` → start worker first (drains outbox) → start API → run a reconciliation run and confirm ledger balances (`sum(debit)=sum(credit)` per ledger transaction).
- Retain audit logs ≥ 5 years (or per your compliance policy); KYC documents per regulatory retention; export invoices monthly.
