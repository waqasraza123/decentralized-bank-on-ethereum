CREATE TYPE "RetirementVaultStatus" AS ENUM (
  'active',
  'restricted',
  'released'
);

CREATE TYPE "RetirementVaultReleaseRequestStatus" AS ENUM (
  'requested',
  'review_required',
  'approved',
  'rejected',
  'released',
  'cancelled'
);

CREATE TYPE "RetirementVaultEventType" AS ENUM (
  'created',
  'funded',
  'release_requested'
);

ALTER TYPE "LedgerAccountType"
ADD VALUE IF NOT EXISTS 'customer_retirement_vault_liability';

ALTER TYPE "LedgerJournalType"
ADD VALUE IF NOT EXISTS 'retirement_vault_funding';

CREATE TABLE "RetirementVault" (
  "id" TEXT NOT NULL,
  "customerAccountId" TEXT NOT NULL,
  "assetId" TEXT NOT NULL,
  "status" "RetirementVaultStatus" NOT NULL DEFAULT 'active',
  "strictMode" BOOLEAN NOT NULL DEFAULT false,
  "unlockAt" TIMESTAMP(3) NOT NULL,
  "lockedBalance" DECIMAL(36,18) NOT NULL DEFAULT 0,
  "fundedAt" TIMESTAMP(3),
  "lastFundedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "RetirementVault_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RetirementVaultReleaseRequest" (
  "id" TEXT NOT NULL,
  "retirementVaultId" TEXT NOT NULL,
  "requestedAmount" DECIMAL(36,18) NOT NULL,
  "status" "RetirementVaultReleaseRequestStatus" NOT NULL DEFAULT 'requested',
  "reasonCode" TEXT,
  "reasonNote" TEXT,
  "cooldownEndsAt" TIMESTAMP(3),
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "approvedAt" TIMESTAMP(3),
  "rejectedAt" TIMESTAMP(3),
  "releasedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "RetirementVaultReleaseRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RetirementVaultEvent" (
  "id" TEXT NOT NULL,
  "retirementVaultId" TEXT NOT NULL,
  "eventType" "RetirementVaultEventType" NOT NULL,
  "actorType" TEXT NOT NULL,
  "actorId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "RetirementVaultEvent_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "TransactionIntent"
ADD COLUMN "retirementVaultId" TEXT;

CREATE UNIQUE INDEX "RetirementVault_customerAccountId_assetId_key"
ON "RetirementVault"("customerAccountId", "assetId");

CREATE INDEX "RetirementVault_status_unlockAt_idx"
ON "RetirementVault"("status", "unlockAt");

CREATE INDEX "RetirementVault_assetId_status_idx"
ON "RetirementVault"("assetId", "status");

CREATE INDEX "RetirementVaultReleaseRequest_retirementVaultId_status_re_idx"
ON "RetirementVaultReleaseRequest"("retirementVaultId", "status", "requestedAt");

CREATE INDEX "RetirementVaultReleaseRequest_status_cooldownEndsAt_idx"
ON "RetirementVaultReleaseRequest"("status", "cooldownEndsAt");

CREATE INDEX "RetirementVaultEvent_retirementVaultId_createdAt_idx"
ON "RetirementVaultEvent"("retirementVaultId", "createdAt");

CREATE INDEX "RetirementVaultEvent_eventType_createdAt_idx"
ON "RetirementVaultEvent"("eventType", "createdAt");

CREATE INDEX "TransactionIntent_retirementVaultId_idx"
ON "TransactionIntent"("retirementVaultId");

ALTER TABLE "RetirementVault"
ADD CONSTRAINT "RetirementVault_customerAccountId_fkey"
FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "RetirementVault"
ADD CONSTRAINT "RetirementVault_assetId_fkey"
FOREIGN KEY ("assetId") REFERENCES "Asset"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "RetirementVaultReleaseRequest"
ADD CONSTRAINT "RetirementVaultReleaseRequest_retirementVaultId_fkey"
FOREIGN KEY ("retirementVaultId") REFERENCES "RetirementVault"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "RetirementVaultEvent"
ADD CONSTRAINT "RetirementVaultEvent_retirementVaultId_fkey"
FOREIGN KEY ("retirementVaultId") REFERENCES "RetirementVault"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "TransactionIntent"
ADD CONSTRAINT "TransactionIntent_retirementVaultId_fkey"
FOREIGN KEY ("retirementVaultId") REFERENCES "RetirementVault"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
