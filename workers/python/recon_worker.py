#!/usr/bin/env python3
"""
SyntrixAPI — Python Reconciliation & Daily Report Worker (zero dependencies)

Kya karta hai:
  1. Atke hue (UNKNOWN / PROCESSING / PENDING) purane transactions ka SAFE status-check
     karta hai — dobara payout KABHI create nahi karta, sirf provider se status puchta hai.
  2. Fraud-watch: bade payouts aur achanak bahut saare payouts ko flag karta hai.
  3. Roz ki report banata hai: summary (.txt + .json) aur saari transactions ki CSV
     (Excel mein khulti hai) — workers/python/reports/ folder mein.

Chalana:
  python3 recon_worker.py            # ek baar chalao
  python3 recon_worker.py --loop 300 # har 5 minute mein auto (server par aise hi chalega)

Config (env): SYNTRIX_BASE_URL (default http://localhost:3001),
  PORTAL_EMAIL / PORTAL_PASSWORD (default demo), STALE_MINUTES (default 2), REPORT_DIR
"""
import csv, json, os, sys, time, urllib.request, urllib.error, http.cookiejar
from datetime import datetime, timezone

BASE = os.getenv("SYNTRIX_BASE_URL", "http://localhost:3001").rstrip("/")
EMAIL = os.getenv("PORTAL_EMAIL", "merchant@demo.local")
PASSWORD = os.getenv("PORTAL_PASSWORD", "Demo@12345")
STALE_MIN = int(os.getenv("STALE_MINUTES", "2"))
REPORT_DIR = os.getenv("REPORT_DIR", os.path.join(os.path.dirname(__file__), "reports"))
BIG_PAYOUT_PAISE = int(os.getenv("BIG_PAYOUT_PAISE", str(50000 * 100)))   # ₹50,000+
BURST_COUNT = int(os.getenv("BURST_COUNT", "10"))                          # 1 ghante mein itne payout = flag

cj = http.cookiejar.CookieJar()
op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))

def call(method, path, body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(BASE + path, data=data, method=method,
                                 headers={"content-type": "application/json"})
    try:
        with op.open(req, timeout=30) as r:
            return json.loads(r.read() or b"{}")
    except urllib.error.HTTPError as e:
        try: msg = json.loads(e.read() or b"{}").get("message", e.reason)
        except Exception: msg = e.reason
        raise RuntimeError(f"{method} {path} -> {e.code}: {msg}")

def age_minutes(iso):
    try:
        t = datetime.fromisoformat(iso.replace("Z", "+00:00"))
        return (datetime.now(timezone.utc) - t).total_seconds() / 60
    except Exception:
        return 0

def run_once():
    print(f"[{datetime.now():%H:%M:%S}] Reconciliation start — {BASE}")
    call("POST", "/auth/login", {"email": EMAIL, "password": PASSWORD})
    txns = call("GET", "/merchant/transactions")
    stuck = [t for t in txns if t["status"] in ("UNKNOWN", "PROCESSING", "PENDING")
             and age_minutes(t["createdAt"]) >= STALE_MIN]
    print(f"  Kul transactions: {len(txns)} · atke hue (>{STALE_MIN} min): {len(stuck)}")

    resolved, still = 0, 0
    for t in stuck:
        r = call("POST", f"/merchant/transactions/{t['id']}/check-status", {})
        if r.get("status") in ("SUCCESS", "FAILED", "REFUNDED"):
            resolved += 1
            print(f"  ✓ SULJHA {t['merchantRef']} ({t['kind']} ₹{t['amountPaise']/100:,.2f}) -> {r['status']}")
        else:
            still += 1
            print(f"  … abhi bhi {r.get('status','?')} {t['merchantRef']} — paisa hold par hai, dobara payout NAHI bheja")

    if stuck: txns = call("GET", "/merchant/transactions")  # report hamesha resolution ke BAAD ke status se bane
    # ---- fraud watch (simple rules; ML baad mein jod sakte ho) ----
    alerts = []
    payouts = [t for t in txns if t["kind"] == "PAYOUT"]
    for t in payouts:
        if t["amountPaise"] >= BIG_PAYOUT_PAISE and t["status"] == "SUCCESS":
            alerts.append(f"BADA PAYOUT ₹{t['amountPaise']/100:,.2f} -> {t['merchantRef']} ({(t.get('customer') or {}).get('name','?')})")
    recent = [t for t in payouts if age_minutes(t["createdAt"]) <= 60]
    if len(recent) >= BURST_COUNT:
        alerts.append(f"BURST: pichhle 1 ghante mein {len(recent)} payouts — normal se zyada, check karo")
    for a in alerts: print(f"  ⚠ FRAUD-WATCH: {a}")

    # ---- daily report ----
    today = datetime.now().strftime("%Y-%m-%d")
    succ = [t for t in txns if t["status"] == "SUCCESS"]
    summary = {
        "date": today, "generatedAt": datetime.now().isoformat(timespec="seconds"),
        "totalTransactions": len(txns),
        "success": len(succ),
        "failed": sum(1 for t in txns if t["status"] == "FAILED"),
        "stuckResolved": resolved, "stuckRemaining": still,
        "payinSuccessPaise": sum(t["amountPaise"] for t in succ if t["kind"] == "PAYIN"),
        "payoutSuccessPaise": sum(t["amountPaise"] for t in succ if t["kind"] == "PAYOUT"),
        "feesPaise": sum(t.get("feePaise", 0) for t in succ),
        "alerts": alerts,
    }
    os.makedirs(REPORT_DIR, exist_ok=True)
    with open(os.path.join(REPORT_DIR, f"summary-{today}.json"), "w") as f:
        json.dump(summary, f, indent=2, ensure_ascii=False)
    with open(os.path.join(REPORT_DIR, f"transactions-{today}.csv"), "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["Date", "Type", "Status", "Merchant Ref", "Payment ID", "API", "Customer", "Amount (₹)", "Fee (₹)", "UTR"])
        for t in txns:
            w.writerow([t["createdAt"], t["kind"], t["status"], t["merchantRef"], t["id"],
                        t.get("apiName", ""), (t.get("customer") or {}).get("name", ""),
                        t["amountPaise"] / 100, t.get("feePaise", 0) / 100, t.get("utr") or ""])
    print(f"  Report ban gayi: reports/summary-{today}.json + transactions-{today}.csv")
    print(f"  Aaj: Pay-in ₹{summary['payinSuccessPaise']/100:,.2f} · Payout ₹{summary['payoutSuccessPaise']/100:,.2f} · Fees ₹{summary['feesPaise']/100:,.2f}")
    return summary

if __name__ == "__main__":
    if "--loop" in sys.argv:
        interval = int(sys.argv[sys.argv.index("--loop") + 1])
        print(f"Loop mode: har {interval}s mein chalega. Rokne ke liye Ctrl+C")
        while True:
            try: run_once()
            except Exception as e: print("  Worker error:", e)
            time.sleep(interval)
    else:
        run_once()
