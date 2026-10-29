import * as crypto from 'crypto';
// ---------- Money: integer paise only ----------
export function assertPaise(n: unknown): number { if (typeof n !== 'number' || !Number.isSafeInteger(n) || n < 0) throw new Error('Amount must be non-negative integer paise'); return n; }
export function feePaise(amountPaise: number, bps: number, flatPaise = 0): number { assertPaise(amountPaise); return Math.floor((amountPaise * bps) / 10000) + flatPaise; } // integer math only
// ---------- Crypto ----------
const key = () => Buffer.from(process.env.ENCRYPTION_KEY || Buffer.alloc(32, 7).toString('base64'), 'base64');
export function encryptSecret(plain: string): string { const iv = crypto.randomBytes(12); const c = crypto.createCipheriv('aes-256-gcm', key(), iv); const enc = Buffer.concat([c.update(plain, 'utf8'), c.final()]); return [iv.toString('base64'), c.getAuthTag().toString('base64'), enc.toString('base64')].join('.'); }
export function decryptSecret(payload: string): string { const [iv, tag, data] = payload.split('.').map(s => Buffer.from(s, 'base64')); const d = crypto.createDecipheriv('aes-256-gcm', key(), iv); d.setAuthTag(tag); return Buffer.concat([d.update(data), d.final()]).toString('utf8'); }
export const sha256 = (s: string) => crypto.createHash('sha256').update(s).digest('hex');
/** Stable JSON for idempotency hashes — key order / nested objects don't change the digest. */
export function stableStringify(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return '[' + v.map(stableStringify).join(',') + ']';
  const obj = v as Record<string, unknown>;
  return '{' + Object.keys(obj).sort().map(k => JSON.stringify(k) + ':' + stableStringify(obj[k])).join(',') + '}';
}
export function hmacSign(secret: string, body: string, ts: number) { return `t=${ts},v1=${crypto.createHmac('sha256', secret).update(`${ts}.${body}`).digest('hex')}`; }
export function hmacVerify(secret: string, body: string, header: string, maxAgeSec = 300): boolean { try { const parts = Object.fromEntries(header.split(',').map(p => p.split('='))); const ts = Number(parts.t); if (!ts || Math.abs(Date.now() / 1000 - ts) > maxAgeSec) return false; const exp = crypto.createHmac('sha256', secret).update(`${ts}.${body}`).digest('hex'); return crypto.timingSafeEqual(Buffer.from(exp), Buffer.from(parts.v1 || '')); } catch { return false; } }
export function newSigningSecret(){ return 'signsec_' + crypto.randomBytes(24).toString('hex'); }
/** HMAC signature for money-out requests: sign `${ts}.${rawBody}` with the SEPARATE signing secret (never the API key). */
export function requestSignature(secret: string, ts: number|string, rawBody: string){ return crypto.createHmac('sha256', secret).update(`${ts}.${rawBody}`).digest('hex'); }
export function verifyRequestSignature(secret: string, tsRaw: string, sig: string, rawBody: string, maxAgeSec = 300): boolean { try { const ts=Number(tsRaw); if(!ts||!sig) return false; if(Math.abs(Date.now()/1000-ts)>maxAgeSec) return false; const exp=requestSignature(secret,ts,rawBody); const a=Buffer.from(exp), b=Buffer.from(sig); return a.length===b.length && crypto.timingSafeEqual(a,b); } catch { return false; } }
/** Constant-time compare of two hex strings (API key hashes) — no timing leak. */
export function safeEqualHex(a: string, b: string): boolean { try { const x=Buffer.from(a||''), y=Buffer.from(b||''); return x.length===y.length && crypto.timingSafeEqual(x,y); } catch { return false; } }
/** Proper IPv4 CIDR match (the old prefix-string match let neighbouring IPs through). */
export function ipInCidr(ip: string, cidr: string): boolean { try { const toNum=(v:string)=>v.split('.').reduce((a,o)=>((a<<8)+Number(o))>>>0,0); if(!cidr.includes('/')) return ip===cidr; const [base,bitsRaw]=cidr.split('/'); const bits=Number(bitsRaw); if(bits<0||bits>32) return false; if(bits===0) return true; const mask=(0xffffffff << (32-bits))>>>0; return (toNum(ip)&mask)===(toNum(base)&mask); } catch { return false; } }
export function newApiKey(env: string) { const keyId = 'key_' + crypto.randomBytes(8).toString('hex'); const secret = `sk_${env}_${crypto.randomBytes(24).toString('hex')}`; return { keyId, secret, full: `${keyId}.${secret}`, hash: sha256(secret) }; }
export function totp(secretB32: string, t = Date.now()): string { const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'; let bits=''; for(const ch of secretB32.replace(/=| /g,'')) bits+=alphabet.indexOf(ch).toString(2).padStart(5,'0'); const bytes=Buffer.from(bits.match(/.{8}/g)!.map(b=>parseInt(b,2))); const counter=Buffer.alloc(8); counter.writeBigUInt64BE(BigInt(Math.floor(t/30000))); const h=crypto.createHmac('sha1',bytes).update(counter).digest(); const o=h[h.length-1]&15; return ((h.readUInt32BE(o)&0x7fffffff)%1e6).toString().padStart(6,'0'); }
// ---------- Transaction state machine ----------
export type St='PENDING'|'PROCESSING'|'SUCCESS'|'FAILED'|'UNKNOWN'|'REFUNDED'|'PARTIALLY_REFUNDED';
const TERMINAL: St[]=['SUCCESS','FAILED'];
/** Out-of-order/duplicate webhook safe: terminal states never regress; UNKNOWN never auto-fails. */
export function nextStatus(current: St, incoming: St): St {
  if (current === incoming) return current;
  if (TERMINAL.includes(current) && current !== 'REFUNDED') return current; // late PENDING/PROCESSING/duplicate ignored
  if (current === 'UNKNOWN') return incoming === 'PENDING' || incoming === 'PROCESSING' ? 'UNKNOWN' : incoming; // only resolved by explicit status check
  if (current === 'PENDING' || current === 'PROCESSING') return incoming;
  return current;
}
export const isTerminal=(s:St)=>TERMINAL.includes(s);
// ---------- SSRF guard ----------
const PRIVATE=/^(10\.|127\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1|fc|fd)/i;
export function assertProviderUrl(raw: string, approvedHosts: string[]) { const u=new URL(raw); if(u.protocol!=='https:' && !(process.env.NODE_ENV!=='production' && u.protocol==='http:')) throw new Error('Provider URL must use HTTPS'); const host=u.hostname.toLowerCase(); if(PRIVATE.test(host)||host==='localhost'||host.endsWith('.local')||host.endsWith('.internal')) throw new Error('Private/internal provider hosts are blocked'); if(approvedHosts.length && !approvedHosts.includes(host)) throw new Error(`Host ${host} is not in the approved provider host allowlist`); return u.toString(); }
// ---------- Ledger (pure, testable) ----------
export interface Entry{account:string;debit:number;credit:number}
export function assertBalanced(entries: Entry[]) { const d=entries.reduce((a,e)=>a+e.debit,0), c=entries.reduce((a,e)=>a+e.credit,0); entries.forEach(e=>{assertPaise(e.debit);assertPaise(e.credit); if(e.debit>0&&e.credit>0) throw new Error('Entry cannot be both debit and credit')}); if(d!==c||d===0) throw new Error(`Ledger transaction unbalanced: debit=${d} credit=${c}`); }
export function balanceOf(entries: Entry[], account: string) { return entries.filter(e=>e.account===account).reduce((a,e)=>a+e.credit-e.debit,0); }
export const redact=(o:any):any=>{ if(!o||typeof o!=='object') return o; const r:any=Array.isArray(o)?[]:{}; for(const [k,v] of Object.entries(o)) r[k]=/secret|password|api[_-]?key|credentials|pan|accountNo/i.test(k)?'[REDACTED]':redact(v); return r; };

// ---------- Amount-band routing ----------
export type AmountRoute = { id?:string; providerId:string; priority:number; minAmountPaise?:number|null; maxAmountPaise?:number|null; isActive?:boolean };
/** First matching active route by priority (lower = first). Min/Max are inclusive paise; null = open end.
 *  skipProviderIds = circuit-open providers — excluded for NEW traffic only. */
export function pickRouteByAmount(routes: AmountRoute[], amountPaise: number, skipProviderIds?: Set<string>|string[]): AmountRoute|null {
  if(!Number.isSafeInteger(amountPaise)||amountPaise<=0) return null;
  const skip=skipProviderIds instanceof Set?skipProviderIds:new Set(skipProviderIds||[]);
  const active=routes.filter(r=>r.isActive!==false && !skip.has(r.providerId));
  const match=active.filter(r=>{
    const min=r.minAmountPaise==null?0:Number(r.minAmountPaise);
    const max=r.maxAmountPaise==null?Number.MAX_SAFE_INTEGER:Number(r.maxAmountPaise);
    return amountPaise>=min && amountPaise<=max;
  }).sort((a,b)=>a.priority-b.priority || String(a.providerId).localeCompare(String(b.providerId)));
  return match[0]||null;
}

/** Circuit breaker config (env-overridable). */
export function circuitThreshold(){ const n=Number(process.env.CIRCUIT_FAILURE_THRESHOLD||3); return Number.isFinite(n)&&n>=1?Math.floor(n):3; }
export function circuitCooldownMs(){ const s=Number(process.env.CIRCUIT_COOLDOWN_SEC||300); return (Number.isFinite(s)&&s>=30?Math.floor(s):300)*1000; }
export function isCircuitOpen(p:{circuitOpenUntil?:Date|string|null}|null|undefined, now=new Date()){
  if(!p?.circuitOpenUntil) return false;
  return new Date(p.circuitOpenUntil).getTime()>now.getTime();
}
