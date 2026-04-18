ALTER TABLE "GovernedTreasuryExecutionRequest"
ADD COLUMN "claimedByExecutorId" TEXT,
ADD COLUMN "executorClaimedAt" TIMESTAMP(3),
ADD COLUMN "executorClaimExpiresAt" TIMESTAMP(3),
ADD COLUMN "executorReceiptSubmittedAt" TIMESTAMP(3);

CREATE INDEX "GovernedTreasuryExecutionRequest_environment_executorClaimExpiresAt_requestedAt_idx"
ON "GovernedTreasuryExecutionRequest"("environment", "executorClaimExpiresAt", "requestedAt");
