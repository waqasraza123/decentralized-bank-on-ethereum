CREATE TYPE "PlatformAlertCategory" AS ENUM (
  'worker',
  'reconciliation',
  'queue',
  'chain',
  'treasury'
);

CREATE TYPE "PlatformAlertSeverity" AS ENUM (
  'warning',
  'critical'
);

CREATE TYPE "PlatformAlertStatus" AS ENUM (
  'open',
  'resolved'
);

CREATE TABLE "PlatformAlert" (
  "id" TEXT NOT NULL,
  "dedupeKey" TEXT NOT NULL,
  "category" "PlatformAlertCategory" NOT NULL,
  "severity" "PlatformAlertSeverity" NOT NULL,
  "status" "PlatformAlertStatus" NOT NULL DEFAULT 'open',
  "code" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "detail" TEXT,
  "metadata" JSONB,
  "firstDetectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastDetectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PlatformAlert_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PlatformAlert_dedupeKey_key"
ON "PlatformAlert"("dedupeKey");

CREATE INDEX "PlatformAlert_status_severity_updatedAt_idx"
ON "PlatformAlert"("status", "severity", "updatedAt");

CREATE INDEX "PlatformAlert_category_status_updatedAt_idx"
ON "PlatformAlert"("category", "status", "updatedAt");

CREATE INDEX "PlatformAlert_code_status_updatedAt_idx"
ON "PlatformAlert"("code", "status", "updatedAt");

CREATE INDEX "PlatformAlert_lastDetectedAt_idx"
ON "PlatformAlert"("lastDetectedAt");
