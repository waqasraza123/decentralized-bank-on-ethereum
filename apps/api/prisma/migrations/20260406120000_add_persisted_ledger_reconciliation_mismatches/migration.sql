CREATE TYPE "LedgerReconciliationMismatchScope" AS ENUM (
  'transaction_intent',
  'customer_balance'
);

CREATE TYPE "LedgerReconciliationMismatchStatus" AS ENUM (
  'open',
  'resolved',
  'dismissed'
);

CREATE TYPE "LedgerReconciliationMismatchSeverity" AS ENUM (
  'warning',
  'critical'
);

CREATE TYPE "LedgerReconciliationMismatchRecommendedAction" AS ENUM (
  'none',
  'replay_confirm',
  'replay_settle',
  'open_review_case',
  'repair_customer_balance'
);

CREATE TABLE "LedgerReconciliationMismatch" (
  "id" TEXT NOT NULL,
  "mismatchKey" TEXT NOT NULL,
  "scope" "LedgerReconciliationMismatchScope" NOT NULL,
  "status" "LedgerReconciliationMismatchStatus" NOT NULL DEFAULT 'open',
  "severity" "LedgerReconciliationMismatchSeverity" NOT NULL,
  "recommendedAction" "LedgerReconciliationMismatchRecommendedAction" NOT NULL DEFAULT 'none',
  "reasonCode" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "chainId" INTEGER NOT NULL,
  "customerId" TEXT,
  "customerAccountId" TEXT,
  "transactionIntentId" TEXT,
  "assetId" TEXT,
  "linkedReviewCaseId" TEXT,
  "latestSnapshot" JSONB NOT NULL,
  "resolutionMetadata" JSONB,
  "resolutionNote" TEXT,
  "detectionCount" INTEGER NOT NULL DEFAULT 1,
  "firstDetectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastDetectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  "resolvedByOperatorId" TEXT,
  "dismissedAt" TIMESTAMP(3),
  "dismissedByOperatorId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "LedgerReconciliationMismatch_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LedgerReconciliationMismatch_mismatchKey_key"
ON "LedgerReconciliationMismatch"("mismatchKey");

CREATE INDEX "LedgerReconciliationMismatch_status_updatedAt_idx"
ON "LedgerReconciliationMismatch"("status", "updatedAt");

CREATE INDEX "LedgerReconciliationMismatch_scope_status_updatedAt_idx"
ON "LedgerReconciliationMismatch"("scope", "status", "updatedAt");

CREATE INDEX "LedgerReconciliationMismatch_reasonCode_status_idx"
ON "LedgerReconciliationMismatch"("reasonCode", "status");

CREATE INDEX "LedgerReconciliationMismatch_recommendedAction_status_idx"
ON "LedgerReconciliationMismatch"("recommendedAction", "status");

CREATE INDEX "LedgerReconciliationMismatch_customerAccountId_status_idx"
ON "LedgerReconciliationMismatch"("customerAccountId", "status");

CREATE INDEX "LedgerReconciliationMismatch_transactionIntentId_status_idx"
ON "LedgerReconciliationMismatch"("transactionIntentId", "status");

CREATE INDEX "LedgerReconciliationMismatch_assetId_status_idx"
ON "LedgerReconciliationMismatch"("assetId", "status");

CREATE INDEX "LedgerReconciliationMismatch_chainId_scope_status_idx"
ON "LedgerReconciliationMismatch"("chainId", "scope", "status");

CREATE INDEX "LedgerReconciliationMismatch_linkedReviewCaseId_idx"
ON "LedgerReconciliationMismatch"("linkedReviewCaseId");

ALTER TABLE "LedgerReconciliationMismatch"
ADD CONSTRAINT "LedgerReconciliationMismatch_customerId_fkey"
FOREIGN KEY ("customerId")
REFERENCES "Customer"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

ALTER TABLE "LedgerReconciliationMismatch"
ADD CONSTRAINT "LedgerReconciliationMismatch_customerAccountId_fkey"
FOREIGN KEY ("customerAccountId")
REFERENCES "CustomerAccount"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

ALTER TABLE "LedgerReconciliationMismatch"
ADD CONSTRAINT "LedgerReconciliationMismatch_transactionIntentId_fkey"
FOREIGN KEY ("transactionIntentId")
REFERENCES "TransactionIntent"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

ALTER TABLE "LedgerReconciliationMismatch"
ADD CONSTRAINT "LedgerReconciliationMismatch_assetId_fkey"
FOREIGN KEY ("assetId")
REFERENCES "Asset"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

ALTER TABLE "LedgerReconciliationMismatch"
ADD CONSTRAINT "LedgerReconciliationMismatch_linkedReviewCaseId_fkey"
FOREIGN KEY ("linkedReviewCaseId")
REFERENCES "ReviewCase"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;
