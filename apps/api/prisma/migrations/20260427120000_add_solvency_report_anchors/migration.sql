CREATE TYPE "SolvencyReportAnchorStatus" AS ENUM (
  'requested',
  'submitted',
  'confirmed',
  'failed'
);

CREATE TABLE "SolvencyReportAnchor" (
  "id" TEXT NOT NULL,
  "reportId" TEXT NOT NULL,
  "environment" "WorkerRuntimeEnvironment" NOT NULL,
  "chainId" INTEGER NOT NULL,
  "status" "SolvencyReportAnchorStatus" NOT NULL DEFAULT 'requested',
  "anchorPayload" JSONB NOT NULL,
  "anchorPayloadText" TEXT NOT NULL,
  "anchorPayloadHash" TEXT NOT NULL,
  "anchorPayloadChecksumSha256" TEXT NOT NULL,
  "anchorNote" TEXT,
  "requestedByOperatorId" TEXT NOT NULL,
  "requestedByOperatorRole" TEXT,
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "submittedByOperatorId" TEXT,
  "submittedByOperatorRole" TEXT,
  "submittedAt" TIMESTAMP(3),
  "txHash" TEXT,
  "contractAddress" TEXT,
  "blockNumber" INTEGER,
  "logIndex" INTEGER,
  "confirmedByOperatorId" TEXT,
  "confirmedByOperatorRole" TEXT,
  "confirmedAt" TIMESTAMP(3),
  "failedByOperatorId" TEXT,
  "failedByOperatorRole" TEXT,
  "failureReason" TEXT,
  "failedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SolvencyReportAnchor_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SolvencyReportAnchor_reportId_anchorPayloadHash_key"
ON "SolvencyReportAnchor"("reportId", "anchorPayloadHash");

CREATE INDEX "SolvencyReportAnchor_environment_status_requestedAt_idx"
ON "SolvencyReportAnchor"("environment", "status", "requestedAt");

CREATE INDEX "SolvencyReportAnchor_chainId_txHash_idx"
ON "SolvencyReportAnchor"("chainId", "txHash");

CREATE INDEX "SolvencyReportAnchor_reportId_status_requestedAt_idx"
ON "SolvencyReportAnchor"("reportId", "status", "requestedAt");

ALTER TABLE "SolvencyReportAnchor"
ADD CONSTRAINT "SolvencyReportAnchor_reportId_fkey"
FOREIGN KEY ("reportId") REFERENCES "SolvencyReport"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
