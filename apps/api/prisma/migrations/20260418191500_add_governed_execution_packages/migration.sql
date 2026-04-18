ALTER TABLE "GovernedTreasuryExecutionRequest"
  ADD COLUMN "canonicalExecutionPayload" JSONB,
  ADD COLUMN "canonicalExecutionPayloadText" TEXT,
  ADD COLUMN "executionPackageHash" TEXT,
  ADD COLUMN "executionPackageChecksumSha256" TEXT,
  ADD COLUMN "executionPackageSignature" TEXT,
  ADD COLUMN "executionPackageSignatureAlgorithm" TEXT,
  ADD COLUMN "executionPackageSignerAddress" TEXT,
  ADD COLUMN "executionPackagePublishedAt" TIMESTAMP(3),
  ADD COLUMN "claimedByWorkerId" TEXT,
  ADD COLUMN "claimedAt" TIMESTAMP(3),
  ADD COLUMN "claimExpiresAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "GovernedTreasuryExecutionRequest_executionPackageHash_key"
  ON "GovernedTreasuryExecutionRequest"("executionPackageHash");

CREATE INDEX "GovernedTreasuryExecutionRequest_environment_published_requested_idx"
  ON "GovernedTreasuryExecutionRequest"("environment", "executionPackagePublishedAt", "requestedAt");

CREATE INDEX "GovernedTreasuryExecutionRequest_environment_claimExpiry_requested_idx"
  ON "GovernedTreasuryExecutionRequest"("environment", "claimExpiresAt", "requestedAt");
