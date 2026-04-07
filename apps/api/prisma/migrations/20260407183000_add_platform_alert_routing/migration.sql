CREATE TYPE "PlatformAlertRoutingStatus" AS ENUM (
  'unrouted',
  'routed'
);

CREATE TYPE "PlatformAlertRoutingTargetType" AS ENUM (
  'review_case'
);

ALTER TABLE "PlatformAlert"
ADD COLUMN "routingStatus" "PlatformAlertRoutingStatus" NOT NULL DEFAULT 'unrouted',
ADD COLUMN "routingTargetType" "PlatformAlertRoutingTargetType",
ADD COLUMN "routingTargetId" TEXT,
ADD COLUMN "routedAt" TIMESTAMP(3),
ADD COLUMN "routedByOperatorId" TEXT,
ADD COLUMN "routingNote" TEXT;

CREATE INDEX "PlatformAlert_status_routingStatus_updatedAt_idx"
ON "PlatformAlert"("status", "routingStatus", "updatedAt");
