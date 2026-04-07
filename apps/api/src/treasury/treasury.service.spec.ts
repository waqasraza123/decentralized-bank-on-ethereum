import {
  LedgerReconciliationScanRunStatus,
  PlatformAlertCategory,
  PlatformAlertSeverity,
  PlatformAlertStatus,
  TransactionIntentType,
  WalletCustodyType,
  WalletKind,
  WalletStatus,
  WorkerRuntimeEnvironment,
  WorkerRuntimeExecutionMode,
  WorkerRuntimeIterationStatus
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { TreasuryService } from "./treasury.service";

jest.mock("@stealth-trails-bank/config/api", () => ({
  loadProductChainRuntimeConfig: () => ({
    productChainId: 8453
  })
}));

function createService() {
  const prismaService = {
    workerRuntimeHeartbeat: {
      findMany: jest.fn()
    },
    wallet: {
      findMany: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn()
    },
    transactionIntent: {
      findMany: jest.fn(),
      groupBy: jest.fn()
    },
    platformAlert: {
      count: jest.fn(),
      findMany: jest.fn()
    }
  } as unknown as PrismaService;

  return {
    prismaService,
    service: new TreasuryService(prismaService)
  };
}

describe("TreasuryService", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("builds treasury visibility with wallet inventory, recent activity, and alert context", async () => {
    const { service, prismaService } = createService();

    (prismaService.workerRuntimeHeartbeat.findMany as jest.Mock).mockResolvedValue([
      {
        id: "heartbeat_1",
        workerId: "worker_managed_1",
        environment: WorkerRuntimeEnvironment.production,
        executionMode: WorkerRuntimeExecutionMode.managed,
        lastIterationStatus: WorkerRuntimeIterationStatus.failed,
        lastHeartbeatAt: new Date("2026-04-07T06:00:00.000Z"),
        lastIterationStartedAt: new Date("2026-04-07T05:59:50.000Z"),
        lastIterationCompletedAt: new Date("2026-04-07T06:00:00.000Z"),
        consecutiveFailureCount: 2,
        lastErrorCode: "RPC_TIMEOUT",
        lastErrorMessage: "RPC timeout",
        lastReconciliationScanRunId: "scan_1",
        lastReconciliationScanStartedAt: new Date("2026-04-07T05:55:00.000Z"),
        lastReconciliationScanCompletedAt: new Date("2026-04-07T05:55:01.000Z"),
        lastReconciliationScanStatus: LedgerReconciliationScanRunStatus.succeeded,
        runtimeMetadata: null,
        latestIterationMetrics: null,
        createdAt: new Date("2026-04-07T05:00:00.000Z"),
        updatedAt: new Date("2026-04-07T06:00:00.000Z")
      }
    ]);
    (prismaService.wallet.findMany as jest.Mock).mockResolvedValue([
      {
        id: "wallet_treasury_1",
        chainId: 8453,
        address: "0x0000000000000000000000000000000000000aaa",
        kind: WalletKind.treasury,
        custodyType: WalletCustodyType.multisig_controlled,
        status: WalletStatus.active,
        customerAccountId: null,
        customerAccount: null,
        createdAt: new Date("2026-04-01T00:00:00.000Z"),
        updatedAt: new Date("2026-04-07T06:00:00.000Z")
      },
      {
        id: "wallet_operational_1",
        chainId: 8453,
        address: "0x0000000000000000000000000000000000000bbb",
        kind: WalletKind.operational,
        custodyType: WalletCustodyType.platform_managed,
        status: WalletStatus.active,
        customerAccountId: "account_unsafe",
        customerAccount: {
          id: "account_unsafe",
          status: "active",
          customer: {
            email: "mislinked@example.com",
            supabaseUserId: "user_unsafe",
            firstName: "Unsafe",
            lastName: "Link"
          }
        },
        createdAt: new Date("2026-04-02T00:00:00.000Z"),
        updatedAt: new Date("2026-04-07T06:10:00.000Z")
      }
    ]);
    (prismaService.wallet.count as jest.Mock)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1);
    (prismaService.wallet.groupBy as jest.Mock)
      .mockResolvedValueOnce([
        {
          kind: WalletKind.treasury,
          _count: { _all: 1 }
        },
        {
          kind: WalletKind.operational,
          _count: { _all: 1 }
        }
      ])
      .mockResolvedValueOnce([
        {
          status: WalletStatus.active,
          _count: { _all: 2 }
        }
      ])
      .mockResolvedValueOnce([
        {
          custodyType: WalletCustodyType.multisig_controlled,
          _count: { _all: 1 }
        },
        {
          custodyType: WalletCustodyType.platform_managed,
          _count: { _all: 1 }
        }
      ]);
    (prismaService.transactionIntent.findMany as jest.Mock).mockResolvedValue([
      {
        id: "intent_treasury_1",
        intentType: TransactionIntentType.treasury_transfer,
        status: "broadcast",
        policyDecision: "approved",
        requestedAmount: {
          toString: () => "10.5"
        },
        settledAmount: {
          toString: () => "10.5"
        },
        externalAddress: null,
        createdAt: new Date("2026-04-07T05:00:00.000Z"),
        updatedAt: new Date("2026-04-07T05:05:00.000Z"),
        asset: {
          id: "asset_1",
          symbol: "ETH",
          displayName: "Ether",
          decimals: 18,
          chainId: 8453
        },
        sourceWallet: {
          id: "wallet_treasury_1",
          address: "0x0000000000000000000000000000000000000aaa",
          kind: WalletKind.treasury,
          custodyType: WalletCustodyType.multisig_controlled,
          status: WalletStatus.active
        },
        destinationWallet: {
          id: "wallet_operational_1",
          address: "0x0000000000000000000000000000000000000bbb",
          kind: WalletKind.operational,
          custodyType: WalletCustodyType.platform_managed,
          status: WalletStatus.active
        },
        blockchainTransactions: [
          {
            id: "tx_1",
            txHash: "0xhash",
            status: "broadcast",
            fromAddress: "0x0000000000000000000000000000000000000aaa",
            toAddress: "0x0000000000000000000000000000000000000bbb",
            createdAt: new Date("2026-04-07T05:01:00.000Z"),
            updatedAt: new Date("2026-04-07T05:02:00.000Z"),
            confirmedAt: null
          }
        ]
      }
    ]);
    (prismaService.transactionIntent.groupBy as jest.Mock)
      .mockResolvedValueOnce([
        {
          sourceWalletId: "wallet_treasury_1",
          _count: { _all: 3 },
          _max: {
            updatedAt: new Date("2026-04-07T05:05:00.000Z")
          }
        }
      ])
      .mockResolvedValueOnce([
        {
          destinationWalletId: "wallet_operational_1",
          _count: { _all: 2 },
          _max: {
            updatedAt: new Date("2026-04-07T05:05:00.000Z")
          }
        }
      ]);
    (prismaService.platformAlert.count as jest.Mock).mockResolvedValue(1);
    (prismaService.platformAlert.findMany as jest.Mock).mockResolvedValue([
      {
        id: "alert_1",
        dedupeKey: "treasury:managed-wallet-coverage",
        category: PlatformAlertCategory.treasury,
        severity: PlatformAlertSeverity.critical,
        status: PlatformAlertStatus.open,
        code: "treasury_managed_wallet_coverage_missing",
        summary: "Managed execution is missing wallet coverage.",
        detail: "No operational wallet.",
        metadata: {
          managedWorkerCount: 1
        },
        firstDetectedAt: new Date("2026-04-07T05:30:00.000Z"),
        lastDetectedAt: new Date("2026-04-07T06:00:00.000Z"),
        resolvedAt: null,
        createdAt: new Date("2026-04-07T05:30:00.000Z"),
        updatedAt: new Date("2026-04-07T06:00:00.000Z")
      }
    ]);

    jest.spyOn(Date, "now").mockReturnValue(
      new Date("2026-04-07T06:00:30.000Z").getTime()
    );

    const result = await service.getTreasuryOverview({
      walletLimit: 10,
      activityLimit: 10,
      alertLimit: 5,
      staleAfterSeconds: 180
    });

    expect(result.coverage.status).toBe("critical");
    expect(result.coverage.customerLinkedWalletCount).toBe(1);
    expect(result.coverage.managedWorkerCount).toBe(1);
    expect(result.coverage.degradedManagedWorkerCount).toBe(1);
    expect(result.walletSummary.totalWalletCount).toBe(2);
    expect(result.wallets[0]?.recentIntentCount).toBe(3);
    expect(result.wallets[1]?.customerAssignment?.email).toBe(
      "mislinked@example.com"
    );
    expect(result.recentActivity[0]?.transactionIntentId).toBe("intent_treasury_1");
    expect(result.recentAlerts[0]?.code).toBe(
      "treasury_managed_wallet_coverage_missing"
    );
  });
});
