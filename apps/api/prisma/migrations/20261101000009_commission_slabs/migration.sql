-- CreateTable
CREATE TABLE "CommissionSlab" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "productCode" TEXT NOT NULL,
    "minAmountPaise" BIGINT NOT NULL DEFAULT 0,
    "maxAmountPaise" BIGINT,
    "feeBps" INTEGER NOT NULL DEFAULT 0,
    "feeFlatPaise" BIGINT NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommissionSlab_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CommissionSlab_merchantId_productCode_isActive_idx" ON "CommissionSlab"("merchantId", "productCode", "isActive");

-- AddForeignKey
ALTER TABLE "CommissionSlab" ADD CONSTRAINT "CommissionSlab_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "MerchantProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
