ALTER TABLE "Customer"
ADD COLUMN "mfaRequired" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "mfaTotpEnrolled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "mfaEmailOtpEnrolled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "mfaTotpSecret" TEXT,
ADD COLUMN "mfaPendingTotpSecret" TEXT,
ADD COLUMN "mfaPendingTotpIssuedAt" TIMESTAMP(3),
ADD COLUMN "mfaActiveChallenge" JSONB,
ADD COLUMN "mfaLastVerifiedAt" TIMESTAMP(3);
