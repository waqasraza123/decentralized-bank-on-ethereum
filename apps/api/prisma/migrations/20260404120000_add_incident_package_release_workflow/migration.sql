CREATE TYPE "IncidentPackageExportMode" AS ENUM (
  internal_full,
  redaction_ready,
  compliance_focused
);

CREATE TYPE "IncidentPackageReleaseTarget" AS ENUM (
  internal_casefile,
  compliance_handoff,
  regulator_response,
  external_counsel
);

CREATE TYPE "CustomerAccountIncidentPackageReleaseStatus" AS ENUM (
  pending_approval,
  approved,
  rejected,
  released,
  expired
);

CREATE TABLE "CustomerAccountIncidentPackageRelease" (
  "id" TEXT NOT NULL,
  "customerAccountId" TEXT NOT NULL,
  "status" "CustomerAccountIncidentPackageReleaseStatus" NOT NULL DEFAULT pending_approval,
  "exportMode" "IncidentPackageExportMode" NOT NULL,
  "releaseTarget" "IncidentPackageReleaseTarget" NOT NULL,
  "releaseReasonCode" TEXT NOT NULL,
  "requestedByOperatorId" TEXT NOT NULL,
  "requestedByOperatorRole" TEXT,
  "approvedByOperatorId" TEXT,
  "approvedByOperatorRole" TEXT,
  "rejectedByOperatorId" TEXT,
  "rejectedByOperatorRole" TEXT,
  "releasedByOperatorId" TEXT,
  "releasedByOperatorRole" TEXT,
  "requestNote" TEXT,
  "approvalNote" TEXT,
  "rejectionNote" TEXT,
  "releaseNote" TEXT,
  "artifactChecksumSha256" TEXT NOT NULL,
  "artifactPayload" JSONB NOT NULL,
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "approvedAt" TIMESTAMP(3),
  "rejectedAt" TIMESTAMP(3),
  "releasedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CustomerAccountIncidentPackageRelease_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CustomerAccountIncidentPackageRelease_customerAccountId_status_idx"
ON "CustomerAccountIncidentPackageRelease"("customerAccountId", "status");

CREATE INDEX "CustomerAccountIncidentPackageRelease_status_requestedAt_idx"
ON "CustomerAccountIncidentPackageRelease"("status", "requestedAt");

CREATE INDEX "CustomerAccountIncidentPackageRelease_status_approvedAt_idx"
ON "CustomerAccountIncidentPackageRelease"("status", "approvedAt");

CREATE INDEX "CustomerAccountIncidentPackageRelease_status_releasedAt_idx"
ON "CustomerAccountIncidentPackageRelease"("status", "releasedAt");

CREATE INDEX "CustomerAccountIncidentPackageRelease_exportMode_status_idx"
ON "CustomerAccountIncidentPackageRelease"("exportMode", "status");

CREATE INDEX "CustomerAccountIncidentPackageRelease_releaseTarget_status_idx"
ON "CustomerAccountIncidentPackageRelease"("releaseTarget", "status");

CREATE INDEX "CustomerAccountIncidentPackageRelease_requestedByOperatorId_req_idx"
ON "CustomerAccountIncidentPackageRelease"("requestedByOperatorId", "requestedAt");

CREATE INDEX "CustomerAccountIncidentPackageRelease_approvedByOperatorId_app_idx"
ON "CustomerAccountIncidentPackageRelease"("approvedByOperatorId", "approvedAt");

CREATE INDEX "CustomerAccountIncidentPackageRelease_releasedByOperatorId_rel_idx"
ON "CustomerAccountIncidentPackageRelease"("releasedByOperatorId", "releasedAt");

ALTER TABLE "CustomerAccountIncidentPackageRelease"
ADD CONSTRAINT "CustomerAccountIncidentPackageRelease_customerAccountId_fkey"
FOREIGN KEY ("customerAccountId")
REFERENCES "CustomerAccount"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;
