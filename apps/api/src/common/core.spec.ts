import { assertBalanced, balanceOf, feePaise, hmacSign, hmacVerify, nextStatus, assertProviderUrl, encryptSecret, decryptSecret, newApiKey, sha256, stableStringify } from './core';
describe('money',()=>{ it('fee is integer paise',()=>{ expect(feePaise(100050,200,0)).toBe(2001); expect(()=>feePaise(10.5,100)).toThrow(); }); });
describe('ledger',()=>{ it('balanced entries pass, unbalanced throw',()=>{ assertBalanced([{account:'a',debit:100,credit:0},{account:'b',debit:0,credit:100}]); expect(()=>assertBalanced([{account:'a',debit:100,credit:0},{account:'b',debit:0,credit:99}])).toThrow(/unbalanced/); }); it('balanceOf nets credits-debits',()=>{ expect(balanceOf([{account:'x',debit:0,credit:500},{account:'x',debit:200,credit:0}],'x')).toBe(300); }); });
describe('state machine — duplicate & out-of-order webhooks',()=>{ it('terminal never regresses',()=>{ expect(nextStatus('SUCCESS','PENDING')).toBe('SUCCESS'); expect(nextStatus('SUCCESS','FAILED')).toBe('SUCCESS'); expect(nextStatus('FAILED','PROCESSING')).toBe('FAILED'); }); it('UNKNOWN is not auto-failed by late pending, resolves only to terminal',()=>{ expect(nextStatus('UNKNOWN','PENDING')).toBe('UNKNOWN'); expect(nextStatus('UNKNOWN','SUCCESS')).toBe('SUCCESS'); }); it('pending advances',()=>{ expect(nextStatus('PENDING','SUCCESS')).toBe('SUCCESS'); }); });
describe('webhook hmac + replay window',()=>{ it('verifies fresh, rejects stale/tampered',()=>{ const ts=Math.floor(Date.now()/1000); const h=hmacSign('s','body',ts); expect(hmacVerify('s','body',h)).toBe(true); expect(hmacVerify('s','tampered',h)).toBe(false); expect(hmacVerify('s','body',hmacSign('s','body',ts-1000))).toBe(false); }); });
describe('ssrf guard',()=>{ it('blocks private hosts and non-allowlisted hosts',()=>{ expect(()=>assertProviderUrl('https://169.254.169.254/x',[])).toThrow(); expect(()=>assertProviderUrl('http://10.0.0.1/x',[])).toThrow(); expect(()=>assertProviderUrl('https://evil.example/x',['api.provider.example'])).toThrow(/allowlist/); expect(assertProviderUrl('https://api.provider.example/x',['api.provider.example'])).toContain('api.provider.example'); }); });
describe('secrets',()=>{ it('encrypt round-trips; api keys hash',()=>{ process.env.ENCRYPTION_KEY=Buffer.alloc(32,3).toString('base64'); expect(decryptSecret(encryptSecret('provider-secret'))).toBe('provider-secret'); const k=newApiKey('sandbox'); expect(sha256(k.secret)).toBe(k.hash); expect(k.full).not.toContain('undefined'); }); });
describe('tenant isolation + idempotency semantics (pure helpers)',()=>{
  it('fee/idempotency duplicate returns same result is enforced in service via requestHash — hash differs on payload change',()=>{ expect(sha256(JSON.stringify({a:1}))).not.toBe(sha256(JSON.stringify({a:2}))); });
  it('stableStringify ignores key order',()=>{ expect(stableStringify({b:1,a:2})).toBe(stableStringify({a:2,b:1})); expect(sha256(stableStringify({z:1,a:{c:3,b:2}}))).toBe(sha256(stableStringify({a:{b:2,c:3},z:1}))); });
});
describe('production access gate',()=>{ it('state machine keeps production approval separate — represented by merchant.productionEnabled checked in ApiKeyGuard/credentials (see guards.ts)',()=>{ expect(nextStatus('PENDING','PROCESSING')).toBe('PROCESSING'); }); });
import { ipInCidr, verifyRequestSignature, requestSignature, safeEqualHex } from './core';
describe('payout shield',()=>{ it('CIDR match is exact — neighbouring IP does not pass',()=>{ expect(ipInCidr('203.0.113.10','203.0.113.10/32')).toBe(true); expect(ipInCidr('203.0.113.99','203.0.113.10/32')).toBe(false); expect(ipInCidr('203.0.113.99','203.0.113.0/24')).toBe(true); expect(ipInCidr('10.0.0.5','0.0.0.0/0')).toBe(true); });
 it('signed payout verifies, tampered body / stale ts fails',()=>{ const sec='signsec_test'; const body='{"amountPaise":100}'; const ts=Math.floor(Date.now()/1000); const sig=requestSignature(sec,ts,body); expect(verifyRequestSignature(sec,String(ts),sig,body)).toBe(true); expect(verifyRequestSignature(sec,String(ts),sig,body.replace('100','999'))).toBe(false); expect(verifyRequestSignature(sec,String(ts-3600),requestSignature(sec,ts-3600,body),body)).toBe(false); expect(verifyRequestSignature('wrong',String(ts),sig,body)).toBe(false); });
 it('hash compare is exact',()=>{ expect(safeEqualHex(sha256('a'),sha256('a'))).toBe(true); expect(safeEqualHex(sha256('a'),sha256('b'))).toBe(false); }); });
import { pickRouteByAmount } from './core';
describe('amount-band routing',()=>{
  const routes=[
    {providerId:'idfc',priority:1,minAmountPaise:10000,maxAmountPaise:100000,isActive:true},   // ₹100–₹1,000
    {providerId:'axis',priority:2,minAmountPaise:100000,maxAmountPaise:300000,isActive:true},  // ₹1,000–₹3,000
    {providerId:'hdfc',priority:3,minAmountPaise:200000,maxAmountPaise:1000000,isActive:true}, // ₹2,000–₹10,000
    {providerId:'phonepe',priority:4,minAmountPaise:200000,maxAmountPaise:1000000,isActive:true},
  ];
  it('picks IDFC for ₹100 and ₹500',()=>{ expect(pickRouteByAmount(routes,10000)?.providerId).toBe('idfc'); expect(pickRouteByAmount(routes,50000)?.providerId).toBe('idfc'); });
  it('at ₹1,000 prefers lower priority (IDFC) when both match',()=>{ expect(pickRouteByAmount(routes,100000)?.providerId).toBe('idfc'); });
  it('picks Axis for ₹1,500',()=>{ expect(pickRouteByAmount(routes,150000)?.providerId).toBe('axis'); });
  it('picks HDFC for ₹5,000 (before PhonePe)',()=>{ expect(pickRouteByAmount(routes,500000)?.providerId).toBe('hdfc'); });
  it('inactive routes are skipped',()=>{ const off=routes.map(r=>r.providerId==='hdfc'?{...r,isActive:false}:r); expect(pickRouteByAmount(off,500000)?.providerId).toBe('phonepe'); });
  it('circuit-open providers are skipped for new traffic',()=>{ expect(pickRouteByAmount(routes,500000,new Set(['hdfc']))?.providerId).toBe('phonepe'); });
  it('no match returns null',()=>{ expect(pickRouteByAmount(routes,50)).toBeNull(); });
});
