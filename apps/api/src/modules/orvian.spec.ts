import { orvianRupees, orvianMobile, orvianTerminal } from './orvian';
describe('ORVIAN mapping', () => {
  it('sends rupees and a 10-digit mobile', () => {
    expect(orvianRupees(10050)).toBe('100.50');
    expect(orvianMobile('+91 87986 70989')).toBe('8798670989');
    expect(orvianMobile('123')).toBe('');
  });
  it('does not treat a UPI-link success as a captured payment', () => {
    expect(orvianTerminal('success', null, 'UPI Link Generated Successfully.')).toBe('PROCESSING');
    expect(orvianTerminal('Processed', '514352525177')).toBe('SUCCESS');
    expect(orvianTerminal('FAILED', null, 'Transaction Failed')).toBe('FAILED');
  });
});
