# Deployment model

Single-owner VPS plus optional merchants. Owner integrates partner APIs; merchants get Syntrix keys, not ORVIAN secrets.

# Implemented on `main`

Auth cookies, RBAC, merchant desk (Member ID + password), API keys + payout shield, ORVIAN adapter, integer-paise ledger, webhooks, recon, T+N settlement batches, beneficiaries, JSON logs, `/metrics`, nightly `pg_dump`.

# Still not production-ready

See `docs/PRODUCTION_READINESS.md`. Highlights: MFA not enforced at login, single host, untested restore, no pentest, no RBI/PCI claims, GitHub Actions not installed on the repo, reversible merchant passwords on the desk.

# Do not do

- Seed production
- Commit partner keys
- Mark pay-in success from QR generate or an unverified callback
- Retry an UNKNOWN payout with a new reference
- Call the internal ledger “bank balance”
