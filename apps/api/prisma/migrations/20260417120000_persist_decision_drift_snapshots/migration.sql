ALTER TABLE "ReleaseReadinessApproval"
ADD COLUMN "decisionDriftSnapshot" JSONB,
ADD COLUMN "decisionDriftCapturedAt" TIMESTAMP(3);
