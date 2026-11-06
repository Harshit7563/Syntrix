# Security review (defensive)

**This is not a penetration test.** No exploits were run against https://syntrixapi.in or any other host. A real pentest needs a scoped third party, written authorization, and a test environment.

Date: 2026-11-06. Scope: `main` source review + `npm audit` where run.

## Findings (source)

| ID | Severity | Finding | Status |
|---|---|---|---|
| S1 | High | Staff login did not require TOTP even when `mfaEnabled` | Fixed on this branch: TOTP required when MFA is on; staff without MFA must enroll before other admin APIs |
| S2 | High | Merchant portal passwords stored reversible for the desk | Open — product choice |
| S3 | Medium | `/root/7563` secrecy is not access control | Open — add IP allow/SSO |
| S4 | Medium | Login rate limit is in-process (per instance) | Open |
| S5 | Low | GitHub Actions workflow committed; remote may still reject without `workflow` scope | `.github/workflows/ci.yml` |
| S6 | Info | Public `/metrics` blocked at nginx | Already 404 |

## Not done

- Authenticated or unauthenticated attack against production
- Load test of payouts
- Social engineering
- Claiming PCI/RBI/NPCI certification

## PITR

WAL archiving is configured in Compose. A restore drill has **not** been executed. See `scripts/pitr.md`.
