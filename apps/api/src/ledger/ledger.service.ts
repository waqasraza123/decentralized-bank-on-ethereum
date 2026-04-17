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
  transactionIntentId: string;
  customerAccountId: string;
  assetId: string;
  chainId: number;
  amount: Prisma.Decimal;
};

type ReleaseWithdrawalReservationParams = {
  transactionIntentId: string;
  customerAccountId: string;
  assetId: string;
  chainId: number;
  amount: Prisma.Decimal;
};

type WithdrawalBalanceTransitionResult = {
  ledgerJournalId: string;
  debitLedgerAccountId: string;
  creditLedgerAccountId: string;
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

type RecordLoanDisbursementParams = {
  loanAgreementId: string;
  assetId: string;
  chainId: number;
  principalAmount: Prisma.Decimal;
  serviceFeeAmount: Prisma.Decimal;
};

type LoanDisbursementLedgerResult = {
  ledgerJournalId: string;
  principalReceivableLedgerAccountId: string;
  serviceFeeReceivableLedgerAccountId: string | null;
  serviceFeeIncomeLedgerAccountId: string | null;
  creditLedgerAccountId: string;
};

type RecordLoanRepaymentParams = {
  loanAgreementId: string;
  loanRepaymentEventId: string;
  customerAccountId: string;
  assetId: string;
  chainId: number;
  principalAmount: Prisma.Decimal;
  serviceFeeAmount: Prisma.Decimal;
  totalAmount: Prisma.Decimal;
};

type LoanRepaymentLedgerResult = {
  ledgerJournalId: string;
  debitLedgerAccountId: string;
  principalReceivableLedgerAccountId: string;
  serviceFeeReceivableLedgerAccountId: string | null;
  availableBalance: string;
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

  private buildPendingWithdrawalLiabilityLedgerKey(
    customerAccountId: string,
    assetId: string
  ): string {
    return `customer_asset_pending_withdrawal_liability:${customerAccountId}:${assetId}`;
  }

  private buildLoanPrincipalReceivableLedgerKey(
    loanAgreementId: string,
    assetId: string
  ): string {
    return `loan_principal_receivable:${loanAgreementId}:${assetId}`;
  }

  private buildLoanServiceFeeReceivableLedgerKey(
    loanAgreementId: string,
    assetId: string
  ): string {
    return `loan_service_fee_receivable:${loanAgreementId}:${assetId}`;
  }

  private buildLoanServiceFeeIncomeLedgerKey(
    chainId: number,
    assetId: string
  ): string {
    return `loan_service_fee_income:${chainId}:${assetId}`;
  }

  private async findLedgerJournalByIntentAndType(
    transaction: Prisma.TransactionClient,
    transactionIntentId: string,
    journalType: LedgerJournalType
  ): Promise<{ id: string } | null> {
    return transaction.ledgerJournal.findUnique({
      where: {
        transactionIntentId_journalType: {
          transactionIntentId,
          journalType
        }
      },
      select: {
        id: true
      }
    });
  }

  private async findLedgerJournalByLoanAgreementAndType(
    transaction: Prisma.TransactionClient,
    loanAgreementId: string,
    journalType: LedgerJournalType
  ): Promise<{ id: string } | null> {
    return transaction.ledgerJournal.findUnique({
      where: {
        loanAgreementId_journalType: {
          loanAgreementId,
          journalType
        }
      },
      select: {
        id: true
      }
    });
  }

  private async findLedgerJournalByLoanRepaymentEventAndType(
    transaction: Prisma.TransactionClient,
    loanRepaymentEventId: string,
    journalType: LedgerJournalType
  ): Promise<{ id: string } | null> {
    return transaction.ledgerJournal.findUnique({
      where: {
        loanRepaymentEventId_journalType: {
          loanRepaymentEventId,
          journalType
        }
      },
      select: {
        id: true
      }
    });
  }

  async settleConfirmedDeposit(
    transaction: Prisma.TransactionClient,
    params: SettleConfirmedDepositParams
  ): Promise<SettledDepositLedgerResult> {
    const existingJournal = await this.findLedgerJournalByIntentAndType(
      transaction,
      params.transactionIntentId,
      LedgerJournalType.deposit_settlement
    );

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
    const existingJournal = await this.findLedgerJournalByIntentAndType(
      transaction,
      params.transactionIntentId,
      LedgerJournalType.withdrawal_reservation
    );

    if (existingJournal) {
      throw new ConflictException(
        "Withdrawal reservation ledger journal already exists for this transaction intent."
      );
    }

    const customerAvailableLiabilityAccount = await transaction.ledgerAccount.upsert({
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

    const customerPendingLiabilityAccount = await transaction.ledgerAccount.upsert({
      where: {
        ledgerKey: this.buildPendingWithdrawalLiabilityLedgerKey(
          params.customerAccountId,
          params.assetId
        )
      },
      update: {},
      create: {
        ledgerKey: this.buildPendingWithdrawalLiabilityLedgerKey(
          params.customerAccountId,
          params.assetId
        ),
        accountType: LedgerAccountType.customer_asset_pending_withdrawal_liability,
        chainId: params.chainId,
        assetId: params.assetId,
        customerAccountId: params.customerAccountId
      }
    });

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

    const ledgerJournal = await transaction.ledgerJournal.create({
      data: {
        transactionIntentId: params.transactionIntentId,
        journalType: LedgerJournalType.withdrawal_reservation,
        chainId: params.chainId,
        assetId: params.assetId
      }
    });

    await transaction.ledgerPosting.createMany({
      data: [
        {
          ledgerJournalId: ledgerJournal.id,
          ledgerAccountId: customerAvailableLiabilityAccount.id,
          direction: LedgerPostingDirection.debit,
          amount: params.amount
        },
        {
          ledgerJournalId: ledgerJournal.id,
          ledgerAccountId: customerPendingLiabilityAccount.id,
          direction: LedgerPostingDirection.credit,
          amount: params.amount
        }
      ]
    });

    return {
      ledgerJournalId: ledgerJournal.id,
      debitLedgerAccountId: customerAvailableLiabilityAccount.id,
      creditLedgerAccountId: customerPendingLiabilityAccount.id,
      availableBalance: updatedBalance.availableBalance.toString(),
      pendingBalance: updatedBalance.pendingBalance.toString()
    };
  }

  async releaseWithdrawalReservation(
    transaction: Prisma.TransactionClient,
    params: ReleaseWithdrawalReservationParams
  ): Promise<WithdrawalBalanceTransitionResult> {
    const existingJournal = await this.findLedgerJournalByIntentAndType(
      transaction,
      params.transactionIntentId,
      LedgerJournalType.withdrawal_reservation_release
    );

    if (existingJournal) {
      throw new ConflictException(
        "Withdrawal reservation release ledger journal already exists for this transaction intent."
      );
    }

    const customerAvailableLiabilityAccount = await transaction.ledgerAccount.upsert({
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

    const customerPendingLiabilityAccount = await transaction.ledgerAccount.upsert({
      where: {
        ledgerKey: this.buildPendingWithdrawalLiabilityLedgerKey(
          params.customerAccountId,
          params.assetId
        )
      },
      update: {},
      create: {
        ledgerKey: this.buildPendingWithdrawalLiabilityLedgerKey(
          params.customerAccountId,
          params.assetId
        ),
        accountType: LedgerAccountType.customer_asset_pending_withdrawal_liability,
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

    const ledgerJournal = await transaction.ledgerJournal.create({
      data: {
        transactionIntentId: params.transactionIntentId,
        journalType: LedgerJournalType.withdrawal_reservation_release,
        chainId: params.chainId,
        assetId: params.assetId
      }
    });

    await transaction.ledgerPosting.createMany({
      data: [
        {
          ledgerJournalId: ledgerJournal.id,
          ledgerAccountId: customerPendingLiabilityAccount.id,
          direction: LedgerPostingDirection.debit,
          amount: params.amount
        },
        {
          ledgerJournalId: ledgerJournal.id,
          ledgerAccountId: customerAvailableLiabilityAccount.id,
          direction: LedgerPostingDirection.credit,
          amount: params.amount
        }
      ]
    });

    return {
      ledgerJournalId: ledgerJournal.id,
      debitLedgerAccountId: customerPendingLiabilityAccount.id,
      creditLedgerAccountId: customerAvailableLiabilityAccount.id,
      availableBalance: updatedBalance.availableBalance.toString(),
      pendingBalance: updatedBalance.pendingBalance.toString()
    };
  }

  async settleConfirmedWithdrawal(
    transaction: Prisma.TransactionClient,
    params: SettleConfirmedWithdrawalParams
  ): Promise<SettledWithdrawalLedgerResult> {
    const existingJournal = await this.findLedgerJournalByIntentAndType(
      transaction,
      params.transactionIntentId,
      LedgerJournalType.withdrawal_settlement
    );

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

    const customerPendingLiabilityAccount = await transaction.ledgerAccount.upsert({
      where: {
        ledgerKey: this.buildPendingWithdrawalLiabilityLedgerKey(
          params.customerAccountId,
          params.assetId
        )
      },
      update: {},
      create: {
        ledgerKey: this.buildPendingWithdrawalLiabilityLedgerKey(
          params.customerAccountId,
          params.assetId
        ),
        accountType: LedgerAccountType.customer_asset_pending_withdrawal_liability,
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
          ledgerAccountId: customerPendingLiabilityAccount.id,
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
      debitLedgerAccountId: customerPendingLiabilityAccount.id,
      creditLedgerAccountId: outboundClearingAccount.id,
      availableBalance: updatedBalance.availableBalance.toString(),
      pendingBalance: updatedBalance.pendingBalance.toString()
    };
  }

  async recordLoanDisbursement(
    transaction: Prisma.TransactionClient,
    params: RecordLoanDisbursementParams
  ): Promise<LoanDisbursementLedgerResult> {
    const existingJournal = await this.findLedgerJournalByLoanAgreementAndType(
      transaction,
      params.loanAgreementId,
      LedgerJournalType.loan_disbursement
    );

    if (existingJournal) {
      throw new ConflictException(
        "Loan disbursement ledger journal already exists for this agreement."
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

    const principalReceivableAccount = await transaction.ledgerAccount.upsert({
      where: {
        ledgerKey: this.buildLoanPrincipalReceivableLedgerKey(
          params.loanAgreementId,
          params.assetId
        )
      },
      update: {},
      create: {
        ledgerKey: this.buildLoanPrincipalReceivableLedgerKey(
          params.loanAgreementId,
          params.assetId
        ),
        accountType: LedgerAccountType.loan_principal_receivable,
        chainId: params.chainId,
        assetId: params.assetId
      }
    });

    const serviceFeeReceivableAccount =
      params.serviceFeeAmount.greaterThan(0)
        ? await transaction.ledgerAccount.upsert({
            where: {
              ledgerKey: this.buildLoanServiceFeeReceivableLedgerKey(
                params.loanAgreementId,
                params.assetId
              )
            },
            update: {},
            create: {
              ledgerKey: this.buildLoanServiceFeeReceivableLedgerKey(
                params.loanAgreementId,
                params.assetId
              ),
              accountType: LedgerAccountType.loan_service_fee_receivable,
              chainId: params.chainId,
              assetId: params.assetId
            }
          })
        : null;

    const serviceFeeIncomeAccount =
      params.serviceFeeAmount.greaterThan(0)
        ? await transaction.ledgerAccount.upsert({
            where: {
              ledgerKey: this.buildLoanServiceFeeIncomeLedgerKey(
                params.chainId,
                params.assetId
              )
            },
            update: {},
            create: {
              ledgerKey: this.buildLoanServiceFeeIncomeLedgerKey(
                params.chainId,
                params.assetId
              ),
              accountType: LedgerAccountType.loan_service_fee_income,
              chainId: params.chainId,
              assetId: params.assetId
            }
          })
        : null;

    const ledgerJournal = await transaction.ledgerJournal.create({
      data: {
        loanAgreementId: params.loanAgreementId,
        journalType: LedgerJournalType.loan_disbursement,
        chainId: params.chainId,
        assetId: params.assetId
      }
    });

    const postings: Prisma.LedgerPostingCreateManyInput[] = [
      {
        ledgerJournalId: ledgerJournal.id,
        ledgerAccountId: principalReceivableAccount.id,
        direction: LedgerPostingDirection.debit,
        amount: params.principalAmount
      },
      {
        ledgerJournalId: ledgerJournal.id,
        ledgerAccountId: outboundClearingAccount.id,
        direction: LedgerPostingDirection.credit,
        amount: params.principalAmount
      }
    ];

    if (serviceFeeReceivableAccount && serviceFeeIncomeAccount) {
      postings.push(
        {
          ledgerJournalId: ledgerJournal.id,
          ledgerAccountId: serviceFeeReceivableAccount.id,
          direction: LedgerPostingDirection.debit,
          amount: params.serviceFeeAmount
        },
        {
          ledgerJournalId: ledgerJournal.id,
          ledgerAccountId: serviceFeeIncomeAccount.id,
          direction: LedgerPostingDirection.credit,
          amount: params.serviceFeeAmount
        }
      );
    }

    await transaction.ledgerPosting.createMany({
      data: postings
    });

    return {
      ledgerJournalId: ledgerJournal.id,
      principalReceivableLedgerAccountId: principalReceivableAccount.id,
      serviceFeeReceivableLedgerAccountId:
        serviceFeeReceivableAccount?.id ?? null,
      serviceFeeIncomeLedgerAccountId: serviceFeeIncomeAccount?.id ?? null,
      creditLedgerAccountId: outboundClearingAccount.id
    };
  }

  async recordLoanRepayment(
    transaction: Prisma.TransactionClient,
    params: RecordLoanRepaymentParams
  ): Promise<LoanRepaymentLedgerResult> {
    const existingJournal = await this.findLedgerJournalByLoanRepaymentEventAndType(
      transaction,
      params.loanRepaymentEventId,
      LedgerJournalType.loan_repayment
    );

    if (existingJournal) {
      throw new ConflictException(
        "Loan repayment ledger journal already exists for this repayment event."
      );
    }

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

    const principalReceivableAccount = await transaction.ledgerAccount.upsert({
      where: {
        ledgerKey: this.buildLoanPrincipalReceivableLedgerKey(
          params.loanAgreementId,
          params.assetId
        )
      },
      update: {},
      create: {
        ledgerKey: this.buildLoanPrincipalReceivableLedgerKey(
          params.loanAgreementId,
          params.assetId
        ),
        accountType: LedgerAccountType.loan_principal_receivable,
        chainId: params.chainId,
        assetId: params.assetId
      }
    });

    const serviceFeeReceivableAccount =
      params.serviceFeeAmount.greaterThan(0)
        ? await transaction.ledgerAccount.upsert({
            where: {
              ledgerKey: this.buildLoanServiceFeeReceivableLedgerKey(
                params.loanAgreementId,
                params.assetId
              )
            },
            update: {},
            create: {
              ledgerKey: this.buildLoanServiceFeeReceivableLedgerKey(
                params.loanAgreementId,
                params.assetId
              ),
              accountType: LedgerAccountType.loan_service_fee_receivable,
              chainId: params.chainId,
              assetId: params.assetId
            }
          })
        : null;

    const updatedBalance = await transaction.customerAssetBalance.updateMany({
      where: {
        customerAccountId: params.customerAccountId,
        assetId: params.assetId,
        availableBalance: {
          gte: params.totalAmount
        }
      },
      data: {
        availableBalance: {
          decrement: params.totalAmount
        }
      }
    });

    if (updatedBalance.count !== 1) {
      throw new ConflictException(
        "Managed balance is not available to settle the loan repayment."
      );
    }

    const refreshedBalance = await transaction.customerAssetBalance.findUnique({
      where: {
        customerAccountId_assetId: {
          customerAccountId: params.customerAccountId,
          assetId: params.assetId
        }
      },
      select: {
        availableBalance: true
      }
    });

    if (!refreshedBalance) {
      throw new ConflictException("Customer balance row not found.");
    }

    const ledgerJournal = await transaction.ledgerJournal.create({
      data: {
        loanRepaymentEventId: params.loanRepaymentEventId,
        loanAgreementId: params.loanAgreementId,
        journalType: LedgerJournalType.loan_repayment,
        chainId: params.chainId,
        assetId: params.assetId
      }
    });

    const postings: Prisma.LedgerPostingCreateManyInput[] = [
      {
        ledgerJournalId: ledgerJournal.id,
        ledgerAccountId: customerLiabilityAccount.id,
        direction: LedgerPostingDirection.debit,
        amount: params.totalAmount
      },
      {
        ledgerJournalId: ledgerJournal.id,
        ledgerAccountId: principalReceivableAccount.id,
        direction: LedgerPostingDirection.credit,
        amount: params.principalAmount
      }
    ];

    if (serviceFeeReceivableAccount) {
      postings.push({
        ledgerJournalId: ledgerJournal.id,
        ledgerAccountId: serviceFeeReceivableAccount.id,
        direction: LedgerPostingDirection.credit,
        amount: params.serviceFeeAmount
      });
    }

    await transaction.ledgerPosting.createMany({
      data: postings
    });

    return {
      ledgerJournalId: ledgerJournal.id,
      debitLedgerAccountId: customerLiabilityAccount.id,
      principalReceivableLedgerAccountId: principalReceivableAccount.id,
      serviceFeeReceivableLedgerAccountId:
        serviceFeeReceivableAccount?.id ?? null,
      availableBalance: refreshedBalance.availableBalance.toString()
    };
  }
}
