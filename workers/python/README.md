# SyntrixAPI — Python Reconciliation & Report Worker

Zero-dependency Python worker (stdlib only, Python 3.9+). Node backend ko chhede bina chalta hai —
portal API se baat karta hai.

## Kya karta hai
1. **Atke hue transactions suljhata hai** — UNKNOWN / PROCESSING / PENDING jo `STALE_MINUTES` se
   purane hain, unka sirf *status-check* karta hai. **Dobara payout kabhi create nahi karta**
   (wahi suraksha niyam jo backend mein hai), isliye double-payment ka risk zero.
2. **Fraud-watch (rule-based)** — ₹50,000+ ke payouts aur 1 ghante mein bahut saare payouts flag karta hai.
   Baad mein yahin pandas/scikit-learn se ML model jod sakte ho.
3. **Roz ki report** — `reports/summary-YYYY-MM-DD.json` (machine ke liye) +
   `reports/transactions-YYYY-MM-DD.csv` (Excel mein khulti hai, accounts team ke liye).

## Chalana
```bash
python3 recon_worker.py              # ek baar
python3 recon_worker.py --loop 300   # har 5 minute (server par background mein aise chalega)
```

## Config (environment variables)
| Var | Default | Matlab |
|---|---|---|
| `SYNTRIX_BASE_URL` | `http://localhost:3001` | API kahan hai |
| `PORTAL_EMAIL` / `PORTAL_PASSWORD` | demo login | Worker kis account se login kare |
| `STALE_MINUTES` | `2` | Kitna purana transaction "atka hua" mana jaye |
| `BIG_PAYOUT_PAISE` | ₹50,000 | Isse bada payout flag hoga |
| `BURST_COUNT` | `10` / ghanta | Itne payouts ek ghante mein = flag |
| `REPORT_DIR` | `./reports` | Report kahan bane |

Production mein ek **service account** (sirf reports/status-check permission wala) bana kar
usi ke credentials env mein do — admin password kabhi mat use karna.
