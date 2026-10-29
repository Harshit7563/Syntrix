-- Config-driven generic providers: any PG / wallet / bank API can be added from the portal, no code deploy
ALTER TABLE "Provider" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'PG';
ALTER TABLE "Provider" ADD COLUMN "config" JSONB;
