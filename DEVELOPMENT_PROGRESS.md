# SYNTRIXAPI — development progress

Live site: https://syntrixapi.in  
Repo is an existing **modular monolith**, not a greenfield demo. This file tracks the enterprise spec against what already runs. Money movement is only through configured providers (currently **ORVIAN**). Ledger balances are internal books, not bank proof.

## Architecture (current)

```
apps/web     React + Vite + Tailwind + TanStack Query (admin + merchant SPA)
apps/api     NestJS + Prisma + PostgreSQL 16 + Redis 7
apps/mobile  optional (uncommitted / incomplete)
packages/shared  roles, permissions, canonical types (paise)
workers/python   recon helper
nginx        TLS reverse proxy, SPA try_files, /api → Nest
docker compose   postgres, redis, api, worker, web
```

**Money path:** merchant `X-Api-Key` → `/api/v1/payins|payouts|refunds` → routing rules → `ProviderAdapter` (ORVIAN / mock / generic HTTP) → integer-paise double-entry ledger → outbox → merchant webhooks (HMAC).  
**Admin path:** `/root/7563` (email + password).  
**Merchant path:** `/app/merchants/login` (Member ID + password).

Do not rewrite this into microservices, shadcn, or Zustand in one pass. Preserve live ORVIAN, cookies, and merchant-desk.

## Role map (do not rename live enums yet)

| Spec name | Live `Role` |
|---|---|
| Super Admin | `SUPER_ADMIN` |
| Operations Admin | `OPERATIONS` |
| Finance Admin | `ACCOUNTS` |
| Compliance Officer | `COMPLIANCE` |
| Support Executive | *missing* — do not invent until a Support module exists |
| Merchant Admin | `MERCHANT_OWNER` |
| Merchant Developer | `MERCHANT_DEVELOPER` |
| Merchant Viewer | `MERCHANT_VIEWER` |

Permissions live in `packages/shared`. Staff APIs use `AuthGuard` + `StaffGuard` + `@Perm`. Merchant APIs are tenant-scoped with `assertTenant`.

## What already works

- Docker Compose, health `/health` + `/health/ready`, nginx, Prisma migrations
- Auth cookies (`sx_access` / `sx_refresh`); MFA setup exists, login does not require TOTP
- Merchant desk: add merchant, auto Member ID + password, status toggle, edit popup
- Merchant login, API keys, IP allowlist, payout shield, signing secrets
- Pay-in / payout / refund v1, idempotency, UNKNOWN-safe payouts, circuit breaker
- ORVIAN adapter + inbound `POST /api/webhooks/provider/ORVIAN`
- Merchant outbound webhooks (HMAC, backoff, DLQ, replay)
- Ledger (immutable postings, paise BigInt)
- Admin dashboard, transactions, APIs page, recon, audit, reports
- Jest specs under `apps/api` (`payments.logic`, providers, orvian, bawji)

## Gaps vs enterprise spec (ordered)

1. MFA not required at staff login; `/root/7563` is not IP-restricted
2. GitHub Actions not installed (`docs/github-ci.yml` only)
3. Support role, shadcn/Zustand rewrite — not started
4. Refresh-token WIP in the working tree — do not ship wholesale
5. Single VPS; dump backups untested; no pentest
6. Dirty local WIP (seed, guards, payments, mobile) must not be committed wholesale

## Phases

| Phase | Goal | Status |
|---|---|---|
| 1 | Assess repo, document architecture, CI, merchant portal links | **done** |
| 2 | Lock admin login, Member ID backfill, webhook+IP onboarding copy | **done** |
| 3 | Settlement/recon product polish, beneficiary registry, maker-checker | **done** |
| 4 | Observability (metrics, structured log pipeline, backup job) | **done** |
| 5 | Frontend design-system pass (only if product asks) | **skipped** |
| 6 | Production-readiness review (no certification claims) | **done — not production-ready** |

## Phase 6 this increment

- [x] `docs/PRODUCTION_READINESS.md` — verdict **not production-ready**
- [x] `docs/SECURITY_CHECKLIST.md` — controls vs gaps, no certification claims
- [x] nginx: public `/metrics` and `/api/metrics` return 404
- [x] Phase 5 shadcn pass skipped (not requested)
- [ ] MFA-at-login, managed Postgres PITR, GitHub Actions, pentest — still open

## Phase 4 this increment

- [x] JSON request logs (`HttpLogInterceptor`) with redaction and `x-request-id`
- [x] Prometheus text at `GET /metrics` (not on the public nginx vhost)
- [x] Nightly `pg_dump` job (`backup` service + `scripts/pg-backup.sh`)
- [x] Optional Grafana/Prometheus overlay `docker-compose.observability.yml` (127.0.0.1 only)
- [ ] Central log shipper (Loki/ELK) — not in this phase
- [ ] PITR / tested restore drill — still a runbook, not evidence

## Phase 3 this increment

- [x] Beneficiary registry (`/merchant/beneficiaries`, `/api/v1/beneficiaries`) — encrypted account, last4, no fake penny-drop
- [x] Payouts accept `beneficiaryId`
- [x] T+0…T+3 settlement batches: collections → payout wallet after calendar delay, capped by wallet hold
- [x] Maker-checker execute for refunds above ₹500 (`POST /admin/approvals/:id/decide`)
- [x] Settlement maker-checker (Super Admin may post own batch on a solo desk)
- [x] Recon UI shows REVIEW exceptions
- [ ] Automated bank-statement import — not in this phase
- [ ] Penny-drop verification — not implemented (must not be claimed)

## Phase 2 this increment

- [x] `/root/7563` requires admin email + password (empty POST login removed)
- [x] Staff logout returns to `/root/7563`
- [x] Issue Member ID + password for old merchants (`POST /merchant-desk/:id/issue-login` and bulk `issue-missing-logins`)
- [x] Merchant desk handoff: login URL, API base, IP allowlist, merchant webhook vs ORVIAN callback
- [ ] MFA still not required on login (left skipped until asked)
- [ ] Refresh-token WIP still uncommitted

## Phase 1 this increment

- [x] Repository assessment (this file)
- [x] Map spec to live modules (see `docs/ARCHITECTURE.md`)
- [x] CI recipe: `docs/github-ci.yml` (copy to `.github/workflows/ci.yml` when the GitHub token has `workflow` scope)
- [x] Merchant sidebar: Keys, Webhooks, Docs
- [ ] Full shadcn rebuild — **out of scope**
- [x] Prometheus/Grafana overlay — Phase 4 (optional compose file)
- [ ] New Support role — later

## Tests

Run locally: `npm test` (API Jest). CI must not run `prisma db seed` on production.

## Known limitations

- Admin URL `/root/7563` now requires email + password (2 attempts/min). MFA is still skipped.
- Old merchants without Member ID: use **Issue IDs for old merchants** or Edit → Issue. New password cannot recover a lost bcrypt hash — it mints a new one.
- Pay-in/payout API requires portal `memberId` (cuid), not Member ID `M######`.
- ORVIAN webhook is platform-owned; merchant webhook URL is separate.
- Uncommitted WIP in the working tree is not part of `main`.
