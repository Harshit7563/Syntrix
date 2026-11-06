# Deployment
## Starter: Docker Compose on one VPS
`docker compose up --build` runs Postgres, Redis, MinIO, API, worker, web (Nginx). This is a **starter deployment only — a single host is a single point of failure and provides no high availability.**

## Production topology (target)
- 2+ stateless API instances (same image, `PROCESS_ROLE` split for workers) behind a load balancer (ALB/NLB or Nginx/HAProxy) with health checks on `/health`.
- Managed PostgreSQL (e.g. RDS/Cloud SQL) with automated failover, PITR backups, and a read replica for reporting; run `prisma migrate deploy` as a one-off job before rollout.
- Resilient Redis (managed, AOF + replica) — remember Redis is acceleration only; the Postgres outbox is durable.
- Private S3 bucket with versioning + SSE, presigned 5-minute downloads; malware scanning (ClamAV or provider) wired via `MALWARE_SCANNER`.
- Secrets in a KMS/secrets manager; separate sandbox and production databases, keys, and provider credentials. Restrict `/docs` and admin routes by SSO/IP at the LB. TLS everywhere, WAF + rate limits.
- Graceful shutdown: API/worker handle SIGTERM; drain LB before deploy.
- Logs: API writes one JSON line per request (`ts`, `level`, `method`, `route`, `status`, `ms`, `requestId`). Secrets are redacted. Do not ship request bodies.
- Metrics: scrape `http://api:3001/metrics` on the Docker network. Nginx does not publish `/metrics` on the public site. Optional token: `METRICS_TOKEN` + header `x-metrics-token`.
- Prometheus/Grafana (loopback only): `docker compose -f docker-compose.yml -f docker-compose.observability.yml up -d prometheus grafana`
- Postgres dumps: `backup` service in the main compose file (see `docs/BACKUP_RECOVERY.md`).

## Migrations / env
See `.env.example`. Commands: `npm run db:generate|db:migrate|db:seed -w @syntrix/api` (prod: `db:deploy`). Never seed production.

Readiness: `docs/PRODUCTION_READINESS.md` (current verdict: **not production-ready**). Security: `docs/SECURITY_CHECKLIST.md`.
