# SyntrixAPI — Merchant Onboarding & API Provider Platform

Original platform (design inspired by clean fintech onboarding UX; no third-party branding copied). **Mock mode by default — no real money moves, no real provider is called.**

## Quick start (Docker)
```bash
cp .env.example .env
docker compose up --build
# Web http://localhost:8080 · API http://localhost:3001 · Swagger http://localhost:3001/docs · MinIO console :9001
# In another terminal (first run): seed demo data
docker compose exec api npx ts-node prisma/seed.ts   # or locally: npm run db:seed -w @syntrix/api
```
## Quick start (local dev, needs Postgres + Redis running)
```bash
npm install
cp .env.example apps/api/.env
npm run db:generate -w @syntrix/api && npm run db:migrate -w @syntrix/api && npm run db:seed -w @syntrix/api
npm run build -w @syntrix/shared
npm run dev -w @syntrix/api   # :3001
npm run dev -w @syntrix/web   # :5173
node apps/api/dist/worker.js  # after build — or PROCESS_ROLE=worker via compose
```
**Seeded logins** (password `Demo@12345`): `admin@syntrix.local` (Super Admin), `compliance@`, `ops@`, `accounts@syntrix.local`, `merchant@demo.local` (approved merchant), `beta@demo.local` (under review). Demo sandbox API key: `key_demo12345678.sk_sandbox_demo_secret_change_me`.

## Demo flow
1. Login as merchant → finish **Onboarding** (draft auto-progress, upload KYC doc — it stays *unverified*) → Submit.
2. Login as compliance → **Merchants & Review** → verify documents, Approve (+production separately).
3. Merchant → **API Credentials** (secret shown once) → **Playground** → create a mock pay-in → balance credits collections (fee deducted in ledger).
4. Transfer collections → payout balance → create payout. Try a `timeout@` customer/payout ref → status `UNKNOWN` (never auto-retried) → Admin **Reconciliation** resolves it by status check.
5. Configure a merchant webhook → deliveries are HMAC-signed, retried with backoff, replayable from dead-letter.

## Architecture
Modular monolith: NestJS API + separate worker process, React SPA, PostgreSQL (Prisma, source of truth), Redis/BullMQ (acceleration only — durable PG outbox survives Redis loss), S3-compatible private KYC storage (MinIO locally), Nginx. See `docs/ARCHITECTURE.md`, `docs/PROVIDER_INTEGRATION.md`, `docs/DEPLOYMENT.md`, `docs/BACKUP_RECOVERY.md`, `docs/FEATURES_AND_GAPS.md`.

## Tests
```bash
npm test -w @syntrix/api   # tenant/idempotency/state-machine/ledger/SSRF/HMAC/outbox invariants
```
