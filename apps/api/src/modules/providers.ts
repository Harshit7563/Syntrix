import { CanonicalPayinRequest, CanonicalResult } from '@syntrix/shared'; import { assertProviderUrl } from '../common/core';
export class ProviderTimeoutError extends Error {}
/** Every upstream integration implements this. Adding a provider = new adapter + capabilities rows, never a merchant-facing API change. See docs/PROVIDER_INTEGRATION.md */
export interface ProviderAdapter {
  createPayin(req: CanonicalPayinRequest & {idempotencyKey:string}): Promise<CanonicalResult>;
  getPayinStatus(providerRef: string): Promise<CanonicalResult>;
  createPayout(req: {merchantRef:string;amountPaise:number;beneficiary:any;idempotencyKey:string}): Promise<CanonicalResult>;
  getPayoutStatus(providerRef: string): Promise<CanonicalResult>;
  createRefund(req:{paymentRef:string;amountPaise:number;merchantRef:string}): Promise<CanonicalResult>;
  getRefundStatus(providerRef: string): Promise<CanonicalResult>;
  verifyWebhook(rawBody: string, headers: Record<string,string>): boolean;
  normalizeWebhook(payload: any): {providerEventId:string; providerRef:string; status:CanonicalResult['status']; amountPaise?:number};
}
/** Realistic mock provider for sandbox. Deterministic failure triggers via email/ref keywords. */
export class MockProviderAdapter implements ProviderAdapter {
  private latency=()=>new Promise(r=>setTimeout(r, 40+Math.random()*80));
  async createPayin(req: any){ await this.latency(); const ref='mockpay_'+req.merchantRef; if(JSON.stringify(req).includes('timeout@')) throw new ProviderTimeoutError('mock payin timeout'); if(JSON.stringify(req).includes('fail@')) return {status:'FAILED' as const,providerRef:ref,message:'Mock: issuer declined'}; const utr='UTR'+String(Math.abs([...String(req.merchantRef||ref)].reduce((a:number,c:string)=>a*31+c.charCodeAt(0),11))%1e12).padStart(12,'0'); return {status:'SUCCESS' as const,providerRef:ref,utr,message:'Mock payin captured'}; }
  async getPayinStatus(providerRef:string){ await this.latency(); return {status:'SUCCESS' as const,providerRef}; }
  async createPayout(req:any){ await this.latency(); if(JSON.stringify(req).includes('timeout')) throw new ProviderTimeoutError('mock payout timeout — outcome UNKNOWN, do not retry blindly'); const utr='UTR'+String(Math.abs([...req.merchantRef].reduce((a:number,c:string)=>a*31+c.charCodeAt(0),7))%1e12).padStart(12,'0'); return {status:'SUCCESS' as const,providerRef:'mockpo_'+req.merchantRef,utr}; }
  async getPayoutStatus(providerRef:string){ await this.latency(); return {status:'SUCCESS' as const,providerRef}; }
  async createRefund(req:any){ await this.latency(); return {status:'SUCCESS' as const,providerRef:'mockrf_'+req.merchantRef}; }
  async getRefundStatus(providerRef:string){ return {status:'SUCCESS' as const,providerRef}; }
  verifyWebhook(_raw: string, headers: Record<string,string>){ const expected=process.env.MOCK_WEBHOOK_SECRET||''; const got=String(headers?.['x-syntrix-webhook-secret']||''); return !!expected && got===expected; }
  normalizeWebhook(p:any){ return {providerEventId:p.eventId||p.id, providerRef:p.providerRef, status:p.status, amountPaise:p.amountPaise}; }
}
/** Generic HTTP adapter skeleton for real providers: only approved HTTPS hosts, no redirects to private hosts, hard timeout. Map provider fields inside each concrete subclass. */
export class HttpProviderAdapter implements ProviderAdapter {
  constructor(private baseUrl:string, private creds:any, private timeoutMs=15000){ assertProviderUrl(baseUrl,(process.env.PROVIDER_ALLOWED_HOSTS||'').split(',').filter(Boolean)); }
  private async call(path:string, body:any){ const ctrl=new AbortController(); const t=setTimeout(()=>ctrl.abort(),this.timeoutMs); try{ const r=await fetch(this.baseUrl+path,{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${this.creds?.apiKey||''}`},body:JSON.stringify(body),signal:ctrl.signal,redirect:'manual'}); if(r.status>=300&&r.status<400) throw new Error('Provider redirects are blocked — configure the final HTTPS endpoint'); return await r.json(); } catch(e:any){ if(e.name==='AbortError') throw new ProviderTimeoutError('provider timeout'); throw e; } finally{ clearTimeout(t); } }
  async createPayin(req:any){ const r:any=await this.call('/payins',req); return {status:r.status,providerRef:r.id,raw:r} as any; }
  async getPayinStatus(ref:string){ const r:any=await this.call('/payins/status',{ref}); return {status:r.status,providerRef:ref,raw:r} as any; }
  async createPayout(req:any){ const r:any=await this.call('/payouts',req); return {status:r.status,providerRef:r.id,raw:r} as any; }
  async getPayoutStatus(ref:string){ const r:any=await this.call('/payouts/status',{ref}); return {status:r.status,providerRef:ref,raw:r} as any; }
  async createRefund(req:any){ const r:any=await this.call('/refunds',req); return {status:r.status,providerRef:r.id,raw:r} as any; }
  async getRefundStatus(ref:string){ const r:any=await this.call('/refunds/status',{ref}); return {status:r.status,providerRef:ref,raw:r} as any; }
  verifyWebhook(): boolean { throw new Error('Implement per-provider signature verification before enabling webhooks'); }
  normalizeWebhook(p:any){ return {providerEventId:p.id,providerRef:p.ref,status:p.status}; }
}

/* ---------- Config-driven generic adapter: koi bhi PG / wallet / bank API bina code likhe ---------- */
export interface ProviderConfig { authType?: 'BEARER'|'API_KEY_HEADER'|'BASIC'|'NONE'; apiKeyHeader?: string; payinPath?: string; payoutPath?: string; payinStatusPath?: string; payoutStatusPath?: string; refundPath?: string; amountUnit?: 'paise'|'rupees'; statusField?: string; refField?: string; utrField?: string; successValues?: string[]; failedValues?: string[]; }
export const DEFAULT_PROVIDER_CONFIG: Required<ProviderConfig> = { authType:'BEARER', apiKeyHeader:'x-api-key', payinPath:'/payins', payoutPath:'/payouts', payinStatusPath:'/payins/status', payoutStatusPath:'/payouts/status', refundPath:'/refunds', amountUnit:'paise', statusField:'status', refField:'id', utrField:'utr', successValues:['SUCCESS','CAPTURED','PAID','COMPLETED','SUCCESSFUL','APPROVED'], failedValues:['FAILED','FAILURE','DECLINED','REJECTED','CANCELLED','ERROR'] };
export function cfgOf(provider:any): Required<ProviderConfig> { return {...DEFAULT_PROVIDER_CONFIG, ...(provider?.config||{})}; }
export function amountForProvider(amountPaise:number, cfg:Required<ProviderConfig>): number { return cfg.amountUnit==='rupees' ? Math.round(amountPaise)/100 : amountPaise; }
function pick(obj:any, names:string[]): any { for(const n of names){ if(obj?.[n]!==undefined && obj?.[n]!==null && obj?.[n]!=='') return obj[n]; } return undefined; }
export function providerRefOf(payload:any, cfg:Required<ProviderConfig>): string|undefined { const v=pick(payload,[cfg.refField,'id','providerRef','txnId','transactionId','paymentId','orderId','referenceId']); return v!==undefined?String(v):undefined; }
export function providerStatusOf(payload:any, cfg:Required<ProviderConfig>): CanonicalResult['status'] { const raw=pick(payload,[cfg.statusField,'status','state','paymentStatus','txnStatus']); if(raw===undefined) return 'PROCESSING'; const v=String(raw).toUpperCase(); if(cfg.successValues.map(x=>x.toUpperCase()).includes(v)) return 'SUCCESS'; if(cfg.failedValues.map(x=>x.toUpperCase()).includes(v)) return 'FAILED'; return 'PROCESSING'; }
export function providerAuthHeaders(creds:any, cfg:Required<ProviderConfig>): Record<string,string> { const key=creds?.apiKey||''; const secret=creds?.apiSecret||''; if(cfg.authType==='NONE'||!key) return {}; if(cfg.authType==='API_KEY_HEADER') return {[cfg.apiKeyHeader||'x-api-key']:key}; if(cfg.authType==='BASIC') return {authorization:'Basic '+Buffer.from(`${key}:${secret}`).toString('base64')}; return {authorization:`Bearer ${key}`}; }

export class GenericHttpAdapter implements ProviderAdapter {
  private cfg: Required<ProviderConfig>;
  constructor(private baseUrl:string, private creds:any, cfg:ProviderConfig, private timeoutMs=15000){ assertProviderUrl(baseUrl,(process.env.PROVIDER_ALLOWED_HOSTS||'').split(',').filter(Boolean)); this.cfg={...DEFAULT_PROVIDER_CONFIG,...cfg}; }
  private url(path:string, ref?:string){ const clean=(path||'').replace('{ref}', encodeURIComponent(ref||'')); return this.baseUrl.replace(/\/$/,'') + (clean.startsWith('/')?clean:'/'+clean); }
  private async call(path:string, body:any, ref?:string){ const ctrl=new AbortController(); const t=setTimeout(()=>ctrl.abort(),this.timeoutMs); const isGet=path.includes('{ref}'); try{ const r=await fetch(this.url(path,ref),{method:isGet?'GET':'POST',headers:{'content-type':'application/json',...providerAuthHeaders(this.creds,this.cfg)},body:isGet?undefined:JSON.stringify(body),signal:ctrl.signal,redirect:'manual'}); if(r.status>=300&&r.status<400) throw new Error('Provider redirects are blocked — configure the final HTTPS endpoint'); const text=await r.text(); let data:any; try{ data=JSON.parse(text); }catch{ data={status:r.ok?'SUCCESS':'FAILED', raw:text}; } if(!r.ok && data?.status===undefined) data={...data,status:'FAILED',message:`Provider HTTP ${r.status}`}; return data; } catch(e:any){ if(e.name==='AbortError') throw new ProviderTimeoutError('provider timeout'); throw e; } finally{ clearTimeout(t); } }
  private bodyFor(req:any){ const amount=amountForProvider(req.amountPaise||0,this.cfg); return { merchantRef:req.merchantRef, orderId:req.merchantRef, reference:req.merchantRef, idempotencyKey:req.idempotencyKey, amount, amountPaise:req.amountPaise, currency:'INR', customer:req.customer||undefined, beneficiary:req.beneficiary||undefined, paymentRef:req.paymentRef||undefined, ...req }; }
  /** Real API only — UTR/RRN always from provider payload (never invented here). Mock adapter invents its own. */
  private map(payload:any, fallbackRef?:string): CanonicalResult {
    const nested=payload?.data||payload?.result||payload?.payment||payload?.transaction||{};
    const utr=pick(payload,[this.cfg.utrField,'utr','UTR','rrn','RRN','bankRrn','bank_rrn','bankRef','bankReference','utrNumber','rrnNumber','bankUtr'])
      ?? pick(nested,[this.cfg.utrField,'utr','UTR','rrn','RRN','bankRrn','bank_rrn','bankRef','bankReference','utrNumber','rrnNumber']);
    return {status:providerStatusOf(payload,this.cfg), providerRef:providerRefOf(payload,this.cfg)||fallbackRef, utr:utr!==undefined&&utr!==null&&utr!==''?String(utr):undefined, message:pick(payload,['message','error','reason'])?.toString(), raw:payload} as CanonicalResult;
  }
  async createPayin(req:any){ return this.map(await this.call(this.cfg.payinPath, this.bodyFor(req))); }
  async getPayinStatus(ref:string){ return this.map(await this.call(this.cfg.payinStatusPath,{ref,providerRef:ref},ref), ref); }
  async createPayout(req:any){ return this.map(await this.call(this.cfg.payoutPath, this.bodyFor(req))); }
  async getPayoutStatus(ref:string){ return this.map(await this.call(this.cfg.payoutStatusPath,{ref,providerRef:ref},ref), ref); }
  async createRefund(req:any){ return this.map(await this.call(this.cfg.refundPath, this.bodyFor(req))); }
  async getRefundStatus(ref:string){ return this.map(await this.call(this.cfg.refundPath,{ref,providerRef:ref},ref), ref); }
  verifyWebhook(rawBody: string, headers: Record<string,string>): boolean { return false; } // per-provider webhook signature alag se configure hoti hai; kabhi auto-trust nahi
  normalizeWebhook(p:any){ return {providerEventId:String(p?.eventId||p?.id||''), providerRef:providerRefOf(p,this.cfg)||'', status:providerStatusOf(p,this.cfg), amountPaise:p?.amountPaise}; }
  /** Portal "Test connection": sirf reachability + auth header ke saath halka GET — koi payment create nahi hota. */
  async testConnection(): Promise<{ok:boolean; httpStatus:number; ms:number; note:string}> { const started=Date.now(); const ctrl=new AbortController(); const t=setTimeout(()=>ctrl.abort(),8000); try{ const r=await fetch(this.baseUrl,{method:'GET',headers:{...providerAuthHeaders(this.creds,this.cfg)},signal:ctrl.signal,redirect:'manual'}); return {ok:r.status<500, httpStatus:r.status, ms:Date.now()-started, note:r.status<500?'Host is reachable. For a real check, run one small sandbox payment.':'The provider is returning a server error (5xx)'}; } catch(e:any){ return {ok:false, httpStatus:0, ms:Date.now()-started, note:e.name==='AbortError'?'Timed out — the host did not respond within 8 seconds':String(e.message||e)}; } finally{ clearTimeout(t); } }
}

export function adapterFor(provider:any, credsOverride?:any): ProviderAdapter { if(provider.isMock||provider.code==='MOCKPAY') return new MockProviderAdapter(); let creds=credsOverride||{}; if(!credsOverride){ try{ const {decryptSecret}=require('../common/core'); if(provider.credentialsEnc) creds=JSON.parse(decryptSecret(provider.credentialsEnc)); }catch{} } return new GenericHttpAdapter(provider.baseUrl,creds,cfgOf(provider),provider.timeoutMs); }
export async function activeProviderCreds(prisma:any, providerId:string){ const k=await prisma.providerCredential.findFirst({where:{providerId,isActive:true,revokedAt:null},orderBy:{priority:'asc'}}); if(!k) return undefined; const {decryptSecret}=require('../common/core'); try{ await prisma.providerCredential.update({where:{id:k.id},data:{lastUsedAt:new Date()}}); return {apiKey:decryptSecret(k.apiKeyEnc),apiSecret:k.secretEnc?decryptSecret(k.secretEnc):undefined}; }catch{ return undefined; } }
export async function hasCapability(prisma:any, providerId:string, operation:string, productCode:string){ const c=await prisma.providerCapability.findFirst({where:{providerId,operation,productCode}}); return !!c; }
