/** Pure CSV + match helpers. Does not mark ledger success. */

export type StatementRow = { date?: Date; amountPaise: number; utr?: string; narration?: string };
export type TxnHit = { id: string; utr?: string | null; amountPaise: number; createdAt: Date; status: string };

export function parseAmountPaise(raw: string) {
  const s = String(raw || '').replace(/[,₹\s]/g, '');
  if (!s) return 0;
  if (s.includes('.')) return Math.round(Number(s) * 100);
  const n = Number(s);
  if (!Number.isFinite(n)) return 0;
  // 12+ digit integers are treated as paise already
  if (Math.abs(n) >= 1e10) return Math.trunc(n);
  return Math.round(n * 100);
}

export function parseCsvStatements(text: string): StatementRow[] {
  const lines = String(text || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  const head = splitCsv(lines[0]).map((h) => h.toLowerCase().replace(/[^a-z0-9]+/g, ''));
  const iUtr = head.findIndex((h) => ['utr', 'utrno', 'rrn', 'ref', 'reference', 'bankref'].includes(h));
  const iAmt = head.findIndex((h) => ['amount', 'amt', 'amountrupees', 'credit', 'debit', 'value'].includes(h));
  const iDate = head.findIndex((h) => ['date', 'valuedate', 'txndate', 'trandate'].includes(h));
  const iNar = head.findIndex((h) => ['narration', 'remarks', 'description', 'particulars'].includes(h));
  if (iAmt < 0 && iUtr < 0) return [];
  const out: StatementRow[] = [];
  for (const line of lines.slice(1)) {
    const cols = splitCsv(line);
    const amountPaise = iAmt >= 0 ? Math.abs(parseAmountPaise(cols[iAmt] || '0')) : 0;
    const utr = iUtr >= 0 ? String(cols[iUtr] || '').trim() : '';
    if (!amountPaise && !utr) continue;
    let date: Date | undefined;
    if (iDate >= 0 && cols[iDate]) {
      const d = new Date(cols[iDate]);
      if (!Number.isNaN(d.getTime())) date = d;
    }
    out.push({ date, amountPaise, utr: utr || undefined, narration: iNar >= 0 ? cols[iNar] : undefined });
  }
  return out;
}

export function matchStatementRow(row: StatementRow, txns: TxnHit[]) {
  const utr = String(row.utr || '').trim();
  if (utr) {
    const hits = txns.filter((t) => String(t.utr || '') === utr);
    if (hits.length === 1) return { status: 'MATCHED' as const, transactionId: hits[0].id, note: 'UTR match' };
    if (hits.length > 1) return { status: 'AMBIGUOUS' as const, transactionId: null, note: 'Multiple txns with this UTR' };
  }
  if (row.amountPaise > 0 && row.date) {
    const day = dayKey(row.date);
    const hits = txns.filter((t) => t.amountPaise === row.amountPaise && dayKey(t.createdAt) === day && t.status === 'SUCCESS');
    if (hits.length === 1) return { status: 'MATCHED' as const, transactionId: hits[0].id, note: 'Amount+date match' };
    if (hits.length > 1) return { status: 'AMBIGUOUS' as const, transactionId: null, note: 'Multiple SUCCESS txns same amount and day' };
  }
  return { status: 'UNMATCHED' as const, transactionId: null, note: 'No Syntrix txn matched — not treated as success' };
}

function dayKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function splitCsv(line: string) {
  const out: string[] = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') q = !q;
    else if (ch === ',' && !q) { out.push(cur.trim()); cur = ''; }
    else cur += ch;
  }
  out.push(cur.trim());
  return out;
}
