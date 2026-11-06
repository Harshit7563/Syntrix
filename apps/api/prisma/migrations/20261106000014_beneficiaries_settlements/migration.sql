-- AlterTable
ALTER TABLE "MerchantProfile" ADD COLUMN "settlementDays" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "Beneficiary" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "accountEnc" TEXT NOT NULL,
    "accountLast4" TEXT NOT NULL,
    "accountFingerprint" TEXT NOT NULL,
    "ifsc" TEXT NOT NULL,
    "mobile" TEXT,
    "email" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Beneficiary_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Beneficiary_merchantId_accountFingerprint_key" ON "Beneficiary"("merchantId", "accountFingerprint");
CREATE INDEX "Beneficiary_merchantId_status_idx" ON "Beneficiary"("merchantId", "status");
ALTER TABLE "Beneficiary" ADD CONSTRAINT "Beneficiary_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "MerchantProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "SettlementBatch" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "settlementDays" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "amountPaise" BIGINT NOT NULL DEFAULT 0,
    "txnCount" INTEGER NOT NULL DEFAULT 0,
    "requestedBy" TEXT,
    "approvedBy" TEXT,
    "reason" TEXT,
    "postedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SettlementBatch_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SettlementBatch_merchantId_status_idx" ON "SettlementBatch"("merchantId", "status");
ALTER TABLE "SettlementBatch" ADD CONSTRAINT "SettlementBatch_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "MerchantProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "SettlementItem" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "amountPaise" BIGINT NOT NULL,

    CONSTRAINT "SettlementItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SettlementItem_transactionId_key" ON "SettlementItem"("transactionId");
CREATE INDEX "SettlementItem_batchId_idx" ON "SettlementItem"("batchId");
ALTER TABLE "SettlementItem" ADD CONSTRAINT "SettlementItem_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "SettlementBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SettlementItem" ADD CONSTRAINT "SettlementItem_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON UPDATE CASCADE;
