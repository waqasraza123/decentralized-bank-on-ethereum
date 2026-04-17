import { BadRequestException } from "@nestjs/common";
import { AccountLifecycleStatus, AssetType, Prisma, WalletCustodyType, WalletStatus } from "@prisma/client";
import { AuthService } from "../auth/auth.service";
import { LedgerService } from "../ledger/ledger.service";
import { PrismaService } from "../prisma/prisma.service";
import { LoansService } from "./loans.service";

jest.mock("@stealth-trails-bank/config/api", () => ({
  loadOptionalBlockchainContractWriteRuntimeConfig: () => ({
    rpcUrl: "http://localhost:8545",
    ethereumPrivateKey: null,
    loanContractAddress: null
  })
}));

jest.mock("@stealth-trails-bank/contracts-sdk", () => ({
  createJsonRpcProvider: jest.fn(() => ({ provider: "mock" })),
  createLoanBookReadContract: jest.fn(),
  createLoanBookWriteContract: jest.fn()
}));

function createService() {
  const prismaService = {
    customerAssetBalance: {
      findMany: jest.fn(),
      findUnique: jest.fn()
    },
    asset: {
      findFirst: jest.fn(),
      findMany: jest.fn()
    },
    loanApplication: {
      findMany: jest.fn()
    },
    loanAgreement: {
      findMany: jest.fn(),
      findUnique: jest.fn()
    },
    $transaction: jest.fn()
  } as unknown as PrismaService;

  const authService = {
    getCustomerAccountProjectionBySupabaseUserId: jest.fn(),
    getCustomerWalletProjectionBySupabaseUserId: jest.fn()
  } as unknown as AuthService;

  const ledgerService = {
    recordLoanDisbursement: jest.fn(),
    recordLoanRepayment: jest.fn()
  } as unknown as LedgerService;

  return {
    prismaService,
    authService,
    ledgerService,
    service: new LoansService(prismaService, authService, ledgerService)
  };
}

function mockEligibleCustomerContext(deps: {
  prismaService: PrismaService;
  authService: AuthService;
}) {
  (
    deps.authService.getCustomerAccountProjectionBySupabaseUserId as jest.Mock
  ).mockResolvedValue({
    customer: {
      id: "customer_1",
      email: "amina@example.com",
      supabaseUserId: "supabase_user_1"
    },
    customerAccount: {
      id: "account_1",
      status: AccountLifecycleStatus.active
    }
  });

  (
    deps.authService.getCustomerWalletProjectionBySupabaseUserId as jest.Mock
  ).mockResolvedValue({
    wallet: {
      id: "wallet_1",
      address: "0x1111222233334444555566667777888899990000",
      status: WalletStatus.active,
      custodyType: WalletCustodyType.platform_managed
    }
  });

  (deps.prismaService.customerAssetBalance.findMany as jest.Mock).mockResolvedValue([
    {
      asset: {
        id: "asset_eth",
        symbol: "ETH",
        displayName: "Ether",
        decimals: 18,
        chainId: 8453,
        assetType: AssetType.native,
        contractAddress: null
      },
      availableBalance: new Prisma.Decimal("5"),
      pendingBalance: new Prisma.Decimal("0")
    },
    {
      asset: {
        id: "asset_usdc",
        symbol: "USDC",
        displayName: "USD Coin",
        decimals: 6,
        chainId: 8453,
        assetType: AssetType.erc20,
        contractAddress: "0x0000000000000000000000000000000000000abc"
      },
      availableBalance: new Prisma.Decimal("2000"),
      pendingBalance: new Prisma.Decimal("0")
    }
  ]);
}

