-- CreateEnum
CREATE TYPE "StakingPoolGovernanceRequestStatus" AS ENUM (
    'pending_approval',
    'approved',
    'rejected',
    'executed',
    'execution_failed'
);

-- CreateTable
CREATE TABLE "StakingPoolGovernanceRequest" (
    "id" TEXT NOT NULL,
    "rewardRate" INTEGER NOT NULL,
    "status" "StakingPoolGovernanceRequestStatus" NOT NULL DEFAULT 'pending_approval',
    "requestedByOperatorId" TEXT NOT NULL,
    "requestedByOperatorRole" TEXT,
    "approvedByOperatorId" TEXT,
    "approvedByOperatorRole" TEXT,
    "rejectedByOperatorId" TEXT,
    "rejectedByOperatorRole" TEXT,
    "executedByOperatorId" TEXT,
    "executedByOperatorRole" TEXT,
    "requestNote" TEXT,
    "approvalNote" TEXT,
    "rejectionNote" TEXT,
    "executionNote" TEXT,
    "executionFailureReason" TEXT,
    "blockchainTransactionHash" TEXT,
    "stakingPoolId" INTEGER,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "executedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StakingPoolGovernanceRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StakingPoolGovernanceRequest_stakingPoolId_key" ON "StakingPoolGovernanceRequest"("stakingPoolId");

-- CreateIndex
CREATE INDEX "StakingPoolGovernanceRequest_status_requestedAt_idx" ON "StakingPoolGovernanceRequest"("status", "requestedAt");

-- CreateIndex
CREATE INDEX "StakingPoolGovernanceRequest_requestedByOperatorId_requ_idx" ON "StakingPoolGovernanceRequest"("requestedByOperatorId", "requestedAt");

-- CreateIndex
CREATE INDEX "StakingPoolGovernanceRequest_approvedByOperatorId_ap_idx" ON "StakingPoolGovernanceRequest"("approvedByOperatorId", "approvedAt");

-- CreateIndex
CREATE INDEX "StakingPoolGovernanceRequest_executedByOperatorId_ex_idx" ON "StakingPoolGovernanceRequest"("executedByOperatorId", "executedAt");

-- AddForeignKey
ALTER TABLE "StakingPoolGovernanceRequest"
ADD CONSTRAINT "StakingPoolGovernanceRequest_stakingPoolId_fkey"
FOREIGN KEY ("stakingPoolId") REFERENCES "StakingPool"("id") ON DELETE SET NULL ON UPDATE CASCADE;
