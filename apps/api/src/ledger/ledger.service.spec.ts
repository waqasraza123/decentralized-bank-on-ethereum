import { ConflictException } from "@nestjs/common";
import { LedgerPostingDirection } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { LedgerService } from "./ledger.service";

function createTransactionClient() {
  return {
    ledgerJournal: {
      findUnique: jest.fn(),
      create: jest.fn()
    },
    ledgerAccount: {
      upsert: jest.fn()
    },
    ledgerPosting: {
      createMany: jest.fn()
    },
    customerAssetBalance: {
      upsert: jest.fn(),
      updateMany: jest.fn(),
      findUnique: jest.fn()
    },
    retirementVault: {
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn()
    }
  };
}

describe("LedgerService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("posts a confirmed deposit into ledger and balance read model", async () => {
    const service = new LedgerService();
    const transaction = createTransactionClient();

    transaction.ledgerJournal.findUnique.mockResolvedValue(null);
    transaction.ledgerAccount.upsert
      .mockResolvedValueOnce({
        id: "ledger_account_inbound"
      })
      .mockResolvedValueOnce({
        id: "ledger_account_customer"
      });
    transaction.ledgerJournal.create.mockResolvedValue({
      id: "ledger_journal_1"
    });
    transaction.ledgerPosting.createMany.mockResolvedValue({
      count: 2
    });
    transaction.customerAssetBalance.upsert.mockResolvedValue({
      availableBalance: new Prisma.Decimal("5.25")
    });

    const result = await service.settleConfirmedDeposit(transaction as never, {
      transactionIntentId: "intent_1",
      customerAccountId: "account_1",
      assetId: "asset_1",
      chainId: 8453,
      amount: new Prisma.Decimal("5.25")
    });

    expect(result.ledgerJournalId).toBe("ledger_journal_1");
    expect(result.availableBalance).toBe("5.25");
    expect(transaction.ledgerPosting.createMany).toHaveBeenCalledWith({
      data: [
        {
          ledgerJournalId: "ledger_journal_1",
          ledgerAccountId: "ledger_account_inbound",
          direction: LedgerPostingDirection.debit,
          amount: new Prisma.Decimal("5.25")
        },
        {
          ledgerJournalId: "ledger_journal_1",
          ledgerAccountId: "ledger_account_customer",
          direction: LedgerPostingDirection.credit,
          amount: new Prisma.Decimal("5.25")
        }
      ]
    });
  });

  it("rejects duplicate settlement journal creation", async () => {
    const service = new LedgerService();
    const transaction = createTransactionClient();

    transaction.ledgerJournal.findUnique.mockResolvedValue({
      id: "ledger_journal_1"
    });

    await expect(
      service.settleConfirmedDeposit(transaction as never, {
        transactionIntentId: "intent_1",
        customerAccountId: "account_1",
        assetId: "asset_1",
        chainId: 8453,
        amount: new Prisma.Decimal("5.25")
      })
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("moves available balance into a retirement vault liability", async () => {
    const service = new LedgerService();
    const transaction = createTransactionClient();

    transaction.ledgerJournal.findUnique.mockResolvedValue(null);
    transaction.ledgerAccount.upsert
      .mockResolvedValueOnce({
        id: "ledger_account_customer"
      })
      .mockResolvedValueOnce({
        id: "ledger_account_vault"
      });
    transaction.customerAssetBalance.updateMany.mockResolvedValue({
      count: 1
    });
    transaction.retirementVault.findUnique.mockResolvedValue({
      id: "vault_1",
      fundedAt: null
    });
    transaction.retirementVault.update.mockResolvedValue({
      lockedBalance: new Prisma.Decimal("8.25")
    });
    transaction.customerAssetBalance.findUnique.mockResolvedValue({
      availableBalance: new Prisma.Decimal("1.75")
    });
    transaction.ledgerJournal.create.mockResolvedValue({
      id: "ledger_journal_vault_1"
    });
    transaction.ledgerPosting.createMany.mockResolvedValue({
      count: 2
    });

    const result = await service.fundRetirementVaultBalance(
      transaction as never,
      {
        transactionIntentId: "intent_vault_1",
        retirementVaultId: "vault_1",
        customerAccountId: "account_1",
        assetId: "asset_1",
        chainId: 8453,
        amount: new Prisma.Decimal("8.25")
      }
    );

    expect(result.ledgerJournalId).toBe("ledger_journal_vault_1");
    expect(result.availableBalance).toBe("1.75");
    expect(result.lockedBalance).toBe("8.25");
    expect(transaction.ledgerPosting.createMany).toHaveBeenCalledWith({
      data: [
        {
          ledgerJournalId: "ledger_journal_vault_1",
          ledgerAccountId: "ledger_account_customer",
          direction: LedgerPostingDirection.debit,
          amount: new Prisma.Decimal("8.25")
        },
        {
          ledgerJournalId: "ledger_journal_vault_1",
          ledgerAccountId: "ledger_account_vault",
          direction: LedgerPostingDirection.credit,
          amount: new Prisma.Decimal("8.25")
        }
      ]
    });
  });

  it("releases retirement vault balance back into customer available balance", async () => {
    const service = new LedgerService();
    const transaction = createTransactionClient();

    transaction.ledgerJournal.findUnique.mockResolvedValue(null);
    transaction.ledgerAccount.upsert
      .mockResolvedValueOnce({
        id: "ledger_account_vault"
      })
      .mockResolvedValueOnce({
        id: "ledger_account_customer"
      });
    transaction.retirementVault.updateMany.mockResolvedValue({
      count: 1
    });
    transaction.retirementVault.findUnique.mockResolvedValue({
      lockedBalance: new Prisma.Decimal("0")
    });
    transaction.customerAssetBalance.updateMany.mockResolvedValue({
      count: 1
    });
    transaction.customerAssetBalance.findUnique.mockResolvedValue({
      availableBalance: new Prisma.Decimal("10")
    });
    transaction.ledgerJournal.create.mockResolvedValue({
      id: "ledger_journal_release_1"
    });
    transaction.ledgerPosting.createMany.mockResolvedValue({
      count: 2
    });

    const result = await service.releaseRetirementVaultBalance(
      transaction as never,
      {
        transactionIntentId: "intent_release_1",
        retirementVaultId: "vault_1",
        customerAccountId: "account_1",
        assetId: "asset_1",
        chainId: 8453,
        amount: new Prisma.Decimal("8.25")
      }
    );

    expect(result.ledgerJournalId).toBe("ledger_journal_release_1");
    expect(result.availableBalance).toBe("10");
    expect(result.lockedBalance).toBe("0");
    expect(transaction.ledgerPosting.createMany).toHaveBeenCalledWith({
      data: [
        {
          ledgerJournalId: "ledger_journal_release_1",
          ledgerAccountId: "ledger_account_customer",
          direction: LedgerPostingDirection.debit,
          amount: new Prisma.Decimal("8.25")
        },
        {
          ledgerJournalId: "ledger_journal_release_1",
          ledgerAccountId: "ledger_account_vault",
          direction: LedgerPostingDirection.credit,
          amount: new Prisma.Decimal("8.25")
        }
      ]
    });
  });

  it("reserves internal transfer balance into pending liability", async () => {
    const service = new LedgerService();
    const transaction = createTransactionClient();

    transaction.ledgerJournal.findUnique.mockResolvedValue(null);
    transaction.ledgerAccount.upsert
      .mockResolvedValueOnce({
        id: "ledger_account_customer"
      })
      .mockResolvedValueOnce({
        id: "ledger_account_pending_internal"
      });
    transaction.customerAssetBalance.updateMany.mockResolvedValue({
      count: 1
    });
    transaction.customerAssetBalance.findUnique.mockResolvedValue({
      availableBalance: new Prisma.Decimal("70"),
      pendingBalance: new Prisma.Decimal("30")
    });
    transaction.ledgerJournal.create.mockResolvedValue({
      id: "ledger_journal_internal_reserve_1"
    });
    transaction.ledgerPosting.createMany.mockResolvedValue({
      count: 2
    });

    const result = await service.reserveInternalBalanceTransferBalance(
      transaction as never,
      {
        transactionIntentId: "intent_internal_1",
        customerAccountId: "account_1",
        assetId: "asset_1",
        chainId: 8453,
        amount: new Prisma.Decimal("30")
      }
    );

    expect(result.ledgerJournalId).toBe("ledger_journal_internal_reserve_1");
    expect(result.senderAvailableBalance).toBe("70");
    expect(result.senderPendingBalance).toBe("30");
    expect(transaction.ledgerPosting.createMany).toHaveBeenCalledWith({
      data: [
        {
          ledgerJournalId: "ledger_journal_internal_reserve_1",
          ledgerAccountId: "ledger_account_customer",
          direction: LedgerPostingDirection.debit,
          amount: new Prisma.Decimal("30")
        },
        {
          ledgerJournalId: "ledger_journal_internal_reserve_1",
          ledgerAccountId: "ledger_account_pending_internal",
          direction: LedgerPostingDirection.credit,
          amount: new Prisma.Decimal("30")
        }
      ]
    });
  });

  it("releases a reserved internal transfer back to available balance", async () => {
    const service = new LedgerService();
    const transaction = createTransactionClient();

    transaction.ledgerJournal.findUnique.mockResolvedValue(null);
    transaction.ledgerAccount.upsert
      .mockResolvedValueOnce({
        id: "ledger_account_customer"
      })
      .mockResolvedValueOnce({
        id: "ledger_account_pending_internal"
      });
    transaction.customerAssetBalance.updateMany.mockResolvedValue({
      count: 1
    });
    transaction.customerAssetBalance.findUnique.mockResolvedValue({
      availableBalance: new Prisma.Decimal("100"),
      pendingBalance: new Prisma.Decimal("0")
    });
    transaction.ledgerJournal.create.mockResolvedValue({
      id: "ledger_journal_internal_release_1"
    });
    transaction.ledgerPosting.createMany.mockResolvedValue({
      count: 2
    });

    const result = await service.releaseInternalBalanceTransferReservation(
      transaction as never,
      {
        transactionIntentId: "intent_internal_1",
        customerAccountId: "account_1",
        assetId: "asset_1",
        chainId: 8453,
        amount: new Prisma.Decimal("30")
      }
    );

    expect(result.ledgerJournalId).toBe("ledger_journal_internal_release_1");
    expect(result.senderAvailableBalance).toBe("100");
    expect(result.senderPendingBalance).toBe("0");
    expect(transaction.ledgerPosting.createMany).toHaveBeenCalledWith({
      data: [
        {
          ledgerJournalId: "ledger_journal_internal_release_1",
          ledgerAccountId: "ledger_account_pending_internal",
          direction: LedgerPostingDirection.debit,
          amount: new Prisma.Decimal("30")
        },
        {
          ledgerJournalId: "ledger_journal_internal_release_1",
          ledgerAccountId: "ledger_account_customer",
          direction: LedgerPostingDirection.credit,
          amount: new Prisma.Decimal("30")
        }
      ]
    });
  });

  it("settles a pending internal transfer from sender reservation to recipient balance", async () => {
    const service = new LedgerService();
    const transaction = createTransactionClient();

    transaction.ledgerJournal.findUnique.mockResolvedValue(null);
    transaction.ledgerAccount.upsert
      .mockResolvedValueOnce({
        id: "ledger_account_pending_internal"
      })
      .mockResolvedValueOnce({
        id: "ledger_account_recipient"
      });
    transaction.customerAssetBalance.updateMany.mockResolvedValue({
      count: 1
    });
    transaction.customerAssetBalance.upsert.mockResolvedValue({
      availableBalance: new Prisma.Decimal("55"),
      pendingBalance: new Prisma.Decimal("0")
    });
    transaction.customerAssetBalance.findUnique.mockResolvedValue({
      availableBalance: new Prisma.Decimal("70"),
      pendingBalance: new Prisma.Decimal("0")
    });
    transaction.ledgerJournal.create.mockResolvedValue({
      id: "ledger_journal_internal_settlement_1"
    });
    transaction.ledgerPosting.createMany.mockResolvedValue({
      count: 2
    });

    const result = await service.settleInternalBalanceTransfer(
      transaction as never,
      {
        transactionIntentId: "intent_internal_1",
        senderCustomerAccountId: "account_1",
        recipientCustomerAccountId: "account_2",
        assetId: "asset_1",
        chainId: 8453,
        amount: new Prisma.Decimal("30"),
        settleFromPending: true
      }
    );

    expect(result.ledgerJournalId).toBe(
      "ledger_journal_internal_settlement_1"
    );
    expect(result.senderAvailableBalance).toBe("70");
    expect(result.senderPendingBalance).toBe("0");
    expect(result.recipientAvailableBalance).toBe("55");
    expect(result.recipientPendingBalance).toBe("0");
    expect(transaction.ledgerPosting.createMany).toHaveBeenCalledWith({
      data: [
        {
          ledgerJournalId: "ledger_journal_internal_settlement_1",
          ledgerAccountId: "ledger_account_pending_internal",
          direction: LedgerPostingDirection.debit,
          amount: new Prisma.Decimal("30")
        },
        {
          ledgerJournalId: "ledger_journal_internal_settlement_1",
          ledgerAccountId: "ledger_account_recipient",
          direction: LedgerPostingDirection.credit,
          amount: new Prisma.Decimal("30")
        }
      ]
    });
  });
});
