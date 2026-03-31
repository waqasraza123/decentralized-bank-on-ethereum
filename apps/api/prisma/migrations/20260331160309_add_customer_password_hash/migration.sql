-- CreateEnum
CREATE TYPE "AccountLifecycleStatus" AS ENUM ('registered', 'email_verified', 'review_required', 'active', 'restricted', 'frozen', 'closed');

-- CreateEnum
CREATE TYPE "WalletKind" AS ENUM ('embedded', 'external', 'treasury', 'operational', 'contract');

-- CreateEnum
CREATE TYPE "WalletCustodyType" AS ENUM ('platform_managed', 'customer_external', 'multisig_controlled', 'contract_controlled');

-- CreateEnum
CREATE TYPE "WalletStatus" AS ENUM ('pending', 'active', 'restricted', 'archived');

-- CreateEnum
CREATE TYPE "AssetType" AS ENUM ('native', 'erc20');

-- CreateEnum
CREATE TYPE "AssetStatus" AS ENUM ('active', 'disabled');

-- CreateEnum
CREATE TYPE "TransactionIntentType" AS ENUM ('deposit', 'withdrawal', 'vault_subscription', 'vault_redemption', 'treasury_transfer', 'adjustment');

-- CreateEnum
CREATE TYPE "TransactionIntentStatus" AS ENUM ('requested', 'review_required', 'approved', 'queued', 'broadcast', 'confirmed', 'settled', 'failed', 'cancelled', 'manually_resolved');

-- CreateEnum
CREATE TYPE "PolicyDecision" AS ENUM ('pending', 'approved', 'denied', 'review_required');

-- CreateEnum
CREATE TYPE "BlockchainTransactionStatus" AS ENUM ('created', 'signed', 'broadcast', 'confirmed', 'failed', 'replaced', 'dropped');

-- CreateEnum
CREATE TYPE "ReviewCaseStatus" AS ENUM ('open', 'in_progress', 'resolved', 'dismissed');

