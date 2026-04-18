CREATE TYPE "GovernedTreasuryExecutionRequestType" AS ENUM (
  'loan_contract_creation',
  'staking_pool_creation'
);

CREATE TYPE "GovernedTreasuryExecutionRequestStatus" AS ENUM (
  'pending_execution',
  'executed',
  'execution_failed',
  'cancelled'
);

CREATE TABLE "GovernedTreasuryExecutionRequest" (
  "id" TEXT NOT NULL,
  "environment" "WorkerRuntimeEnvironment" NOT NULL,
  "chainId" INTEGER NOT NULL,
  "executionType" "GovernedTreasuryExecutionRequestType" NOT NULL,
  "status" "GovernedTreasuryExecutionRequestStatus" NOT NULL DEFAULT 'pending_execution',
  "targetType" TEXT NOT NULL,
  "targetId" TEXT NOT NULL,
  "loanAgreementId" TEXT,
  "stakingPoolGovernanceRequestId" TEXT,
  "contractAddress" TEXT,
  "contractMethod" TEXT NOT NULL,
  "walletAddress" TEXT,
  "assetId" TEXT,
  "executionPayload" JSONB NOT NULL,
  "requestedByActorType" TEXT NOT NULL,
  "requestedByActorId" TEXT NOT NULL,
  "requestedByActorRole" TEXT,
  "requestNote" TEXT,
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "executedByActorType" TEXT,
  "executedByActorId" TEXT,
  "executedByActorRole" TEXT,
  "executedAt" TIMESTAMP(3),
  "blockchainTransactionHash" TEXT,
  "externalExecutionReference" TEXT,
  "executionResult" JSONB,
  "failedAt" TIMESTAMP(3),
  "failureReason" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "GovernedTreasuryExecutionRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "GovernedTreasuryExecutionRequest_environment_status_requested_idx"
  ON "GovernedTreasuryExecutionRequest"("environment", "status", "requestedAt");

CREATE INDEX "GovernedTreasuryExecutionRequest_type_target_requested_idx"
  ON "GovernedTreasuryExecutionRequest"("executionType", "targetType", "targetId", "requestedAt");

CREATE INDEX "GovernedTreasuryExecutionRequest_loanAgreement_requested_idx"
  ON "GovernedTreasuryExecutionRequest"("loanAgreementId", "requestedAt");

CREATE INDEX "GovernedTreasuryExecutionRequest_stakingRequest_requested_idx"
  ON "GovernedTreasuryExecutionRequest"("stakingPoolGovernanceRequestId", "requestedAt");

CREATE INDEX "GovernedTreasuryExecutionRequest_asset_requested_idx"
  ON "GovernedTreasuryExecutionRequest"("assetId", "requestedAt");

ALTER TABLE "GovernedTreasuryExecutionRequest"
  ADD CONSTRAINT "GovernedTreasuryExecutionRequest_loanAgreementId_fkey"
  FOREIGN KEY ("loanAgreementId") REFERENCES "LoanAgreement"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "GovernedTreasuryExecutionRequest"
  ADD CONSTRAINT "GovernedTreasuryExecutionRequest_stakingPoolGovernanceRequestId_fkey"
  FOREIGN KEY ("stakingPoolGovernanceRequestId") REFERENCES "StakingPoolGovernanceRequest"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "GovernedTreasuryExecutionRequest"
  ADD CONSTRAINT "GovernedTreasuryExecutionRequest_assetId_fkey"
  FOREIGN KEY ("assetId") REFERENCES "Asset"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
