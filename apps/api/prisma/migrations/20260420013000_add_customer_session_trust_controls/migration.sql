ALTER TABLE "CustomerAuthSession"
ADD COLUMN "trustedAt" TIMESTAMP(3),
ADD COLUMN "trustChallengeCodeHash" TEXT,
ADD COLUMN "trustChallengeExpiresAt" TIMESTAMP(3),
ADD COLUMN "trustChallengeSentAt" TIMESTAMP(3);
