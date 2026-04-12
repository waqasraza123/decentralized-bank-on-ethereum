ALTER TABLE "TransactionIntent"
ADD COLUMN "executionClaimedAt" TIMESTAMP(3),
ADD COLUMN "executionClaimedByWorkerId" TEXT;

CREATE INDEX "TransactionIntent_status_executionClaimedAt_idx"
ON "TransactionIntent"("status", "executionClaimedAt");
