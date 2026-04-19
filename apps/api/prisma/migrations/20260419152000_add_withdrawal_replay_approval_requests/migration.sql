-- CreateEnum
CREATE TYPE "WithdrawalSettlementReplayAction" AS ENUM ('confirm', 'settle');

-- CreateEnum
CREATE TYPE "WithdrawalSettlementReplayApprovalRequestStatus" AS ENUM ('pending_approval', 'approved', 'executed', 'rejected');

-- CreateTable
CREATE TABLE "WithdrawalSettlementReplayApprovalRequest" (
    "id" TEXT NOT NULL,
    "transactionIntentId" TEXT NOT NULL,
    "chainId" INTEGER NOT NULL,
    "replayAction" "WithdrawalSettlementReplayAction" NOT NULL,
    "status" "WithdrawalSettlementReplayApprovalRequestStatus" NOT NULL DEFAULT 'pending_approval',
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

    CONSTRAINT "WithdrawalSettlementReplayApprovalRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WithdrawalSettlementReplayApprovalRequest_transactionIntentId_idx" ON "WithdrawalSettlementReplayApprovalRequest"("transactionIntentId", "status", "requestedAt");

-- CreateIndex
CREATE INDEX "WithdrawalSettlementReplayApprovalRequest_status_requestedAt_idx" ON "WithdrawalSettlementReplayApprovalRequest"("status", "requestedAt");

-- CreateIndex
CREATE INDEX "WithdrawalSettlementReplayApprovalRequest_requestedByOperator_idx" ON "WithdrawalSettlementReplayApprovalRequest"("requestedByOperatorId", "requestedAt");

-- CreateIndex
CREATE INDEX "WithdrawalSettlementReplayApprovalRequest_approvedByOperatorI_idx" ON "WithdrawalSettlementReplayApprovalRequest"("approvedByOperatorId", "approvedAt");

-- CreateIndex
CREATE INDEX "WithdrawalSettlementReplayApprovalRequest_executedByOperatorI_idx" ON "WithdrawalSettlementReplayApprovalRequest"("executedByOperatorId", "executedAt");

-- AddForeignKey
ALTER TABLE "WithdrawalSettlementReplayApprovalRequest" ADD CONSTRAINT "WithdrawalSettlementReplayApprovalRequest_transactionIntentId_fkey" FOREIGN KEY ("transactionIntentId") REFERENCES "TransactionIntent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
