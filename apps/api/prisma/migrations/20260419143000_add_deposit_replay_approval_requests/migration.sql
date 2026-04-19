-- CreateEnum
CREATE TYPE "DepositSettlementReplayAction" AS ENUM ('confirm', 'settle');

-- CreateEnum
CREATE TYPE "DepositSettlementReplayApprovalRequestStatus" AS ENUM ('pending_approval', 'approved', 'executed', 'rejected');

-- CreateTable
CREATE TABLE "DepositSettlementReplayApprovalRequest" (
    "id" TEXT NOT NULL,
    "transactionIntentId" TEXT NOT NULL,
    "chainId" INTEGER NOT NULL,
    "replayAction" "DepositSettlementReplayAction" NOT NULL,
    "status" "DepositSettlementReplayApprovalRequestStatus" NOT NULL DEFAULT 'pending_approval',
    "requestedByOperatorId" TEXT NOT NULL,
    "requestedByOperatorRole" TEXT NOT NULL,
    "requestNote" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedByOperatorId" TEXT,
    "approvedByOperatorRole" TEXT,
    "approvalNote" TEXT,
    "approvedAt" TIMESTAMP(3),
    "executedByOperatorId" TEXT,
    "executedByOperatorRole" TEXT,
    "executedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DepositSettlementReplayApprovalRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DepositSettlementReplayApprovalRequest_transactionIntentId_st_idx" ON "DepositSettlementReplayApprovalRequest"("transactionIntentId", "status", "requestedAt");

-- CreateIndex
CREATE INDEX "DepositSettlementReplayApprovalRequest_status_requestedAt_idx" ON "DepositSettlementReplayApprovalRequest"("status", "requestedAt");

-- CreateIndex
CREATE INDEX "DepositSettlementReplayApprovalRequest_requestedByOperatorI_idx" ON "DepositSettlementReplayApprovalRequest"("requestedByOperatorId", "requestedAt");

-- CreateIndex
CREATE INDEX "DepositSettlementReplayApprovalRequest_approvedByOperatorId_idx" ON "DepositSettlementReplayApprovalRequest"("approvedByOperatorId", "approvedAt");

-- CreateIndex
CREATE INDEX "DepositSettlementReplayApprovalRequest_executedByOperatorId_idx" ON "DepositSettlementReplayApprovalRequest"("executedByOperatorId", "executedAt");

-- AddForeignKey
ALTER TABLE "DepositSettlementReplayApprovalRequest" ADD CONSTRAINT "DepositSettlementReplayApprovalRequest_transactionIntentId_fkey" FOREIGN KEY ("transactionIntentId") REFERENCES "TransactionIntent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
