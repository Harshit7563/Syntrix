# Production readiness

**Verdict: not production-ready.**  
This document is a review of what `main` actually ships. It is not a certificate, not an RBI/NPCI/PCI attestation, and not permission to treat the internal ledger as bank funds.

Live site https://syntrixapi.in is a **single-VPS Compose stack**. Money movement, if configured, goes only through the approved partner adapter (currently ORVIAN). Successful QR or a callback is not treated as success without provider status / recon.

Reviewed against git `main` after Phase 4 (metrics, JSON logs, `pg_dump` job). Local uncommitted WIP is out of scope.

## Gate

| Area | Result | Evidence |
|---|---|---|
| Secrets fail-closed | Pass (code) | `assertProductionSecrets()` refuses weak `JWT_ACCESS_SECRET`, `ENCRYPTION_KEY`, `COOKIE_SECRET` when `NODE_ENV=production` |
| TLS on public vhost | Pass (config) | nginx 80→443, TLS 1.2/1.3, HSTS |
| Swagger on public internet | Pass (config) | `/api/docs` returns 404 |
| Public `/metrics` | Pass after this review | nginx `= /metrics` and `= /api/metrics` return 404; scrape `api:3001` on Docker network only |
| Auth cookies | Pass | HttpOnly, SameSite=Lax, path `/` |
| Login rate limit | Pass | 2 attempts / minute / IP (and email when present) |
| Empty admin login | Pass | Phase 2 removed empty `POST /auth/login` |
| MFA on privileged login | **Fail** | TOTP setup exists; login does not require TOTP even if `mfaEnabled` |
| Staff password display | **Fail (accepted product choice)** | Merchant desk decrypts `loginPasswordEnc` for operators |
| GitHub Actions on `main` | **Fail** | Recipe is `docs/github-ci.yml`; token lacked `workflow` scope |
| HA / multi-AZ | **Fail** | One VPS, one Postgres volume |
| PITR + restore drill | **Fail** | Nightly gzip dump only; restore untested |
| Central logs / alerts | **Fail** | JSON stdout; no shipper, no paging |
| Penetration test | **Fail** | None recorded |
| Load test of live money paths | **Fail** | Do not run against production ORVIAN |
| Card data / PCI DSS | Out of scope | Platform does not take PAN/CVV; do not claim PCI DSS |
| RBI / NPCI / bank licence | Out of scope | Partner agreements only; no licence claimed here |

A row of **Fail** means this repo must not be described as production-ready.

## Must-fix before calling it production

1. Enforce MFA (or equivalent) on `SUPER_ADMIN` / staff login.
2. Stop storing reversible merchant portal passwords, or encrypt with a staff-only unwrap key and audit every reveal.
3. Enable CI on GitHub (`workflow` scope) and keep `prisma db seed` off production.
4. Move Postgres to a managed instance with PITR; run and record a restore drill.
5. Restrict `/root/7563` by IP or SSO at nginx, not secrecy of the path.
6. Independent security review of payout shield, webhooks, and tenant isolation.
7. Written partner/settlement contracts matching live ORVIAN behaviour.

## What is already in place (not a pass on the gate)

- Integer paise, double-entry ledger, idempotency, UNKNOWN payouts not blindly retried
- API key hashing, payout IP allowlist + signing, HMAC merchant webhooks
- Tenant-scoped merchant queries, RBAC permissions
- Provider credentials encrypted at rest
- Worker outbox + webhook retry/DLQ
- Health `/health` and `/health/ready`
- Backup container (logical dump)

## How to operate today

Treat the VPS as a **controlled live lab**: real partner traffic only with keys on the server `.env`, never in git. Do not seed production. Do not claim certification. See `docs/SECURITY_CHECKLIST.md` and `docs/BACKUP_RECOVERY.md`.
