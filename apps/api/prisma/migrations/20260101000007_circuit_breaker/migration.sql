-- Auto circuit-breaker: skip unhealthy providers for NEW payments only
ALTER TABLE "Provider" ADD COLUMN "healthFailures" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Provider" ADD COLUMN "circuitOpenUntil" TIMESTAMP(3);
