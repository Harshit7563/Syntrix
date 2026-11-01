-- Removes every pay-in and payout, and the ledger lines they created.
-- Keeps the opening seed balance (ref seed:trustsetu-funding).
BEGIN;

CREATE TEMP TABLE _gone AS
  SELECT id FROM "Transaction" WHERE kind IN ('PAYIN', 'PAYOUT');

DELETE FROM "ReconciliationItem"
 WHERE "transactionId" IN (SELECT id FROM _gone);

DELETE FROM "WebhookDelivery"
 WHERE "eventId" IN (
   SELECT id FROM "WebhookEvent"
    WHERE type LIKE 'payin.%' OR type LIKE 'payout.%' OR type LIKE 'refund.%'
 );

DELETE FROM "WebhookEvent"
 WHERE type LIKE 'payin.%' OR type LIKE 'payout.%' OR type LIKE 'refund.%';

DELETE FROM "OutboxEvent"
 WHERE "aggregateId" IN (SELECT id FROM _gone);

DELETE FROM "UsageRecord"
 WHERE "productCode" IN ('PAYIN', 'PAYOUT');

DELETE FROM "IdempotencyRecord"
 WHERE scope IN ('PAYIN', 'PAYOUT');

DELETE FROM "LedgerEntry"
 WHERE "ledgerTxnId" IN (
   SELECT id FROM "LedgerTransaction"
    WHERE ref LIKE 'payin:%' OR ref LIKE 'payout-hold:%' OR ref LIKE 'payout-reversal:%'
 );

DELETE FROM "LedgerTransaction"
 WHERE ref LIKE 'payin:%' OR ref LIKE 'payout-hold:%' OR ref LIKE 'payout-reversal:%';

DELETE FROM "Transaction"
 WHERE kind IN ('PAYIN', 'PAYOUT');

COMMIT;

SELECT 'transactions_left' AS what, count(*)::text AS n FROM "Transaction" WHERE kind IN ('PAYIN', 'PAYOUT')
UNION ALL
SELECT 'seed_funding', count(*)::text FROM "LedgerTransaction" WHERE ref = 'seed:trustsetu-funding';
