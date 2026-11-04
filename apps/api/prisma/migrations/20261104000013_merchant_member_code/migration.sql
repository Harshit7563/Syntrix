-- AlterTable
ALTER TABLE "MerchantProfile" ADD COLUMN "memberCode" TEXT;
CREATE UNIQUE INDEX "MerchantProfile_memberCode_key" ON "MerchantProfile"("memberCode");
