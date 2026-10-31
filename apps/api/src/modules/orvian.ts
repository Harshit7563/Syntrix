import { CanonicalResult } from '@syntrix/shared';
import { assertProviderUrl } from '../common/core';
import { ProviderAdapter, ProviderTimeoutError } from './providers';

const BASE = () => (process.env.ORVIAN_BASE_URL || 'https://orviansystem.com').replace(/\/$/, '');
let tokenCache: { token: string; exp: number } | null = null;

export function orvianRupees(amountPaise: number) {
  return (amountPaise / 100).toFixed(2);
}
export function orvianMobile(raw: unknown) {
  const d = String(raw || '').replace(/\D/g, '');
  return d.length >= 10 ? d.slice(-10) : '';
}
/** Status API is the source of truth. A UPI link response is not a captured payment. */
export function orvianTerminal(dataStatus: unknown, utr: unknown, message?: unknown): CanonicalResult['status'] {
  const s = String(dataStatus || '').toLowerCase();
  const msg = String(message || '').toLowerCase();
  if (['failed', 'failure', 'rejected', 'declined', 'error'].includes(s) || msg.includes('transaction failed')) return 'FAILED';
  if (utr && ['success', 'processed', 'successful', 'completed'].includes(s)) return 'SUCCESS';
  return 'PROCESSING';
}

async function formPost(url: string, fields: Record<string, string>, token?: string) {
  const body = new FormData();
  for (const [k, v] of Object.entries(fields)) body.append(k, v);
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 20000);
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: token ? { authorization: `Bearer ${token}` } : {},
      body,
      signal: ctrl.signal,
      redirect: 'manual',
    });
    if (r.status >= 300 && r.status < 400) throw new Error('ORVIAN redirected the request');
    const text = await r.text();
    let data: any = {};
    try { data = text ? JSON.parse(text) : {}; } catch { data = { status: 'FAILED', message: text.slice(0, 200) }; }
    return { http: r.status, data };
  } catch (e: any) {
    if (e.name === 'AbortError') throw new ProviderTimeoutError('ORVIAN timed out');
    throw e;
  } finally { clearTimeout(t); }
}

async function accessToken(authKey: string, authSecret: string) {
  if (tokenCache && tokenCache.exp > Date.now()) return tokenCache.token;
  const { http, data } = await formPost(`${BASE()}/api/v1.1/t1/oauth/token`, { authKey, authSecret });
  const token = data?.data?.access_token;
  if (!token) throw new Error(data?.message || `ORVIAN token failed (HTTP ${http})`);
  tokenCache = { token, exp: Date.now() + 23 * 60 * 60 * 1000 };
  return token as string;
}

