import { ConflictException } from "@nestjs/common";
import {
  LedgerAccountType,
  LedgerJournalType,
  LedgerPostingDirection,
  Prisma
} from "@prisma/client";
import { LedgerService } from "./ledger.service";

describe("LedgerService loan helpers", () => {
  const service = new LedgerService();

  it("records loan disbursement with receivable and fee accrual postings", async () => {
    const transaction = {
      ledgerJournal: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({
          id: "loan_disbursement_journal_1"
        })
      },
      ledgerAccount: {
        upsert: jest
          .fn()
          .mockResolvedValueOnce({
            id: "outbound_clearing_1"
          })
          .mockResolvedValueOnce({
            id: "principal_receivable_1"
          })
          .mockResolvedValueOnce({
            id: "fee_receivable_1"
          })
          .mockResolvedValueOnce({
            id: "fee_income_1"
          })
      },
      ledgerPosting: {
        createMany: jest.fn().mockResolvedValue({ count: 4 })
      }
    } as any;

    const result = await service.recordLoanDisbursement(transaction, {
      loanAgreementId: "loan_agreement_1",
      assetId: "asset_usdc",
      chainId: 8453,
      principalAmount: new Prisma.Decimal("1000"),
      serviceFeeAmount: new Prisma.Decimal("25")
    });

    expect(transaction.ledgerAccount.upsert).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        create: expect.objectContaining({
          accountType: LedgerAccountType.loan_principal_receivable
        })
      })
    );
    expect(transaction.ledgerAccount.upsert).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        create: expect.objectContaining({
          accountType: LedgerAccountType.loan_service_fee_receivable
        })
      })
    );
    expect(transaction.ledgerAccount.upsert).toHaveBeenNthCalledWith(
      4,
      expect.objectContaining({
        create: expect.objectContaining({
          accountType: LedgerAccountType.loan_service_fee_income
        })
      })
    );
    expect(transaction.ledgerJournal.create).toHaveBeenCalledWith({
      data: {
        loanAgreementId: "loan_agreement_1",
        journalType: LedgerJournalType.loan_disbursement,
        chainId: 8453,
        assetId: "asset_usdc"
      }
    });
    expect(transaction.ledgerPosting.createMany).toHaveBeenCalledWith({
      data: [
        {
          ledgerJournalId: "loan_disbursement_journal_1",
          ledgerAccountId: "principal_receivable_1",
          direction: LedgerPostingDirection.debit,
          amount: new Prisma.Decimal("1000")
        },
        {
          ledgerJournalId: "loan_disbursement_journal_1",
          ledgerAccountId: "outbound_clearing_1",
          direction: LedgerPostingDirection.credit,
          amount: new Prisma.Decimal("1000")
        },
        {
          ledgerJournalId: "loan_disbursement_journal_1",
          ledgerAccountId: "fee_receivable_1",
          direction: LedgerPostingDirection.debit,
          amount: new Prisma.Decimal("25")
        },
        {
          ledgerJournalId: "loan_disbursement_journal_1",
          ledgerAccountId: "fee_income_1",
          direction: LedgerPostingDirection.credit,
          amount: new Prisma.Decimal("25")
        }
      ]
    });
    expect(result.ledgerJournalId).toBe("loan_disbursement_journal_1");
  });

  it("records loan repayment by reducing customer liability and receivables", async () => {
    const transaction = {
      ledgerJournal: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({
          id: "loan_repayment_journal_1"
        })
      },
      ledgerAccount: {
        upsert: jest
          .fn()
          .mockResolvedValueOnce({
            id: "customer_liability_1"
          })
          .mockResolvedValueOnce({
            id: "principal_receivable_1"
          })
          .mockResolvedValueOnce({
            id: "fee_receivable_1"
          })
      },
      customerAssetBalance: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUnique: jest.fn().mockResolvedValue({
          availableBalance: new Prisma.Decimal("295")
        })
      },
      ledgerPosting: {
        createMany: jest.fn().mockResolvedValue({ count: 3 })
      }
    } as any;

    const result = await service.recordLoanRepayment(transaction, {
      loanAgreementId: "loan_agreement_1",
      loanRepaymentEventId: "repayment_1",
      customerAccountId: "account_1",
      assetId: "asset_usdc",
      chainId: 8453,
      principalAmount: new Prisma.Decimal("200"),
      serviceFeeAmount: new Prisma.Decimal("5"),
      totalAmount: new Prisma.Decimal("205")
    });

    expect(transaction.ledgerJournal.create).toHaveBeenCalledWith({
      data: {
        loanRepaymentEventId: "repayment_1",
        loanAgreementId: "loan_agreement_1",
        journalType: LedgerJournalType.loan_repayment,
        chainId: 8453,
        assetId: "asset_usdc"
      }
    });
    expect(transaction.ledgerPosting.createMany).toHaveBeenCalledWith({
      data: [
        {
          ledgerJournalId: "loan_repayment_journal_1",
          ledgerAccountId: "customer_liability_1",
          direction: LedgerPostingDirection.debit,
          amount: new Prisma.Decimal("205")
        },
        {
          ledgerJournalId: "loan_repayment_journal_1",
          ledgerAccountId: "principal_receivable_1",
          direction: LedgerPostingDirection.credit,
          amount: new Prisma.Decimal("200")
        },
        {
          ledgerJournalId: "loan_repayment_journal_1",
          ledgerAccountId: "fee_receivable_1",
          direction: LedgerPostingDirection.credit,
          amount: new Prisma.Decimal("5")
        }
      ]
    });
    expect(result.availableBalance).toBe("295");
  });

  it("rejects repayment when the managed balance is insufficient", async () => {
    const transaction = {
      ledgerJournal: {
        findUnique: jest.fn().mockResolvedValue(null)
      },
      ledgerAccount: {
        upsert: jest.fn()
      },
      customerAssetBalance: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 })
      }
    } as any;

    await expect(
      service.recordLoanRepayment(transaction, {
        loanAgreementId: "loan_agreement_1",
        loanRepaymentEventId: "repayment_1",
        customerAccountId: "account_1",
        assetId: "asset_usdc",
        chainId: 8453,
        principalAmount: new Prisma.Decimal("200"),
        serviceFeeAmount: new Prisma.Decimal("5"),
        totalAmount: new Prisma.Decimal("205")
      })
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
