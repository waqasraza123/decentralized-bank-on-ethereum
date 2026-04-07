CREATE TYPE "PlatformAlertDeliveryEventType" AS ENUM (
  'opened',
  'reopened',
  'routed_to_review_case',
  'owner_assigned',
  'acknowledged',
  'suppressed',
  'suppression_cleared'
);

CREATE TYPE "PlatformAlertDeliveryStatus" AS ENUM (
  'pending',
  'succeeded',
  'failed'
);

CREATE TABLE "PlatformAlertDelivery" (
  "id" TEXT NOT NULL,
  "platformAlertId" TEXT NOT NULL,
  "targetName" TEXT NOT NULL,
  "targetUrl" TEXT NOT NULL,
  "eventType" "PlatformAlertDeliveryEventType" NOT NULL,
  "status" "PlatformAlertDeliveryStatus" NOT NULL DEFAULT 'pending',
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "requestPayload" JSONB NOT NULL,
  "responseStatusCode" INTEGER,
  "errorMessage" TEXT,
  "lastAttemptedAt" TIMESTAMP(3),
  "deliveredAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PlatformAlertDelivery_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PlatformAlertDelivery_platformAlertId_createdAt_idx"
ON "PlatformAlertDelivery"("platformAlertId", "createdAt");

CREATE INDEX "PlatformAlertDelivery_status_createdAt_idx"
ON "PlatformAlertDelivery"("status", "createdAt");

CREATE INDEX "PlatformAlertDelivery_targetName_status_createdAt_idx"
ON "PlatformAlertDelivery"("targetName", "status", "createdAt");

ALTER TABLE "PlatformAlertDelivery"
ADD CONSTRAINT "PlatformAlertDelivery_platformAlertId_fkey"
FOREIGN KEY ("platformAlertId") REFERENCES "PlatformAlert"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
