-- Payout Shield: scoped keys + signed payout requests
ALTER TABLE "ApiCredential" ADD COLUMN "scopes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "ApiCredential" ADD COLUMN "signingSecretEnc" TEXT;
ALTER TABLE "ApiCredential" ADD COLUMN "requireSigning" BOOLEAN NOT NULL DEFAULT false;
