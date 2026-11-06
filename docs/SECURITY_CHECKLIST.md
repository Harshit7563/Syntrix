# Security checklist

Honest mapping of controls in this repo. **Not** an OWASP/PCI/RBI audit report.

## Access

- [x] JWT access cookie 15m + refresh 7d; refresh hashed in `Session`
- [x] Login 2/min per IP
- [x] Public signup closed unless `ALLOW_PUBLIC_REGISTER=true`
- [x] Standalone OTP disabled in production unless `ALLOW_STANDALONE_OTP=true`
- [ ] MFA required at login for staff (setup/verify exist; login path skips TOTP)
- [ ] Admin URL `/root/7563` is not an access control; add IP allow or SSO
- [x] Roles: `SUPER_ADMIN`, `OPERATIONS`, `ACCOUNTS`, `COMPLIANCE`, `MERCHANT_*`
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
- [ ] Reversible merchant login passwords for the desk — product choice, high risk if staff accounts leak
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
- [ ] Redis-backed rate limits for all routes (login + payout velocity are in-process)

## Webhooks

- [x] HMAC `t=,v1=` + timestamp window
- [x] Provider events persisted before ack; duplicate id is a no-op
- [x] Merchant delivery backoff → dead letter → manual replay
- [x] Platform ORVIAN callback is not a merchant webhook URL

## Operations

- [x] Do not commit `.env`
- [x] Do not run `prisma db seed` on production
- [x] Nightly `pg_dump` gzip (not PITR)
- [ ] Restore drill recorded
- [ ] GitHub Actions running on `main`
- [ ] Pager for dead-letter webhooks / UNKNOWN payouts

## Compliance language (required)

Do **not** say the platform is RBI-authorised, NPCI-certified, PCI DSS certified, or a licensed bank. KYC/KYB in the UI is a workflow, not a completed verification by a licensed bureau unless a provider is actually wired. Penny-drop is not implemented.
