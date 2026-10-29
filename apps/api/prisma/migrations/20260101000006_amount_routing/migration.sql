-- Amount-band routing: multiple active APIs, each with a Min–Max range
ALTER TABLE "RoutingRule" ADD COLUMN "minAmountPaise" BIGINT;
ALTER TABLE "RoutingRule" ADD COLUMN "maxAmountPaise" BIGINT;
DROP INDEX IF EXISTS "RoutingRule_productCode_merchantId_idx";
CREATE INDEX "RoutingRule_productCode_merchantId_isActive_idx" ON "RoutingRule"("productCode", "merchantId", "isActive");
