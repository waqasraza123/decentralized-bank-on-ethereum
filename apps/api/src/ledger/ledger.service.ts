import { ConflictException, Injectable } from "@nestjs/common";
import {
  LedgerAccountType,
  LedgerJournalType,
  LedgerPostingDirection,
  Prisma
} from "@prisma/client";

type SettleConfirmedDepositParams = {
  transactionIntentId: string;
  customerAccountId: string;
  assetId: string;
  chainId: number;
  amount: Prisma.Decimal;
};

type SettledDepositLedgerResult = {
  ledgerJournalId: string;
  debitLedgerAccountId: string;
  creditLedgerAccountId: string;
  availableBalance: string;
};

type ReserveWithdrawalBalanceParams = {
  customerAccountId: string;
  assetId: string;
  amount: Prisma.Decimal;
};

type ReleaseWithdrawalReservationParams = {
  customerAccountId: string;
  assetId: string;
  amount: Prisma.Decimal;
};

type WithdrawalBalanceTransitionResult = {
  availableBalance: string;
  pendingBalance: string;
};

type SettleConfirmedWithdrawalParams = {
  transactionIntentId: string;
  customerAccountId: string;
  assetId: string;
  chainId: number;
  amount: Prisma.Decimal;
};

type SettledWithdrawalLedgerResult = {
  ledgerJournalId: string;
  debitLedgerAccountId: string;
  creditLedgerAccountId: string;
  availableBalance: string;
  pendingBalance: string;
};

@Injectable()
export class LedgerService {
  private buildInboundClearingLedgerKey(chainId: number, assetId: string): string {
    return `asset_inbound_clearing:${chainId}:${assetId}`;
  }

  private buildOutboundClearingLedgerKey(
    chainId: number,
    assetId: string
  ): string {
    return `asset_outbound_clearing:${chainId}:${assetId}`;
  }

  private buildCustomerLiabilityLedgerKey(
    customerAccountId: string,
    assetId: string
  ): string {
    return `customer_asset_liability:${customerAccountId}:${assetId}`;
  }

  async settleConfirmedDeposit(
    transaction: Prisma.TransactionClient,
    params: SettleConfirmedDepositParams
  ): Promise<SettledDepositLedgerResult> {
    const existingJournal = await transaction.ledgerJournal.findUnique({
      where: {
        transactionIntentId: params.transactionIntentId
      },
      select: {
        id: true
      }
    });

    if (existingJournal) {
      throw new ConflictException(
        "Ledger settlement already exists for this transaction intent."
      );
    }

    const inboundClearingAccount = await transaction.ledgerAccount.upsert({
      where: {
        ledgerKey: this.buildInboundClearingLedgerKey(
          params.chainId,
          params.assetId
        )
      },
      update: {},
      create: {
        ledgerKey: this.buildInboundClearingLedgerKey(
          params.chainId,
          params.assetId
        ),
        accountType: LedgerAccountType.asset_inbound_clearing,
        chainId: params.chainId,
        assetId: params.assetId
      }
    });

    const customerLiabilityAccount = await transaction.ledgerAccount.upsert({
      where: {
        ledgerKey: this.buildCustomerLiabilityLedgerKey(
          params.customerAccountId,
          params.assetId
        )
      },
      update: {},
      create: {
        ledgerKey: this.buildCustomerLiabilityLedgerKey(
          params.customerAccountId,
          params.assetId
        ),
        accountType: LedgerAccountType.customer_asset_liability,
        chainId: params.chainId,
        assetId: params.assetId,
        customerAccountId: params.customerAccountId
      }
    });

    const ledgerJournal = await transaction.ledgerJournal.create({
      data: {
        transactionIntentId: params.transactionIntentId,
        journalType: LedgerJournalType.deposit_settlement,
        chainId: params.chainId,
        assetId: params.assetId
      }
    });

    await transaction.ledgerPosting.createMany({
      data: [
        {
          ledgerJournalId: ledgerJournal.id,
          ledgerAccountId: inboundClearingAccount.id,
          direction: LedgerPostingDirection.debit,
          amount: params.amount
        },
        {
          ledgerJournalId: ledgerJournal.id,
          ledgerAccountId: customerLiabilityAccount.id,
          direction: LedgerPostingDirection.credit,
          amount: params.amount
        }
      ]
    });

    const customerAssetBalance = await transaction.customerAssetBalance.upsert({
      where: {
        customerAccountId_assetId: {
          customerAccountId: params.customerAccountId,
          assetId: params.assetId
        }
      },
      create: {
        customerAccountId: params.customerAccountId,
        assetId: params.assetId,
        availableBalance: params.amount,
        pendingBalance: new Prisma.Decimal(0)
      },
      update: {
        availableBalance: {
          increment: params.amount
        }
      }
    });

    return {
      ledgerJournalId: ledgerJournal.id,
      debitLedgerAccountId: inboundClearingAccount.id,
      creditLedgerAccountId: customerLiabilityAccount.id,
      availableBalance: customerAssetBalance.availableBalance.toString()
    };
  }

