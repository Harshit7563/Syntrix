# Security checklist

Honest mapping of controls in this repo. **Not** an OWASP/PCI/RBI audit report.

## Access

- [x] JWT access cookie 15m + refresh 7d; refresh hashed in `Session`
- [x] Login 2/min per IP
- [x] Public signup closed unless `ALLOW_PUBLIC_REGISTER=true`
- [x] Standalone OTP disabled in production unless `ALLOW_STANDALONE_OTP=true`
- [x] MFA required at login for staff when `mfaEnabled`; staff without MFA must enroll before other admin APIs
- [ ] Admin URL `/root/7563` is not an access control; add IP allow or SSO
- [x] Roles: `SUPER_ADMIN`, `OPERATIONS`, `ACCOUNTS`, `COMPLIANCE`, `SUPPORT`, `MERCHANT_*`
- [x] `@Perm` + `StaffGuard` on staff routes; merchant routes scoped by `merchantId`

## Money movement

- [x] Amounts are integer paise (`BigInt`); no float money math
- [x] Idempotency-Key on payouts; conflict on same key + different body
- [x] Serializable payout hold before provider call
- [x] Timeout → `UNKNOWN`; no automatic new payout reference
- [x] Production payouts: IP allowlist + HMAC signing unless env opt-out
- [x] API key stored as SHA-256; full secret shown once
- [x] Scoped keys `PAYIN` / `PAYOUT` / `REFUND`
- [x] Ledger postings immutable; balances derived
- [ ] Ledger is **not** a bank balance
- [x] Refunds above ₹500 go to maker-checker (execute on approve)
- [x] Never store card PAN/CVV in this codebase (do not add it)

## Data

- [x] AES-256-GCM for secrets (`ENCRYPTION_KEY`); production refuses missing key
- [x] Beneficiary account numbers encrypted; list shows last4
- [x] KYC files type/size limited; downloads via short-lived URL
- [x] Logs redact keys matching secret/password/apiKey/pan/accountNo
- [x] Request logs do not include bodies
- [x] Merchant desk no longer decrypts stored portal passwords; password shown once on create/reset
- [ ] No malware scanner wired (`MALWARE_SCANNER`)

## Transport / edge

- [x] Helmet on API
- [x] CORS exact origins, no `*`
- [x] nginx TLS, HSTS, `X-Frame-Options DENY`, nosniff
- [x] Public Swagger 404
- [x] Public metrics 404 (this review)
- [x] Webhook URLs must be HTTPS in production; SSRF host block
- [x] Provider HTTP: allowlisted hosts, no redirects, timeout
- [ ] WAF
- [x] Login rate limit uses Redis when `REDIS_URL` is up (in-memory fallback)
- [ ] Redis-backed rate limits for every route (payout velocity still in-process)

## Webhooks

- [x] HMAC `t=,v1=` + timestamp window
- [x] Provider events persisted before ack; duplicate id is a no-op
- [x] Merchant delivery backoff → dead letter → manual replay
- [x] Platform ORVIAN callback is not a merchant webhook URL

## Operations

- [x] Do not commit `.env`
- [x] Do not run `prisma db seed` on production
- [x] Nightly `pg_dump` gzip (not PITR)
- [ ] Restore drill recorded (`scripts/restore-drill.sh` — not executed on live)
- [ ] GitHub Actions running on `main` (needs `workflow` scope)
- [x] Optional `ALERT_WEBHOOK_URL` for dead-letter webhooks / UNKNOWN txns

## Compliance language (required)

Do **not** say the platform is RBI-authorised, NPCI-certified, PCI DSS certified, or a licensed bank. KYC/KYB in the UI is a workflow, not a completed verification by a licensed bureau unless a provider is actually wired. Penny-drop is not implemented.
