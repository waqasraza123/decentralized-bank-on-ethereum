ALTER TABLE "CustomerAccount"
ADD COLUMN "restrictedFromStatus" "AccountLifecycleStatus",
ADD COLUMN "restrictionReasonCode" TEXT,
ADD COLUMN "restrictedByOperatorId" TEXT,
ADD COLUMN "restrictedByOversightIncidentId" TEXT,
ADD COLUMN "restrictionReleasedAt" TIMESTAMP(3),
ADD COLUMN "restrictionReleasedByOperatorId" TEXT;

CREATE INDEX "CustomerAccount_restrictedByOversightIncidentId_idx"
ON "CustomerAccount"("restrictedByOversightIncidentId");

ALTER TYPE "OversightIncidentEventType"
ADD VALUE IF NOT EXISTS 'account_restriction_applied';

ALTER TYPE "OversightIncidentEventType"
ADD VALUE IF NOT EXISTS 'account_restriction_released';