  async reserveWithdrawalBalance(
    transaction: Prisma.TransactionClient,
    params: ReserveWithdrawalBalanceParams
  ): Promise<WithdrawalBalanceTransitionResult> {
    const updatedBalanceCount = await transaction.customerAssetBalance.updateMany({
      where: {
        customerAccountId: params.customerAccountId,
        assetId: params.assetId,
        availableBalance: {
          gte: params.amount
        }
      },
      data: {
        availableBalance: {
          decrement: params.amount
        },
        pendingBalance: {
          increment: params.amount
        }
      }
    });

    if (updatedBalanceCount.count !== 1) {
      throw new ConflictException(
        "Insufficient available balance for withdrawal request."
      );
    }

    const updatedBalance = await transaction.customerAssetBalance.findUnique({
      where: {
        customerAccountId_assetId: {
          customerAccountId: params.customerAccountId,
          assetId: params.assetId
        }
      },
      select: {
        availableBalance: true,
        pendingBalance: true
      }
    });

    if (!updatedBalance) {
      throw new ConflictException("Customer balance row not found.");
    }

    return {
      availableBalance: updatedBalance.availableBalance.toString(),
      pendingBalance: updatedBalance.pendingBalance.toString()
    };
  }

  async releaseWithdrawalReservation(
    transaction: Prisma.TransactionClient,
    params: ReleaseWithdrawalReservationParams
  ): Promise<WithdrawalBalanceTransitionResult> {
    const updatedBalanceCount = await transaction.customerAssetBalance.updateMany({
      where: {
        customerAccountId: params.customerAccountId,
        assetId: params.assetId,
        pendingBalance: {
          gte: params.amount
        }
      },
      data: {
        availableBalance: {
          increment: params.amount
        },
        pendingBalance: {
          decrement: params.amount
        }
      }
    });

    if (updatedBalanceCount.count !== 1) {
      throw new ConflictException(
        "Withdrawal reservation is not available to release."
      );
    }

    const updatedBalance = await transaction.customerAssetBalance.findUnique({
      where: {
        customerAccountId_assetId: {
          customerAccountId: params.customerAccountId,
          assetId: params.assetId
        }
      },
      select: {
        availableBalance: true,
        pendingBalance: true
      }
    });

    if (!updatedBalance) {
      throw new ConflictException("Customer balance row not found.");
    }

    return {
      availableBalance: updatedBalance.availableBalance.toString(),
      pendingBalance: updatedBalance.pendingBalance.toString()
    };
  }

  async settleConfirmedWithdrawal(
    transaction: Prisma.TransactionClient,
    params: SettleConfirmedWithdrawalParams
  ): Promise<SettledWithdrawalLedgerResult> {
    const existingJournal = await transaction.ledgerJournal.findUnique({
      where: {
        transactionIntentId: params.transactionIntentId
      },
      select: {
        id: true
      }
    });

    if (existingJournal) {
      throw new ConflictException(
        "Ledger settlement already exists for this transaction intent."
      );
    }

    const outboundClearingAccount = await transaction.ledgerAccount.upsert({
      where: {
        ledgerKey: this.buildOutboundClearingLedgerKey(
          params.chainId,
          params.assetId
        )
      },
      update: {},
      create: {
        ledgerKey: this.buildOutboundClearingLedgerKey(
          params.chainId,
          params.assetId
        ),
        accountType: LedgerAccountType.asset_outbound_clearing,
        chainId: params.chainId,
        assetId: params.assetId
      }
    });

    const customerLiabilityAccount = await transaction.ledgerAccount.upsert({
      where: {
        ledgerKey: this.buildCustomerLiabilityLedgerKey(
          params.customerAccountId,
          params.assetId
        )
      },
      update: {},
      create: {
        ledgerKey: this.buildCustomerLiabilityLedgerKey(
          params.customerAccountId,
          params.assetId
        ),
        accountType: LedgerAccountType.customer_asset_liability,
        chainId: params.chainId,
        assetId: params.assetId,
        customerAccountId: params.customerAccountId
      }
    });

    const updatedBalanceCount = await transaction.customerAssetBalance.updateMany({
      where: {
        customerAccountId: params.customerAccountId,
        assetId: params.assetId,
        pendingBalance: {
          gte: params.amount
        }
      },
      data: {
        pendingBalance: {
          decrement: params.amount
        }
      }
    });

    if (updatedBalanceCount.count !== 1) {
      throw new ConflictException(
        "Reserved withdrawal balance is not available to settle."
      );
    }

    const updatedBalance = await transaction.customerAssetBalance.findUnique({
      where: {
        customerAccountId_assetId: {
          customerAccountId: params.customerAccountId,
          assetId: params.assetId
        }
      },
      select: {
        availableBalance: true,
        pendingBalance: true
      }
    });

    if (!updatedBalance) {
      throw new ConflictException("Customer balance row not found.");
    }

    const ledgerJournal = await transaction.ledgerJournal.create({
      data: {
        transactionIntentId: params.transactionIntentId,
        journalType: LedgerJournalType.withdrawal_settlement,
        chainId: params.chainId,
        assetId: params.assetId
      }
    });

    await transaction.ledgerPosting.createMany({
      data: [
        {
          ledgerJournalId: ledgerJournal.id,
          ledgerAccountId: customerLiabilityAccount.id,
          direction: LedgerPostingDirection.debit,
          amount: params.amount
        },
        {
          ledgerJournalId: ledgerJournal.id,
          ledgerAccountId: outboundClearingAccount.id,
          direction: LedgerPostingDirection.credit,
          amount: params.amount
        }
      ]
    });

    return {
      ledgerJournalId: ledgerJournal.id,
      debitLedgerAccountId: customerLiabilityAccount.id,
      creditLedgerAccountId: outboundClearingAccount.id,
      availableBalance: updatedBalance.availableBalance.toString(),
      pendingBalance: updatedBalance.pendingBalance.toString()
    };
  }
}
