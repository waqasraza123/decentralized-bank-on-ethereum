ALTER TYPE "RetirementVaultEventType"
ADD VALUE IF NOT EXISTS 'restricted';

ALTER TYPE "RetirementVaultEventType"
ADD VALUE IF NOT EXISTS 'restriction_released';

ALTER TABLE "RetirementVault"
ADD COLUMN "restrictedAt" TIMESTAMP(3),
ADD COLUMN "restrictionReasonCode" TEXT,
ADD COLUMN "restrictedByOperatorId" TEXT,
ADD COLUMN "restrictedByOperatorRole" TEXT,
ADD COLUMN "restrictedByOversightIncidentId" TEXT,
ADD COLUMN "restrictionNote" TEXT,
ADD COLUMN "restrictionReleasedAt" TIMESTAMP(3),
ADD COLUMN "restrictionReleasedByOperatorId" TEXT,
ADD COLUMN "restrictionReleasedByOperatorRole" TEXT,
ADD COLUMN "restrictionReleaseNote" TEXT;

CREATE INDEX "RetirementVault_restrictedByOversightIncidentId_idx"
ON "RetirementVault"("restrictedByOversightIncidentId");
