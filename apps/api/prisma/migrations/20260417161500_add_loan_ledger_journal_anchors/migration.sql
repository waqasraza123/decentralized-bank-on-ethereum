ALTER TABLE "LedgerJournal"
DROP CONSTRAINT IF EXISTS "LedgerJournal_transactionIntentId_fkey";

ALTER TABLE "LedgerJournal"
ALTER COLUMN "transactionIntentId" DROP NOT NULL;

ALTER TABLE "LedgerJournal"
ADD COLUMN "loanAgreementId" TEXT,
ADD COLUMN "loanRepaymentEventId" TEXT;

ALTER TABLE "LedgerJournal"
ADD CONSTRAINT "LedgerJournal_transactionIntentId_fkey"
FOREIGN KEY ("transactionIntentId") REFERENCES "TransactionIntent"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "LedgerJournal"
ADD CONSTRAINT "LedgerJournal_loanAgreementId_fkey"
FOREIGN KEY ("loanAgreementId") REFERENCES "LoanAgreement"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "LedgerJournal"
ADD CONSTRAINT "LedgerJournal_loanRepaymentEventId_fkey"
FOREIGN KEY ("loanRepaymentEventId") REFERENCES "LoanRepaymentEvent"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "LedgerJournal_loanAgreementId_idx"
ON "LedgerJournal"("loanAgreementId");

CREATE INDEX IF NOT EXISTS "LedgerJournal_loanRepaymentEventId_idx"
ON "LedgerJournal"("loanRepaymentEventId");

CREATE UNIQUE INDEX IF NOT EXISTS "LedgerJournal_loanAgreementId_journalType_key"
ON "LedgerJournal"("loanAgreementId", "journalType");

CREATE UNIQUE INDEX IF NOT EXISTS "LedgerJournal_loanRepaymentEventId_journalType_key"
ON "LedgerJournal"("loanRepaymentEventId", "journalType");
