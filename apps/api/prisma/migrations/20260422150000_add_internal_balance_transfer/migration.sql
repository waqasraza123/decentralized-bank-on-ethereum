ALTER TYPE "TransactionIntentType" ADD VALUE 'internal_balance_transfer';
ALTER TYPE "ReviewCaseType" ADD VALUE 'internal_balance_transfer_review';
ALTER TYPE "LedgerAccountType" ADD VALUE 'customer_asset_pending_internal_transfer_liability';
ALTER TYPE "LedgerJournalType" ADD VALUE 'internal_balance_transfer_reservation';
ALTER TYPE "LedgerJournalType" ADD VALUE 'internal_balance_transfer_reservation_release';
ALTER TYPE "LedgerJournalType" ADD VALUE 'internal_balance_transfer_settlement';

ALTER TABLE "TransactionIntent"
ADD COLUMN "recipientCustomerAccountId" TEXT,
ADD COLUMN "recipientEmailSnapshot" TEXT,
ADD COLUMN "recipientMaskedEmail" TEXT,
ADD COLUMN "recipientMaskedDisplay" TEXT;

CREATE INDEX "TransactionIntent_recipientCustomerAccountId_idx"
ON "TransactionIntent"("recipientCustomerAccountId");

ALTER TABLE "TransactionIntent"
ADD CONSTRAINT "TransactionIntent_recipientCustomerAccountId_fkey"
FOREIGN KEY ("recipientCustomerAccountId") REFERENCES "CustomerAccount"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
