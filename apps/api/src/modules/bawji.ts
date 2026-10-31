import { CanonicalResult } from '@syntrix/shared';
import { ProviderAdapter } from './providers';

/** In-process test provider. The QR opens our own page. It never builds a upi:// link and never calls a bank. */
export function bawjiAppBase() {
  return (process.env.PUBLIC_APP_URL || 'https://syntrixapi.in').replace(/\/$/, '');
}
export function bawjiPayUrl(reference: string) {
  return `${bawjiAppBase()}/pay/bawji/${encodeURIComponent(reference)}`;
}
export function bawjiUtr(seed: string, prefix: 'BAWJI' | 'BAWJIPO') {
  let n = 7;
  for (const c of String(seed || '')) n = (n * 33 + c.charCodeAt(0)) >>> 0;
  const digits = String(n).padStart(12, '0').slice(-12);
  return prefix === 'BAWJIPO' ? `BAWJIPO${digits.slice(0, 10)}` : `BAWJI${digits}`;
}

export class BawjiAdapter implements ProviderAdapter {
  async createPayin(req: any): Promise<CanonicalResult> {
    const reference = String(req.merchantRef || '').trim();
    if (!reference) return { status: 'FAILED', message: 'merchantRef is required' };
    const link = bawjiPayUrl(reference);
    return {
      status: 'PROCESSING',
      providerRef: reference,
      message: 'Test UPI intent ready. The QR opens a page on this site and does not debit a bank.',
      paymentLink: link,
      upiLink: link,
    } as CanonicalResult;
  }
  async getPayinStatus(providerRef: string): Promise<CanonicalResult> {
    return { status: 'PROCESSING', providerRef, message: 'Waiting for the test payment page' };
  }
  async createPayout(req: any): Promise<CanonicalResult> {
    const reference = String(req.merchantRef || '').trim();
    if (!reference) return { status: 'FAILED', message: 'merchantRef is required' };
    return {
      status: 'SUCCESS',
      providerRef: reference,
      utr: bawjiUtr(reference, 'BAWJIPO'),
      message: 'Simulated payout. No money was sent to a bank.',
    };
  }
  async getPayoutStatus(providerRef: string): Promise<CanonicalResult> {
    return { status: 'SUCCESS', providerRef, utr: bawjiUtr(providerRef, 'BAWJIPO'), message: 'Simulated payout. No money was sent to a bank.' };
  }
  async createRefund(): Promise<CanonicalResult> {
    return { status: 'FAILED', message: 'Bawji Raj test payments cannot be refunded' };
  }
  async getRefundStatus(providerRef: string): Promise<CanonicalResult> {
    return { status: 'FAILED', providerRef, message: 'Bawji Raj test payments cannot be refunded' };
  }
  verifyWebhook(): boolean { return false; }
  normalizeWebhook(p: any) {
    const ref = String(p?.reference || p?.merchantRef || '');
    return { providerEventId: ref, providerRef: ref, status: 'PROCESSING' as const, amountPaise: undefined as number | undefined };
  }
}
