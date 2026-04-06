CREATE TYPE "LedgerReconciliationScanTriggerSource" AS ENUM (
  'operator',
  'worker',
  'system'
);

CREATE TYPE "LedgerReconciliationScanRunStatus" AS ENUM (
  'running',
  'succeeded',
  'failed'
);

CREATE TYPE "WorkerRuntimeIterationStatus" AS ENUM (
  'running',
  'succeeded',
  'failed'
);

CREATE TYPE "WorkerRuntimeEnvironment" AS ENUM (
  'development',
  'test',
  'production'
);

CREATE TYPE "WorkerRuntimeExecutionMode" AS ENUM (
  'monitor',
  'synthetic',
  'managed'
);

CREATE TABLE "LedgerReconciliationScanRun" (
  "id" TEXT NOT NULL,
  "triggerSource" "LedgerReconciliationScanTriggerSource" NOT NULL,
  "status" "LedgerReconciliationScanRunStatus" NOT NULL DEFAULT 'running',
  "requestedScope" "LedgerReconciliationMismatchScope",
  "customerAccountId" TEXT,
  "transactionIntentId" TEXT,
  "triggeredByOperatorId" TEXT,
  "triggeredByWorkerId" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "durationMs" INTEGER,
  "createdCount" INTEGER NOT NULL DEFAULT 0,
  "reopenedCount" INTEGER NOT NULL DEFAULT 0,
  "refreshedCount" INTEGER NOT NULL DEFAULT 0,
  "autoResolvedCount" INTEGER NOT NULL DEFAULT 0,
  "activeMismatchCount" INTEGER NOT NULL DEFAULT 0,
  "errorCode" TEXT,
  "errorMessage" TEXT,
  "resultSnapshot" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "LedgerReconciliationScanRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorkerRuntimeHeartbeat" (
  "id" TEXT NOT NULL,
  "workerId" TEXT NOT NULL,
  "environment" "WorkerRuntimeEnvironment" NOT NULL,
  "executionMode" "WorkerRuntimeExecutionMode" NOT NULL,
  "lastIterationStatus" "WorkerRuntimeIterationStatus" NOT NULL,
  "lastHeartbeatAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastIterationStartedAt" TIMESTAMP(3),
  "lastIterationCompletedAt" TIMESTAMP(3),
  "consecutiveFailureCount" INTEGER NOT NULL DEFAULT 0,
  "lastErrorCode" TEXT,
  "lastErrorMessage" TEXT,
  "lastReconciliationScanRunId" TEXT,
  "lastReconciliationScanStartedAt" TIMESTAMP(3),
  "lastReconciliationScanCompletedAt" TIMESTAMP(3),
  "lastReconciliationScanStatus" "LedgerReconciliationScanRunStatus",
  "runtimeMetadata" JSONB,
  "latestIterationMetrics" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "WorkerRuntimeHeartbeat_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkerRuntimeHeartbeat_workerId_key"
ON "WorkerRuntimeHeartbeat"("workerId");

CREATE INDEX "LedgerReconciliationScanRun_status_startedAt_idx"
ON "LedgerReconciliationScanRun"("status", "startedAt");

CREATE INDEX "LedgerReconciliationScanRun_triggerSource_startedAt_idx"
ON "LedgerReconciliationScanRun"("triggerSource", "startedAt");

CREATE INDEX "LedgerReconciliationScanRun_requestedScope_startedAt_idx"
ON "LedgerReconciliationScanRun"("requestedScope", "startedAt");

CREATE INDEX "LedgerReconciliationScanRun_customerAccountId_startedAt_idx"
ON "LedgerReconciliationScanRun"("customerAccountId", "startedAt");

CREATE INDEX "LedgerReconciliationScanRun_transactionIntentId_startedAt_idx"
ON "LedgerReconciliationScanRun"("transactionIntentId", "startedAt");

CREATE INDEX "LedgerReconciliationScanRun_triggeredByWorkerId_startedAt_idx"
ON "LedgerReconciliationScanRun"("triggeredByWorkerId", "startedAt");

CREATE INDEX "WorkerRuntimeHeartbeat_lastHeartbeatAt_idx"
ON "WorkerRuntimeHeartbeat"("lastHeartbeatAt");

CREATE INDEX "WorkerRuntimeHeartbeat_lastIterationStatus_lastHeartbeatAt_idx"
ON "WorkerRuntimeHeartbeat"("lastIterationStatus", "lastHeartbeatAt");

CREATE INDEX "WorkerRuntimeHeartbeat_executionMode_lastHeartbeatAt_idx"
ON "WorkerRuntimeHeartbeat"("executionMode", "lastHeartbeatAt");

CREATE INDEX "WorkerRuntimeHeartbeat_lastReconciliationScanStatus_lastHeartbea_idx"
ON "WorkerRuntimeHeartbeat"("lastReconciliationScanStatus", "lastHeartbeatAt");
