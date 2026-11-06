import { matchStatementRow, parseAmountPaise, parseCsvStatements } from './bank-statement';

describe('bank statement CSV', () => {
  it('parses rupee amounts to paise', () => {
    expect(parseAmountPaise('1,250.50')).toBe(125050);
    expect(parseAmountPaise('100')).toBe(10000);
  });
  it('matches on UTR and leaves unmatched lines unmatched', () => {
    const rows = parseCsvStatements('date,amount,utr\n2026-11-01,100.00,UTR1\n2026-11-01,50.00,MISSING');
    const txns = [{ id: 't1', utr: 'UTR1', amountPaise: 10000, createdAt: new Date('2026-11-01T10:00:00'), status: 'SUCCESS' }];
    expect(matchStatementRow(rows[0], txns).status).toBe('MATCHED');
    expect(matchStatementRow(rows[1], txns).status).toBe('UNMATCHED');
  });
});
