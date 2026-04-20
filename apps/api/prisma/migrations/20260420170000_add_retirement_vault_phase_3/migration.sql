ALTER TYPE "RetirementVaultReleaseRequestStatus"
ADD VALUE IF NOT EXISTS 'cooldown_active';

ALTER TYPE "RetirementVaultReleaseRequestStatus"
ADD VALUE IF NOT EXISTS 'ready_for_release';

ALTER TYPE "RetirementVaultReleaseRequestStatus"
ADD VALUE IF NOT EXISTS 'executing';

ALTER TYPE "RetirementVaultReleaseRequestStatus"
ADD VALUE IF NOT EXISTS 'failed';

CREATE TYPE "RetirementVaultReleaseRequestKind" AS ENUM (
  'scheduled_unlock',
  'early_unlock'
);

ALTER TYPE "RetirementVaultEventType"
ADD VALUE IF NOT EXISTS 'release_review_required';

ALTER TYPE "RetirementVaultEventType"
ADD VALUE IF NOT EXISTS 'release_approved';

ALTER TYPE "RetirementVaultEventType"
ADD VALUE IF NOT EXISTS 'release_rejected';

ALTER TYPE "RetirementVaultEventType"
ADD VALUE IF NOT EXISTS 'release_cancelled';

ALTER TYPE "RetirementVaultEventType"
ADD VALUE IF NOT EXISTS 'cooldown_started';

ALTER TYPE "RetirementVaultEventType"
ADD VALUE IF NOT EXISTS 'cooldown_completed';

ALTER TYPE "RetirementVaultEventType"
ADD VALUE IF NOT EXISTS 'released';

ALTER TYPE "RetirementVaultEventType"
ADD VALUE IF NOT EXISTS 'release_failed';

ALTER TYPE "LedgerJournalType"
ADD VALUE IF NOT EXISTS 'retirement_vault_release';

ALTER TABLE "RetirementVaultReleaseRequest"
ADD COLUMN "requestKind" "RetirementVaultReleaseRequestKind" NOT NULL DEFAULT 'scheduled_unlock',
ADD COLUMN "evidence" JSONB,
ADD COLUMN "requestedByActorType" TEXT NOT NULL DEFAULT 'customer',
ADD COLUMN "requestedByActorId" TEXT,
ADD COLUMN "reviewCaseId" TEXT,
ADD COLUMN "transactionIntentId" TEXT,
ADD COLUMN "reviewRequiredAt" TIMESTAMP(3),
ADD COLUMN "reviewDecidedAt" TIMESTAMP(3),
ADD COLUMN "cooldownStartedAt" TIMESTAMP(3),
ADD COLUMN "readyForReleaseAt" TIMESTAMP(3),
ADD COLUMN "approvedByOperatorId" TEXT,
ADD COLUMN "approvedByOperatorRole" TEXT,
ADD COLUMN "rejectedByOperatorId" TEXT,
ADD COLUMN "rejectedByOperatorRole" TEXT,
ADD COLUMN "cancelledAt" TIMESTAMP(3),
ADD COLUMN "cancelledByActorType" TEXT,
ADD COLUMN "cancelledByActorId" TEXT,
ADD COLUMN "executionStartedAt" TIMESTAMP(3),
ADD COLUMN "executedByWorkerId" TEXT,
ADD COLUMN "executionFailureCode" TEXT,
ADD COLUMN "executionFailureReason" TEXT;

CREATE UNIQUE INDEX "RetirementVaultReleaseRequest_transactionIntentId_key"
ON "RetirementVaultReleaseRequest"("transactionIntentId");

CREATE INDEX "RetirementVaultReleaseRequest_status_readyForReleaseAt_idx"
ON "RetirementVaultReleaseRequest"("status", "readyForReleaseAt");

CREATE INDEX "RetirementVaultReleaseRequest_reviewCaseId_idx"
ON "RetirementVaultReleaseRequest"("reviewCaseId");

ALTER TABLE "RetirementVaultReleaseRequest"
ADD CONSTRAINT "RetirementVaultReleaseRequest_reviewCaseId_fkey"
FOREIGN KEY ("reviewCaseId") REFERENCES "ReviewCase"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "RetirementVaultReleaseRequest"
ADD CONSTRAINT "RetirementVaultReleaseRequest_transactionIntentId_fkey"
FOREIGN KEY ("transactionIntentId") REFERENCES "TransactionIntent"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
