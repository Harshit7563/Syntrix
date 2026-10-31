import { BawjiAdapter, bawjiPayUrl, bawjiUtr } from './bawji';

describe('Bawji Raj test provider', () => {
  const a = new BawjiAdapter();
  it('builds a site page, not a UPI app link', async () => {
    const r: any = await a.createPayin({ merchantRef: 'admin_pi_1', amountPaise: 10000 });
    expect(r.status).toBe('PROCESSING');
    expect(r.paymentLink).toBe(bawjiPayUrl('admin_pi_1'));
    expect(r.paymentLink.startsWith('upi:')).toBe(false);
    expect(r.upiLink).toBe(r.paymentLink);
  });
  it('simulates payout without a bank UTR shape from ORVIAN', async () => {
    const r = await a.createPayout({ merchantRef: 'admin_po_1', amountPaise: 10000, beneficiary: {}, idempotencyKey: 'k' });
    expect(r.status).toBe('SUCCESS');
    expect(r.utr).toBe(bawjiUtr('admin_po_1', 'BAWJIPO'));
    expect(String(r.message)).toMatch(/no money was sent/i);
  });
});
