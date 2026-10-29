"""SyntrixAPI quickstart — run:  python quickstart.py"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from syntrixapi import Syntrix, SyntrixError

sx = Syntrix(
    api_key=os.getenv("SYNTRIX_API_KEY", "key_demo12345678.sk_sandbox_demo_secret_change_me"),
    signing_secret=os.getenv("SYNTRIX_SIGNING_SECRET"),  # only if Payout Shield signing is ON
    base_url=os.getenv("SYNTRIX_BASE_URL", "http://localhost:3001/v1"),
)

try:
    payin = sx.payins.create(amount_paise=19900, merchant_ref="order_py_1001",
                             customer={"name": "Aarav Sharma", "email": "a@b.com"}, method="UPI")
    print("PAYIN :", payin["status"], payin["merchantRef"], "₹", payin["amountPaise"] / 100)

    payout = sx.payouts.create(amount_paise=1000, merchant_ref="po_py_1001",
                               beneficiary={"name": "Demo Vendor", "account": "1234567890", "ifsc": "HDFC0000001"})
    print("PAYOUT:", payout["status"], payout["merchantRef"], "UTR:", payout.get("utr"))

    status = sx.payouts.get("po_py_1001")   # safe status check — never re-send an UNKNOWN payout
    print("CHECK :", status["status"])
except SyntrixError as e:
    print(f"Error {e.status}: {e.message}")
