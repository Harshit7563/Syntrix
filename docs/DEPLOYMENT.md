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

## Migrations / env
See `.env.example`. Commands: `npm run db:generate|db:migrate|db:seed -w @syntrix/api` (prod: `db:deploy`).
