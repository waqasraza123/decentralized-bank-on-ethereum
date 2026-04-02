ALTER TYPE "LedgerAccountType" ADD VALUE IF NOT EXISTS 'asset_outbound_clearing';
ALTER TYPE "LedgerJournalType" ADD VALUE IF NOT EXISTS 'withdrawal_settlement';

ALTER TABLE "TransactionIntent"
ADD COLUMN "externalAddress" TEXT;

CREATE INDEX "TransactionIntent_chainId_externalAddress_idx"
ON "TransactionIntent"("chainId", "externalAddress");
