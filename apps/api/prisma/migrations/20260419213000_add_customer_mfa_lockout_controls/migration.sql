ALTER TABLE "Customer"
ADD COLUMN "mfaFailedAttemptCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "mfaLockedUntil" TIMESTAMP(3),
ADD COLUMN "mfaLastChallengeStartedAt" TIMESTAMP(3);
