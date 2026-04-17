CREATE TYPE "WithdrawalExecutionFailureCategory" AS ENUM (
  'retryable',
  'permanent',
  'manual_intervention_required'
);

ALTER TABLE "TransactionIntent"
ADD COLUMN "executionFailureCategory" "WithdrawalExecutionFailureCategory",
ADD COLUMN "executionFailureObservedAt" TIMESTAMP(3),
ADD COLUMN "manualInterventionRequiredAt" TIMESTAMP(3),
ADD COLUMN "manualInterventionReviewCaseId" TEXT;

ALTER TABLE "BlockchainTransaction"
ADD COLUMN "broadcastAt" TIMESTAMP(3);

CREATE INDEX "TransactionIntent_executionFailureCategory_updatedAt_idx"
ON "TransactionIntent"("executionFailureCategory", "updatedAt");

CREATE INDEX "TransactionIntent_manualInterventionRequiredAt_updatedAt_idx"
ON "TransactionIntent"("manualInterventionRequiredAt", "updatedAt");

CREATE INDEX "TransactionIntent_manualInterventionReviewCaseId_idx"
ON "TransactionIntent"("manualInterventionReviewCaseId");

ALTER TABLE "TransactionIntent"
ADD CONSTRAINT "TransactionIntent_manualInterventionReviewCaseId_fkey"
FOREIGN KEY ("manualInterventionReviewCaseId") REFERENCES "ReviewCase"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