describe("LoansService", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("builds a managed lending quote using the jurisdiction policy pack", async () => {
    const { service, prismaService, authService } = createService();
    mockEligibleCustomerContext({ prismaService, authService });

    (prismaService.asset.findFirst as jest.Mock)
      .mockResolvedValueOnce({
        id: "asset_usdc",
        symbol: "USDC",
        displayName: "USD Coin"
      })
      .mockResolvedValueOnce({
        id: "asset_eth",
        symbol: "ETH",
        displayName: "Ether"
      });

    const quote = await service.previewQuote("supabase_user_1", {
      jurisdiction: "usa",
      borrowAssetSymbol: "USDC",
      collateralAssetSymbol: "ETH",
      borrowAmount: "1000",
      collateralAmount: "1600",
      termMonths: "5",
      autopayEnabled: true
    });

    expect(quote.jurisdiction).toBe("usa");
    expect(quote.serviceFeeAmount).toBe("27.5");
    expect(quote.totalRepayableAmount).toBe("1027.5");
    expect(quote.installmentCount).toBe(5);
    expect(quote.warningLtvBps).toBe(6800);
    expect(quote.liquidationLtvBps).toBe(8000);
    expect(quote.disclosureSummary).toMatch(/fixed service fee/i);
  });

  it("rejects application submission when the customer does not accept the disclosure", async () => {
    const { service, prismaService, authService } = createService();
    mockEligibleCustomerContext({ prismaService, authService });

    await expect(
      service.createApplication("supabase_user_1", {
        jurisdiction: "usa",
        borrowAssetSymbol: "USDC",
        collateralAssetSymbol: "ETH",
        borrowAmount: "1000",
        collateralAmount: "1600",
        termMonths: "6",
        autopayEnabled: true,
        disclosureAcknowledgement: "I understand the managed lending disclosure.",
        acceptServiceFeeDisclosure: false
      })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("creates a managed lending application once eligibility and disclosure checks pass", async () => {
    const { service, prismaService, authService } = createService();
    mockEligibleCustomerContext({ prismaService, authService });

    (prismaService.asset.findFirst as jest.Mock)
      .mockResolvedValueOnce({
        id: "asset_usdc",
        symbol: "USDC",
        displayName: "USD Coin"
      })
      .mockResolvedValueOnce({
        id: "asset_eth",
        symbol: "ETH",
        displayName: "Ether"
      });

    (prismaService.asset.findMany as jest.Mock).mockResolvedValue([
      {
        id: "asset_eth",
        symbol: "ETH",
        displayName: "Ether",
        decimals: 18,
        chainId: 8453,
        assetType: AssetType.native,
        contractAddress: null
      },
      {
        id: "asset_usdc",
        symbol: "USDC",
        displayName: "USD Coin",
        decimals: 6,
        chainId: 8453,
        assetType: AssetType.erc20,
        contractAddress: "0x0000000000000000000000000000000000000abc"
      }
    ]);

    (prismaService.$transaction as jest.Mock).mockImplementation(async (callback) =>
      callback({
        loanApplication: {
          create: jest.fn().mockResolvedValue({
            id: "loan_application_1",
            status: "submitted"
          })
        },
        loanEvent: {
          create: jest.fn().mockResolvedValue({
            id: "loan_event_1"
          })
        }
      })
    );

    const created = await service.createApplication("supabase_user_1", {
      jurisdiction: "usa",
      borrowAssetSymbol: "USDC",
      collateralAssetSymbol: "ETH",
      borrowAmount: "1000",
      collateralAmount: "1600",
      termMonths: "6",
      autopayEnabled: true,
      disclosureAcknowledgement: "I understand the managed lending disclosure.",
      acceptServiceFeeDisclosure: true,
      supportNote: "Customer requested a six month facility."
    });

    expect(created.applicationId).toBe("loan_application_1");
    expect(created.status).toBe("submitted");
    expect(created.quote.serviceFeeAmount).toBe("27.5");
    expect(prismaService.$transaction).toHaveBeenCalledTimes(1);
  });

  it("records an immutable ledger journal when funding an agreement", async () => {
    const { service, prismaService, ledgerService } = createService();

    (prismaService.$transaction as jest.Mock).mockImplementation(async (callback) =>
      callback({
        loanAgreement: {
          findUnique: jest.fn().mockResolvedValue({
            id: "loan_agreement_1",
            status: "awaiting_funding",
            borrowAssetId: "asset_usdc",
            principalAmount: new Prisma.Decimal("1000"),
            serviceFeeAmount: new Prisma.Decimal("25"),
            borrowAsset: {
              chainId: 8453
            }
          }),
          update: jest.fn().mockResolvedValue({
            id: "loan_agreement_1",
            status: "active"
          })
        },
        loanCollateralPosition: {
          updateMany: jest.fn().mockResolvedValue({ count: 1 })
        },
        loanEvent: {
          create: jest.fn().mockResolvedValue({
            id: "loan_event_1"
          })
        }
      })
    );

    (ledgerService.recordLoanDisbursement as jest.Mock).mockResolvedValue({
      ledgerJournalId: "ledger_journal_1",
      principalReceivableLedgerAccountId: "principal_receivable_1",
      serviceFeeReceivableLedgerAccountId: "fee_receivable_1",
      serviceFeeIncomeLedgerAccountId: "fee_income_1",
      creditLedgerAccountId: "outbound_clearing_1"
    });

    const result = await service.fundAgreement("loan_agreement_1", "worker_1");

    expect(ledgerService.recordLoanDisbursement).toHaveBeenCalledWith(
      expect.anything(),
      {
        loanAgreementId: "loan_agreement_1",
        assetId: "asset_usdc",
        chainId: 8453,
        principalAmount: new Prisma.Decimal("1000"),
        serviceFeeAmount: new Prisma.Decimal("25")
      }
    );
    expect(result).toEqual({
      loanAgreementId: "loan_agreement_1",
      status: "active"
    });
  });

  it("records an immutable ledger journal when autopay settles a repayment", async () => {
    const { service, prismaService, ledgerService } = createService();

    (prismaService.loanAgreement.findUnique as jest.Mock).mockResolvedValue({
      id: "loan_agreement_1",
      customerAccountId: "account_1",
      borrowAssetId: "asset_usdc",
      jurisdiction: "usa",
      borrowAsset: {
        chainId: 8453
      },
      outstandingPrincipalAmount: new Prisma.Decimal("1000"),
      outstandingServiceFeeAmount: new Prisma.Decimal("25"),
      nextDueAt: new Date("2026-04-20T00:00:00.000Z"),
      installments: [
        {
          id: "installment_1",
          installmentNumber: 1,
          dueAt: new Date("2026-04-01T00:00:00.000Z"),
          status: "due",
          paidTotalAmount: new Prisma.Decimal("0"),
          scheduledTotalAmount: new Prisma.Decimal("205"),
          scheduledPrincipalAmount: new Prisma.Decimal("200"),
          scheduledServiceFeeAmount: new Prisma.Decimal("5")
        },
        {
          id: "installment_2",
          installmentNumber: 2,
          dueAt: new Date("2026-05-01T00:00:00.000Z")
        }
      ],
      repayments: [],
      collateralPositions: [],
      valuationSnapshots: [],
      liquidationCases: [],
      statements: [],
      events: [],
      autopayEnabled: true
    });

    (prismaService.customerAssetBalance.findUnique as jest.Mock).mockResolvedValue({
      availableBalance: new Prisma.Decimal("500")
    });

    (prismaService.$transaction as jest.Mock).mockImplementation(async (callback) =>
      callback({
        loanRepaymentEvent: {
          create: jest.fn().mockResolvedValue({
            id: "repayment_1"
          })
        },
        loanInstallment: {
          update: jest.fn().mockResolvedValue({
            id: "installment_1",
            status: "paid"
          })
        },
        loanAgreement: {
          update: jest.fn().mockResolvedValue({
            id: "loan_agreement_1",
            status: "active"
          })
        },
        loanEvent: {
          create: jest.fn().mockResolvedValue({
            id: "loan_event_1"
          })
        }
      })
    );

    (ledgerService.recordLoanRepayment as jest.Mock).mockResolvedValue({
      ledgerJournalId: "ledger_journal_2",
      debitLedgerAccountId: "customer_liability_1",
      principalReceivableLedgerAccountId: "principal_receivable_1",
      serviceFeeReceivableLedgerAccountId: "fee_receivable_1",
      availableBalance: "295"
    });

    const result = await service.runAutopay("loan_agreement_1", "worker_1");

    expect(ledgerService.recordLoanRepayment).toHaveBeenCalledWith(
      expect.anything(),
      {
        loanAgreementId: "loan_agreement_1",
        loanRepaymentEventId: "repayment_1",
        customerAccountId: "account_1",
        assetId: "asset_usdc",
        chainId: 8453,
        principalAmount: new Prisma.Decimal("200"),
        serviceFeeAmount: new Prisma.Decimal("5"),
        totalAmount: new Prisma.Decimal("205")
      }
    );
    expect(result).toEqual({
      loanAgreementId: "loan_agreement_1",
      attempted: true,
      succeeded: true,
      repaymentId: "repayment_1",
      status: "active"
    });
  });
});
