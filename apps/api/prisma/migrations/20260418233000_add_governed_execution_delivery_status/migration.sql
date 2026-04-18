CREATE TYPE "GovernedTreasuryExecutionDeliveryStatus" AS ENUM ('not_delivered', 'accepted_by_executor', 'delivery_failed');

ALTER TABLE "GovernedTreasuryExecutionRequest"
  ADD COLUMN "deliveryStatus" "GovernedTreasuryExecutionDeliveryStatus" NOT NULL DEFAULT 'not_delivered',
  ADD COLUMN "deliveryAttemptedAt" TIMESTAMP(3),
  ADD COLUMN "deliveryAcceptedAt" TIMESTAMP(3),
  ADD COLUMN "deliveredByWorkerId" TEXT,
  ADD COLUMN "deliveryBackendType" TEXT,
  ADD COLUMN "deliveryBackendReference" TEXT,
  ADD COLUMN "deliveryHttpStatus" INTEGER,
  ADD COLUMN "deliveryFailureReason" TEXT;

CREATE INDEX "GovernedTreasuryExecutionRequest_environment_deliveryStatus_requestedAt_idx"
ON "GovernedTreasuryExecutionRequest"("environment", "deliveryStatus", "requestedAt");
