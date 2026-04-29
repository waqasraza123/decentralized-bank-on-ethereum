ALTER TABLE "SolvencyReportAnchor"
ADD COLUMN "submittedByWorkerId" TEXT,
ADD COLUMN "confirmedByWorkerId" TEXT,
ADD COLUMN "failedByWorkerId" TEXT;

CREATE INDEX "SolvencyReportAnchor_status_submittedAt_idx"
ON "SolvencyReportAnchor"("status", "submittedAt");
