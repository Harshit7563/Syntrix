# SyntrixAPI — Python SDK

Zero-dependency (stdlib only) Python client for SyntrixAPI: pay-ins, payouts and refunds,
with **Payout Shield** request signing built in.

## Install (local)
```bash
pip install -e sdk/python        # from the repo root
# later, once published:  pip install syntrixapi
```

## Quickstart
```python
from syntrixapi import Syntrix

sx = Syntrix(api_key="key_....sk_sandbox_...",
             signing_secret="signsec_...",          # only for signed payouts (Payout Shield)
             base_url="https://api.your-domain/v1")

payin = sx.payins.create(amount_paise=19900, merchant_ref="order_1001",
                         customer={"name": "Aarav", "email": "a@b.com"}, method="UPI")
print(payin["status"], payin.get("utr"))

payout = sx.payouts.create(amount_paise=50000, merchant_ref="po_5001",
                           beneficiary={"name": "Vendor", "account": "1234567890", "ifsc": "HDFC0000001"})

refund = sx.refunds.create(amount_paise=1000, merchant_ref="rf_1001",
                           paymentRef="order_1001")

status = sx.payouts.get("po_5001")   # after UNKNOWN: check, never blind-retry
```

## Notes
- Amounts are always **integer paise** (₹199 = `19900`).
- Every POST sends an `Idempotency-Key` (auto-UUID if you don't pass one) — retries never double-pay.
- If the key has **Signed payouts** ON (portal → API Keys → Shield), pass `signing_secret`;
  the SDK signs `HMAC_SHA256(secret, "timestamp.rawBody")` automatically.
- Errors raise `SyntrixError` with `.status` and `.message`.

See `examples/quickstart.py` for a runnable demo against the sandbox key.
