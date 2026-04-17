import { Injectable } from "@nestjs/common";
import { loadProductChainRuntimeConfig } from "@stealth-trails-bank/config/api";
import {
  PlatformAlertCategory,
  PlatformAlertStatus,
  Prisma,
  TransactionIntentType,
  WalletKind,
  WorkerRuntimeExecutionMode,
  WorkerRuntimeIterationStatus,
  LedgerReconciliationScanRunStatus
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { GetTreasuryOverviewDto } from "./dto/get-treasury-overview.dto";

const DEFAULT_WALLET_LIMIT = 12;
const DEFAULT_ACTIVITY_LIMIT = 12;
const DEFAULT_ALERT_LIMIT = 6;
const DEFAULT_STALE_AFTER_SECONDS = 180;

const treasuryWalletKinds = [WalletKind.treasury, WalletKind.operational];

const walletInclude = {
  customerAccount: {
    select: {
      id: true,
      status: true,
      customer: {
        select: {
          email: true,
          supabaseUserId: true,
          firstName: true,
          lastName: true
        }
      }
    }
  }
} satisfies Prisma.WalletInclude;

const transactionIntentInclude = {
  asset: {
    select: {
      id: true,
      symbol: true,
      displayName: true,
      decimals: true,
      chainId: true
    }
  },
  sourceWallet: {
    select: {
      id: true,
      address: true,
      kind: true,
      custodyType: true,
      status: true
    }
  },
  destinationWallet: {
    select: {
      id: true,
      address: true,
      kind: true,
      custodyType: true,
      status: true
    }
  },
  blockchainTransactions: {
    orderBy: {
      createdAt: "desc"
    },
    take: 1,
    select: {
      id: true,
      txHash: true,
      status: true,
      fromAddress: true,
      toAddress: true,
      broadcastAt: true,
      createdAt: true,
      updatedAt: true,
      confirmedAt: true
    }
  }
} satisfies Prisma.TransactionIntentInclude;

type WalletRecord = Prisma.WalletGetPayload<{
  include: typeof walletInclude;
}>;

type TransactionIntentRecord = Prisma.TransactionIntentGetPayload<{
  include: typeof transactionIntentInclude;
}>;

type WorkerHeartbeatRecord = Prisma.WorkerRuntimeHeartbeatGetPayload<{}>;
type PlatformAlertRecord = Prisma.PlatformAlertGetPayload<{}>;

type TreasuryOverviewResult = {
  generatedAt: string;
  coverage: {
    status: "healthy" | "warning" | "critical";
    staleAfterSeconds: number;
    managedWorkerCount: number;
    degradedManagedWorkerCount: number;
    staleManagedWorkerCount: number;
    activeTreasuryWalletCount: number;
    activeOperationalWalletCount: number;
    customerLinkedWalletCount: number;
    missingManagedWalletCoverage: boolean;
    openTreasuryAlertCount: number;
  };
  walletSummary: {
    totalWalletCount: number;
    byKind: Array<{
      kind: WalletKind;
      count: number;
    }>;
    byStatus: Array<{
      status: string;
      count: number;
    }>;
    byCustodyType: Array<{
      custodyType: string;
      count: number;
    }>;
  };
  managedWorkers: Array<{
    workerId: string;
    healthStatus: "healthy" | "degraded" | "stale";
    environment: string;
    lastIterationStatus: string;
    lastHeartbeatAt: string;
    consecutiveFailureCount: number;
    lastErrorCode: string | null;
    lastErrorMessage: string | null;
  }>;
  wallets: Array<{
    id: string;
    chainId: number;
    address: string;
    kind: WalletKind;
    custodyType: string;
    status: string;
    recentIntentCount: number;
    lastActivityAt: string | null;
    createdAt: string;
    updatedAt: string;
    customerAssignment: {
      customerAccountId: string;
      accountStatus: string;
      email: string | null;
      supabaseUserId: string | null;
      firstName: string | null;
      lastName: string | null;
    } | null;
  }>;
  recentActivity: Array<{
    transactionIntentId: string;
    intentType: string;
    status: string;
    policyDecision: string;
    requestedAmount: string;
    settledAmount: string | null;
    executionFailureCategory: string | null;
    executionFailureObservedAt: string | null;
    manualInterventionRequiredAt: string | null;
    manualInterventionReviewCaseId: string | null;
    externalAddress: string | null;
    createdAt: string;
    updatedAt: string;
    asset: {
      id: string;
      symbol: string;
      displayName: string;
      decimals: number;
      chainId: number;
    };
    sourceWallet: {
      id: string;
      address: string;
      kind: string;
      custodyType: string;
      status: string;
    } | null;
    destinationWallet: {
      id: string;
      address: string;
      kind: string;
      custodyType: string;
      status: string;
    } | null;
    latestBlockchainTransaction: {
      id: string;
      txHash: string | null;
      status: string;
      fromAddress: string | null;
      toAddress: string | null;
      broadcastAt: string | null;
      createdAt: string;
      updatedAt: string;
      confirmedAt: string | null;
    } | null;
  }>;
  recentAlerts: Array<{
    id: string;
    dedupeKey: string;
    severity: string;
    status: string;
    code: string;
    summary: string;
    detail: string | null;
    metadata: Prisma.JsonValue | null;
    firstDetectedAt: string;
    lastDetectedAt: string;
    resolvedAt: string | null;
  }>;
};

function mergeLastActivity(
  current: Date | null,
  candidate?: Date | null
): Date | null {
  if (!candidate) {
    return current;
  }

  if (!current || candidate.getTime() > current.getTime()) {
    return candidate;
  }

  return current;
}

@Injectable()
export class TreasuryService {
  private readonly productChainId: number;

  constructor(private readonly prismaService: PrismaService) {
    this.productChainId = loadProductChainRuntimeConfig().productChainId;
  }

  private resolveWorkerHealthStatus(
    record: WorkerHeartbeatRecord,
    staleAfterSeconds: number
  ): "healthy" | "degraded" | "stale" {
    const heartbeatAgeMs = Date.now() - record.lastHeartbeatAt.getTime();

    if (heartbeatAgeMs > staleAfterSeconds * 1000) {
      return "stale";
    }

    if (
      record.lastIterationStatus === WorkerRuntimeIterationStatus.failed ||
      record.consecutiveFailureCount > 0 ||
      record.lastReconciliationScanStatus === LedgerReconciliationScanRunStatus.failed
    ) {
      return "degraded";
    }

    return "healthy";
  }

  private mapWalletActivity(
    walletIds: string[],
    sourceStats: Array<{
      sourceWalletId: string | null;
      _count: { _all: number };
      _max: { updatedAt: Date | null };
    }>,
    destinationStats: Array<{
      destinationWalletId: string | null;
      _count: { _all: number };
      _max: { updatedAt: Date | null };
    }>
  ): Map<string, { recentIntentCount: number; lastActivityAt: Date | null }> {
    const stats = new Map<
      string,
      { recentIntentCount: number; lastActivityAt: Date | null }
    >();

    for (const walletId of walletIds) {
      stats.set(walletId, {
        recentIntentCount: 0,
        lastActivityAt: null
      });
    }

    for (const sourceStat of sourceStats) {
      if (!sourceStat.sourceWalletId) {
        continue;
      }

      const current = stats.get(sourceStat.sourceWalletId);

      if (!current) {
        continue;
      }

      current.recentIntentCount += sourceStat._count._all;
      current.lastActivityAt = mergeLastActivity(
        current.lastActivityAt,
        sourceStat._max.updatedAt
      );
    }

    for (const destinationStat of destinationStats) {
      if (!destinationStat.destinationWalletId) {
        continue;
      }

      const current = stats.get(destinationStat.destinationWalletId);

      if (!current) {
        continue;
      }

      current.recentIntentCount += destinationStat._count._all;
      current.lastActivityAt = mergeLastActivity(
        current.lastActivityAt,
        destinationStat._max.updatedAt
      );
    }

    return stats;
  }

  private mapWallet(record: WalletRecord, activity: {
    recentIntentCount: number;
    lastActivityAt: Date | null;
  }) {
    return {
      id: record.id,
      chainId: record.chainId,
      address: record.address,
      kind: record.kind,
      custodyType: record.custodyType,
      status: record.status,
      recentIntentCount: activity.recentIntentCount,
      lastActivityAt: activity.lastActivityAt?.toISOString() ?? null,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
      customerAssignment: record.customerAccount
        ? {
            customerAccountId: record.customerAccount.id,
            accountStatus: record.customerAccount.status,
            email: record.customerAccount.customer.email ?? null,
            supabaseUserId:
              record.customerAccount.customer.supabaseUserId ?? null,
            firstName: record.customerAccount.customer.firstName ?? null,
            lastName: record.customerAccount.customer.lastName ?? null
          }
        : null
    };
  }

  private mapRecentActivity(record: TransactionIntentRecord) {
    const latestTransaction = record.blockchainTransactions[0] ?? null;

    return {
      transactionIntentId: record.id,
      intentType: record.intentType,
      status: record.status,
      policyDecision: record.policyDecision,
      requestedAmount: record.requestedAmount.toString(),
      settledAmount: record.settledAmount?.toString() ?? null,
      executionFailureCategory: record.executionFailureCategory ?? null,
      executionFailureObservedAt:
        record.executionFailureObservedAt?.toISOString() ?? null,
      manualInterventionRequiredAt:
        record.manualInterventionRequiredAt?.toISOString() ?? null,
      manualInterventionReviewCaseId:
        record.manualInterventionReviewCaseId ?? null,
      externalAddress: record.externalAddress ?? null,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
      asset: {
        id: record.asset.id,
        symbol: record.asset.symbol,
        displayName: record.asset.displayName,
        decimals: record.asset.decimals,
        chainId: record.asset.chainId
      },
      sourceWallet: record.sourceWallet
        ? {
            id: record.sourceWallet.id,
            address: record.sourceWallet.address,
            kind: record.sourceWallet.kind,
            custodyType: record.sourceWallet.custodyType,
            status: record.sourceWallet.status
          }
        : null,
      destinationWallet: record.destinationWallet
        ? {
            id: record.destinationWallet.id,
            address: record.destinationWallet.address,
            kind: record.destinationWallet.kind,
            custodyType: record.destinationWallet.custodyType,
            status: record.destinationWallet.status
          }
        : null,
      latestBlockchainTransaction: latestTransaction
        ? {
            id: latestTransaction.id,
            txHash: latestTransaction.txHash ?? null,
            status: latestTransaction.status,
            fromAddress: latestTransaction.fromAddress ?? null,
            toAddress: latestTransaction.toAddress ?? null,
            broadcastAt: latestTransaction.broadcastAt?.toISOString() ?? null,
            createdAt: latestTransaction.createdAt.toISOString(),
            updatedAt: latestTransaction.updatedAt.toISOString(),
            confirmedAt: latestTransaction.confirmedAt?.toISOString() ?? null
          }
        : null
    };
  }

  private mapAlert(record: PlatformAlertRecord) {
    return {
      id: record.id,
      dedupeKey: record.dedupeKey,
      severity: record.severity,
      status: record.status,
      code: record.code,
      summary: record.summary,
      detail: record.detail ?? null,
      metadata: record.metadata ?? null,
      firstDetectedAt: record.firstDetectedAt.toISOString(),
      lastDetectedAt: record.lastDetectedAt.toISOString(),
      resolvedAt: record.resolvedAt?.toISOString() ?? null
    };
  }

  async getTreasuryOverview(
    query: GetTreasuryOverviewDto
  ): Promise<TreasuryOverviewResult> {
    const walletLimit = query.walletLimit ?? DEFAULT_WALLET_LIMIT;
    const activityLimit = query.activityLimit ?? DEFAULT_ACTIVITY_LIMIT;
    const alertLimit = query.alertLimit ?? DEFAULT_ALERT_LIMIT;
    const staleAfterSeconds =
      query.staleAfterSeconds ?? DEFAULT_STALE_AFTER_SECONDS;

    const walletWhere: Prisma.WalletWhereInput = {
      chainId: this.productChainId,
      kind: {
        in: treasuryWalletKinds
      }
    };

    const [
      managedWorkerRecords,
      wallets,
      totalWalletCount,
      walletKindCounts,
      walletStatusCounts,
      walletCustodyCounts,
      customerLinkedWalletCount,
      activeTreasuryWalletCount,
      activeOperationalWalletCount,
      recentActivity,
      openTreasuryAlertCount,
      recentAlerts
    ] = await Promise.all([
      this.prismaService.workerRuntimeHeartbeat.findMany({
        where: {
          executionMode: WorkerRuntimeExecutionMode.managed
        },
        orderBy: {
          lastHeartbeatAt: "desc"
        }
      }),
      this.prismaService.wallet.findMany({
        where: walletWhere,
        include: walletInclude,
        orderBy: [
          {
            kind: "asc"
          },
          {
            updatedAt: "desc"
          }
        ],
        take: walletLimit
      }),
      this.prismaService.wallet.count({
        where: walletWhere
      }),
      this.prismaService.wallet.groupBy({
        by: ["kind"],
        where: walletWhere,
        _count: {
          _all: true
        }
      }),
      this.prismaService.wallet.groupBy({
        by: ["status"],
        where: walletWhere,
        _count: {
          _all: true
        }
      }),
      this.prismaService.wallet.groupBy({
        by: ["custodyType"],
        where: walletWhere,
        _count: {
          _all: true
        }
      }),
      this.prismaService.wallet.count({
        where: {
          ...walletWhere,
          customerAccountId: {
            not: null
          }
        }
      }),
      this.prismaService.wallet.count({
        where: {
          chainId: this.productChainId,
          kind: WalletKind.treasury,
          status: "active"
        }
      }),
      this.prismaService.wallet.count({
        where: {
          chainId: this.productChainId,
          kind: WalletKind.operational,
          status: "active"
        }
      }),
      this.prismaService.transactionIntent.findMany({
        where: {
          chainId: this.productChainId,
          OR: [
            {
              intentType: TransactionIntentType.treasury_transfer
            },
            {
              sourceWallet: {
                is: {
                  kind: {
                    in: treasuryWalletKinds
                  }
                }
              }
            },
            {
              destinationWallet: {
                is: {
                  kind: {
                    in: treasuryWalletKinds
                  }
                }
              }
            }
          ]
        },
        include: transactionIntentInclude,
        orderBy: {
          createdAt: "desc"
        },
        take: activityLimit
      }),
      this.prismaService.platformAlert.count({
        where: {
          category: PlatformAlertCategory.treasury,
          status: PlatformAlertStatus.open
        }
      }),
      this.prismaService.platformAlert.findMany({
        where: {
          category: PlatformAlertCategory.treasury,
          status: PlatformAlertStatus.open
        },
        orderBy: {
          lastDetectedAt: "desc"
        },
        take: alertLimit
      })
    ]);

    const walletIds = wallets.map((wallet) => wallet.id);

    const [sourceStats, destinationStats] =
      walletIds.length === 0
        ? [[], []]
        : await Promise.all([
            this.prismaService.transactionIntent.groupBy({
              by: ["sourceWalletId"],
              where: {
                sourceWalletId: {
                  in: walletIds
                }
              },
              _count: {
                _all: true
              },
              _max: {
                updatedAt: true
              }
            }),
            this.prismaService.transactionIntent.groupBy({
              by: ["destinationWalletId"],
              where: {
                destinationWalletId: {
                  in: walletIds
                }
              },
              _count: {
                _all: true
              },
              _max: {
                updatedAt: true
              }
            })
          ]);

    const walletActivity = this.mapWalletActivity(
      walletIds,
      sourceStats,
      destinationStats
    );

    const managedWorkers = managedWorkerRecords.map((record) => ({
      workerId: record.workerId,
      healthStatus: this.resolveWorkerHealthStatus(record, staleAfterSeconds),
      environment: record.environment,
      lastIterationStatus: record.lastIterationStatus,
      lastHeartbeatAt: record.lastHeartbeatAt.toISOString(),
      consecutiveFailureCount: record.consecutiveFailureCount,
      lastErrorCode: record.lastErrorCode ?? null,
      lastErrorMessage: record.lastErrorMessage ?? null
    }));
    const managedWorkerCount = managedWorkers.length;
    const degradedManagedWorkerCount = managedWorkers.filter(
      (worker) => worker.healthStatus === "degraded"
    ).length;
    const staleManagedWorkerCount = managedWorkers.filter(
      (worker) => worker.healthStatus === "stale"
    ).length;
    const missingManagedWalletCoverage =
      managedWorkerCount > 0 &&
      (activeTreasuryWalletCount === 0 || activeOperationalWalletCount === 0);

    let coverageStatus: "healthy" | "warning" | "critical" = "healthy";

    if (missingManagedWalletCoverage || customerLinkedWalletCount > 0) {
      coverageStatus = "critical";
    } else if (
      degradedManagedWorkerCount > 0 ||
      staleManagedWorkerCount > 0 ||
      openTreasuryAlertCount > 0
    ) {
      coverageStatus = "warning";
    }

    return {
      generatedAt: new Date().toISOString(),
      coverage: {
        status: coverageStatus,
        staleAfterSeconds,
        managedWorkerCount,
        degradedManagedWorkerCount,
        staleManagedWorkerCount,
        activeTreasuryWalletCount,
        activeOperationalWalletCount,
        customerLinkedWalletCount,
        missingManagedWalletCoverage,
        openTreasuryAlertCount
      },
      walletSummary: {
        totalWalletCount,
        byKind: walletKindCounts.map((entry) => ({
          kind: entry.kind,
          count: entry._count._all
        })),
        byStatus: walletStatusCounts.map((entry) => ({
          status: entry.status,
          count: entry._count._all
        })),
        byCustodyType: walletCustodyCounts.map((entry) => ({
          custodyType: entry.custodyType,
          count: entry._count._all
        }))
      },
      managedWorkers,
      wallets: wallets.map((wallet) =>
        this.mapWallet(
          wallet,
          walletActivity.get(wallet.id) ?? {
            recentIntentCount: 0,
            lastActivityAt: null
          }
        )
      ),
      recentActivity: recentActivity.map((record) =>
        this.mapRecentActivity(record)
      ),
      recentAlerts: recentAlerts.map((alert) => this.mapAlert(alert))
    };
  }
}
