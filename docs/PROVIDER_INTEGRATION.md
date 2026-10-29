# Integrating a real upstream provider — READ FIRST
**No provider can be integrated “without code”, and none may be resold without authorization.**

## Legal / commercial prerequisites (before any code goes live)
1. A signed **reseller / marketplace / aggregator agreement** with the provider that explicitly permits offering its APIs to your merchants. Many providers prohibit resale without this.
2. The provider's **merchant onboarding requirements**: who performs KYC (you, provider, or both), whether sub-merchant registration is required, prohibited categories, settlement account rules, refund/payout permissions, and webhook/IP-whitelisting requirements.
3. Confirmed pricing, limits, T+ settlement, and liability for chargebacks/fraud. Record these in Admin → Providers/Pricing.

## Technical steps
1. Implement `ProviderAdapter` (see `apps/api/src/modules/providers.ts`): `createPayin, getPayinStatus, createPayout, getPayoutStatus, createRefund, getRefundStatus, verifyWebhook, normalizeWebhook`. `HttpProviderAdapter` is a skeleton: HTTPS + approved hosts only (`PROVIDER_ALLOWED_HOSTS`), no redirects, hard timeout.
2. Register the provider in Admin (credentials are encrypted at rest; they are **never** sent to merchants/frontend).
3. Add `provider_capabilities` rows only for operations the provider truly supports; routing rules + merchant pricing; enable per-merchant product access.
4. Map the provider's webhook signature scheme in `verifyWebhook`, reuse its event id for replay protection, and test duplicate/out-of-order delivery.
5. Sandbox-test with the provider's test credentials, run reconciliation, then enable sandbox for merchants. Production enablement is a separate, explicit approval.
6. Timeouts must map to `UNKNOWN`, never `FAILED`; payouts resolve by status check only.
