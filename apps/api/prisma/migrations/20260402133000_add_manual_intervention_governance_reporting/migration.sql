ALTER TABLE "TransactionIntent"
ADD COLUMN "manualResolvedByOperatorId" TEXT,
ADD COLUMN "manualResolutionOperatorRole" TEXT,
ADD COLUMN "manualResolutionReviewCaseId" TEXT;

CREATE INDEX "TransactionIntent_manualResolvedByOperatorId_manuallyResolv_idx"
ON "TransactionIntent"("manualResolvedByOperatorId", "manuallyResolvedAt");

CREATE INDEX "TransactionIntent_manualResolutionReasonCode_manuallyResolv_idx"
ON "TransactionIntent"("manualResolutionReasonCode", "manuallyResolvedAt");