export class OrvianAdapter implements ProviderAdapter {
  constructor(private authKey: string, private authSecret: string) {
    assertProviderUrl(BASE(), (process.env.PROVIDER_ALLOWED_HOSTS || '').split(',').filter(Boolean));
  }
  private async token() {
    if (!this.authKey || !this.authSecret) throw new Error('ORVIAN auth key and secret are not set');
    return accessToken(this.authKey, this.authSecret);
  }
  async createPayin(req: any): Promise<CanonicalResult> {
    const mobile = orvianMobile(req.customer?.mobile || req.customer?.phone);
    const name = String(req.customer?.name || '').trim();
    const email = String(req.customer?.email || '').trim();
    const reference = String(req.merchantRef || '').trim();
    if (!reference) return { status: 'FAILED', message: 'merchantRef is required' };
    if (!name || !email || mobile.length !== 10) return { status: 'FAILED', message: 'Pay-in needs customer name, email, and a 10-digit mobile' };
    const token = await this.token();
    const { data } = await formPost(`${BASE()}/api/v1.1/t1/UpiIntent`, {
      amount: orvianRupees(req.amountPaise),
      reference,
      name,
      mobile,
      email,
    }, token);
    const link = data?.payment_link || data?.upi_link;
    if (!link || String(data?.status || '').toLowerCase() === 'failed') {
      return { status: 'FAILED', message: data?.message || 'ORVIAN did not return a UPI link', providerRef: reference, raw: data };
    }
    return {
      status: 'PROCESSING',
      providerRef: reference,
      message: data?.message || 'UPI link ready',
      paymentLink: link,
      upiLink: data?.upi_link || link,
      orderId: data?.order_id,
      raw: data,
    } as CanonicalResult;
  }
  async getPayinStatus(providerRef: string): Promise<CanonicalResult> {
    return this.statusOf('payin', providerRef);
  }
  async createPayout(req: any): Promise<CanonicalResult> {
    const b = req.beneficiary || {};
    const reference = String(req.merchantRef || '').trim();
    const account = String(b.account || b.accountNumber || '').replace(/\s/g, '');
    const ifsc = String(b.ifsc || '').trim().toUpperCase();
    const name = String(b.name || '').trim();
    const mobile = orvianMobile(b.mobile || b.phone);
    if (!reference) return { status: 'FAILED', message: 'merchantRef is required' };
    if (!account || ifsc.length < 4 || !name || mobile.length !== 10) return { status: 'FAILED', message: 'Payout needs beneficiary name, 10-digit mobile, account number, and IFSC' };
    const mode = String(req.method || req.mode || b.trans_mode || 'imps').toLowerCase();
    const token = await this.token();
    const { data } = await formPost(`${BASE()}/api/v1.1/t1/withdrawal`, {
      amount: orvianRupees(req.amountPaise),
      reference,
      trans_mode: ['imps', 'neft', 'rtgs'].includes(mode) ? mode : 'imps',
      account,
      ifsc,
      name,
      email: String(b.email || ''),
      mobile,
      address: String(b.address || ''),
    }, token);
    const inner = data?.data || {};
    const st = orvianTerminal(inner.status || data?.status, inner.utr || data?.utr, inner.message || data?.message);
    return { status: st === 'SUCCESS' ? 'SUCCESS' : st, providerRef: reference, utr: inner.utr || data?.utr, message: inner.message || data?.message, raw: data };
  }
  async getPayoutStatus(providerRef: string): Promise<CanonicalResult> {
    return this.statusOf('payout', providerRef);
  }
  private async statusOf(kind: 'payin' | 'payout', ref: string): Promise<CanonicalResult> {
    const token = await this.token();
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 20000);
    try {
      const r = await fetch(`${BASE()}/api/v1.1/t1/${kind}/status/${encodeURIComponent(ref)}`, { headers: { authorization: `Bearer ${token}` }, signal: ctrl.signal, redirect: 'manual' });
      const data: any = await r.json().catch(() => ({}));
      const inner = data?.data || {};
      const st = orvianTerminal(inner.status || data?.status, inner.utr, inner.message || data?.message);
      return { status: st, providerRef: ref, utr: inner.utr ? String(inner.utr) : undefined, message: data?.message, raw: data };
    } catch (e: any) {
      if (e.name === 'AbortError') throw new ProviderTimeoutError('ORVIAN status check timed out');
      throw e;
    } finally { clearTimeout(t); }
  }
  async createRefund(): Promise<CanonicalResult> { return { status: 'FAILED', message: 'ORVIAN does not support refunds on this API' }; }
  async getRefundStatus(providerRef: string): Promise<CanonicalResult> { return { status: 'FAILED', providerRef, message: 'ORVIAN does not support refunds on this API' }; }
  verifyWebhook(): boolean { return true; }
  normalizeWebhook(p: any) {
    const ref = String(p?.transaction_id || p?.reference || p?.txn_id || p?.order_id || '');
    const utr = p?.utr || p?.data?.utr;
    return { providerEventId: ref || String(p?.order_id || Date.now()), providerRef: ref, status: orvianTerminal(p?.data?.status || p?.status, utr, p?.message), amountPaise: undefined as number | undefined };
  }
}
