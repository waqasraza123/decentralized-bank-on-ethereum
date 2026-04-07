ALTER TABLE "PlatformAlert"
ADD COLUMN "ownerOperatorId" TEXT,
ADD COLUMN "ownerAssignedAt" TIMESTAMP(3),
ADD COLUMN "ownerAssignedByOperatorId" TEXT,
ADD COLUMN "ownershipNote" TEXT,
ADD COLUMN "acknowledgedAt" TIMESTAMP(3),
ADD COLUMN "acknowledgedByOperatorId" TEXT,
ADD COLUMN "acknowledgementNote" TEXT,
ADD COLUMN "suppressedUntil" TIMESTAMP(3),
ADD COLUMN "suppressedByOperatorId" TEXT,
ADD COLUMN "suppressionNote" TEXT;

CREATE INDEX "PlatformAlert_status_ownerOperatorId_updatedAt_idx"
ON "PlatformAlert"("status", "ownerOperatorId", "updatedAt");

CREATE INDEX "PlatformAlert_status_acknowledgedAt_updatedAt_idx"
ON "PlatformAlert"("status", "acknowledgedAt", "updatedAt");

CREATE INDEX "PlatformAlert_status_suppressedUntil_updatedAt_idx"
ON "PlatformAlert"("status", "suppressedUntil", "updatedAt");