-- CreateEnum
CREATE TYPE "ReviewCaseType" AS ENUM ('account_review', 'withdrawal_review', 'reconciliation_review', 'manual_intervention');

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "supabaseUserId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "passwordHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerAccount" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "status" "AccountLifecycleStatus" NOT NULL DEFAULT 'registered',
    "activatedAt" TIMESTAMP(3),
    "restrictedAt" TIMESTAMP(3),
    "frozenAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Wallet" (
    "id" TEXT NOT NULL,
    "customerAccountId" TEXT,
    "chainId" INTEGER NOT NULL,
    "address" TEXT NOT NULL,
    "kind" "WalletKind" NOT NULL,
    "custodyType" "WalletCustodyType" NOT NULL,
    "status" "WalletStatus" NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Wallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL,
    "chainId" INTEGER NOT NULL,
    "symbol" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "decimals" INTEGER NOT NULL,
    "assetType" "AssetType" NOT NULL,
    "contractAddress" TEXT,
    "status" "AssetStatus" NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransactionIntent" (
    "id" TEXT NOT NULL,
    "customerAccountId" TEXT,
    "assetId" TEXT NOT NULL,
    "sourceWalletId" TEXT,
    "destinationWalletId" TEXT,
    "chainId" INTEGER NOT NULL,
    "intentType" "TransactionIntentType" NOT NULL,
    "status" "TransactionIntentStatus" NOT NULL,
    "policyDecision" "PolicyDecision" NOT NULL DEFAULT 'pending',
    "requestedAmount" DECIMAL(36,18) NOT NULL,
    "settledAmount" DECIMAL(36,18),
    "idempotencyKey" TEXT NOT NULL,
    "failureCode" TEXT,
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransactionIntent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlockchainTransaction" (
    "id" TEXT NOT NULL,
    "transactionIntentId" TEXT NOT NULL,
    "chainId" INTEGER NOT NULL,
    "txHash" TEXT,
    "nonce" INTEGER,
    "status" "BlockchainTransactionStatus" NOT NULL,
    "fromAddress" TEXT,
    "toAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "confirmedAt" TIMESTAMP(3),

    CONSTRAINT "BlockchainTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewCase" (
    "id" TEXT NOT NULL,
    "customerId" TEXT,
    "customerAccountId" TEXT,
    "transactionIntentId" TEXT,
    "type" "ReviewCaseType" NOT NULL,
    "status" "ReviewCaseStatus" NOT NULL DEFAULT 'open',
    "reasonCode" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReviewCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "customerId" TEXT,
    "actorType" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Customer_supabaseUserId_key" ON "Customer"("supabaseUserId");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_email_key" ON "Customer"("email");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerAccount_customerId_key" ON "CustomerAccount"("customerId");

-- CreateIndex
CREATE INDEX "CustomerAccount_status_idx" ON "CustomerAccount"("status");

-- CreateIndex
CREATE INDEX "Wallet_customerAccountId_idx" ON "Wallet"("customerAccountId");

-- CreateIndex
CREATE INDEX "Wallet_kind_custodyType_idx" ON "Wallet"("kind", "custodyType");

-- CreateIndex
CREATE INDEX "Wallet_status_idx" ON "Wallet"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Wallet_chainId_address_key" ON "Wallet"("chainId", "address");

-- CreateIndex
CREATE INDEX "Asset_assetType_status_idx" ON "Asset"("assetType", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Asset_chainId_symbol_key" ON "Asset"("chainId", "symbol");

-- CreateIndex
CREATE UNIQUE INDEX "Asset_chainId_contractAddress_key" ON "Asset"("chainId", "contractAddress");

-- CreateIndex
CREATE UNIQUE INDEX "TransactionIntent_idempotencyKey_key" ON "TransactionIntent"("idempotencyKey");

-- CreateIndex
CREATE INDEX "TransactionIntent_customerAccountId_idx" ON "TransactionIntent"("customerAccountId");

-- CreateIndex
CREATE INDEX "TransactionIntent_assetId_idx" ON "TransactionIntent"("assetId");

-- CreateIndex
CREATE INDEX "TransactionIntent_sourceWalletId_idx" ON "TransactionIntent"("sourceWalletId");

-- CreateIndex
CREATE INDEX "TransactionIntent_destinationWalletId_idx" ON "TransactionIntent"("destinationWalletId");

-- CreateIndex
CREATE INDEX "TransactionIntent_chainId_intentType_idx" ON "TransactionIntent"("chainId", "intentType");

-- CreateIndex
CREATE INDEX "TransactionIntent_status_policyDecision_idx" ON "TransactionIntent"("status", "policyDecision");

-- CreateIndex
CREATE UNIQUE INDEX "BlockchainTransaction_txHash_key" ON "BlockchainTransaction"("txHash");

-- CreateIndex
CREATE INDEX "BlockchainTransaction_transactionIntentId_idx" ON "BlockchainTransaction"("transactionIntentId");

-- CreateIndex
CREATE INDEX "BlockchainTransaction_chainId_status_idx" ON "BlockchainTransaction"("chainId", "status");

-- CreateIndex
CREATE INDEX "ReviewCase_customerId_idx" ON "ReviewCase"("customerId");

-- CreateIndex
CREATE INDEX "ReviewCase_customerAccountId_idx" ON "ReviewCase"("customerAccountId");

-- CreateIndex
CREATE INDEX "ReviewCase_transactionIntentId_idx" ON "ReviewCase"("transactionIntentId");

-- CreateIndex
CREATE INDEX "ReviewCase_type_status_idx" ON "ReviewCase"("type", "status");

-- CreateIndex
CREATE INDEX "AuditEvent_customerId_idx" ON "AuditEvent"("customerId");

-- CreateIndex
CREATE INDEX "AuditEvent_actorType_actorId_idx" ON "AuditEvent"("actorType", "actorId");

-- CreateIndex
CREATE INDEX "AuditEvent_targetType_targetId_idx" ON "AuditEvent"("targetType", "targetId");

-- AddForeignKey
ALTER TABLE "CustomerAccount" ADD CONSTRAINT "CustomerAccount_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionIntent" ADD CONSTRAINT "TransactionIntent_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionIntent" ADD CONSTRAINT "TransactionIntent_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionIntent" ADD CONSTRAINT "TransactionIntent_sourceWalletId_fkey" FOREIGN KEY ("sourceWalletId") REFERENCES "Wallet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionIntent" ADD CONSTRAINT "TransactionIntent_destinationWalletId_fkey" FOREIGN KEY ("destinationWalletId") REFERENCES "Wallet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlockchainTransaction" ADD CONSTRAINT "BlockchainTransaction_transactionIntentId_fkey" FOREIGN KEY ("transactionIntentId") REFERENCES "TransactionIntent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewCase" ADD CONSTRAINT "ReviewCase_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewCase" ADD CONSTRAINT "ReviewCase_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewCase" ADD CONSTRAINT "ReviewCase_transactionIntentId_fkey" FOREIGN KEY ("transactionIntentId") REFERENCES "TransactionIntent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
