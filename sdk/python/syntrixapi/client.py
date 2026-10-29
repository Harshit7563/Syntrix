"""SyntrixAPI Python SDK — zero dependencies (stdlib only).

Usage:
    from syntrixapi import Syntrix
    sx = Syntrix(api_key="key_....sk_sandbox_...",
                 signing_secret="signsec_...",          # only needed for signed payouts
                 base_url="http://localhost:3001/v1")   # production: https://api.your-domain/v1

    payin  = sx.payins.create(amount_paise=19900, merchant_ref="order_1001",
                              customer={"name": "Aarav", "email": "a@b.com"}, method="UPI")
    payout = sx.payouts.create(amount_paise=50000, merchant_ref="po_5001",
                               beneficiary={"name": "Vendor", "account": "1234567890", "ifsc": "HDFC0000001"})
"""
import hashlib
import hmac
import json
import time
import urllib.request
import urllib.error
import uuid


class SyntrixError(Exception):
    """Raised for any non-2xx response. `.status` is the HTTP code, `.message` the server message."""
    def __init__(self, status, message):
        super().__init__(f"[{status}] {message}")
        self.status = status
        self.message = message


class _Resource:
    def __init__(self, client, name):
        self._c = client
        self._name = name

    def create(self, amount_paise, merchant_ref, idempotency_key=None, **fields):
        body = {"merchantRef": merchant_ref, "amountPaise": int(amount_paise), **fields}
        return self._c._post(f"/{self._name}", body, idempotency_key, sign=(self._name == "payouts"))

    def get(self, ref):
        """Fetch one transaction by merchantRef (use after UNKNOWN — never blind-retry a payout)."""
        return self._c._get(f"/{self._name}/{ref}")


class Syntrix:
    def __init__(self, api_key, signing_secret=None, base_url="http://localhost:3001/v1", timeout=30):
        if "." not in api_key:
            raise ValueError("api_key must look like '<keyId>.<secret>'")
        self.api_key = api_key
        self.signing_secret = signing_secret
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self.payins = _Resource(self, "payins")
        self.payouts = _Resource(self, "payouts")
        self.refunds = _Resource(self, "refunds")

    # ---- internals -----------------------------------------------------
    def _request(self, method, path, raw=None, headers=None):
        req = urllib.request.Request(self.base_url + path, data=raw, method=method,
                                     headers={"X-Api-Key": self.api_key, "content-type": "application/json", **(headers or {})})
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as r:
                return json.loads(r.read() or b"{}")
        except urllib.error.HTTPError as e:
            try:
                msg = json.loads(e.read() or b"{}").get("message", e.reason)
            except Exception:
                msg = e.reason
            raise SyntrixError(e.code, msg) from None
        except urllib.error.URLError as e:
            raise SyntrixError(0, f"Cannot reach SyntrixAPI: {e.reason}") from None

    def _post(self, path, body, idempotency_key=None, sign=False):
        raw = json.dumps(body, separators=(",", ":")).encode()
        headers = {"Idempotency-Key": idempotency_key or str(uuid.uuid4())}
        if sign and self.signing_secret:
            # Payout Shield: HMAC over `${timestamp}.${rawBody}` — a leaked API key alone cannot pay out.
            ts = str(int(time.time()))
            headers["x-syntrix-timestamp"] = ts
            headers["x-syntrix-signature"] = hmac.new(
                self.signing_secret.encode(), f"{ts}.".encode() + raw, hashlib.sha256).hexdigest()
        return self._request("POST", path, raw, headers)

    def _get(self, path):
        return self._request("GET", path)


__all__ = ["Syntrix", "SyntrixError"]
