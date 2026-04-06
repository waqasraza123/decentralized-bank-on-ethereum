import { Injectable } from "@nestjs/common";
import { loadProductChainRuntimeConfig } from "@stealth-trails-bank/config/api";
import {
  AccountLifecycleStatus,
  BlockchainTransactionStatus,
  LedgerReconciliationMismatchSeverity,
  LedgerReconciliationMismatchStatus,
  LedgerReconciliationScanRunStatus,
  OversightIncidentStatus,
  PlatformAlertCategory,
  PlatformAlertSeverity,
  PlatformAlertStatus,
  Prisma,
  ReviewCaseStatus,
  TransactionIntentStatus,
  TransactionIntentType,
  WalletKind,
  WalletStatus,
  WorkerRuntimeEnvironment,
  WorkerRuntimeExecutionMode,
  WorkerRuntimeIterationStatus
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { GetOperationsStatusDto } from "./dto/get-operations-status.dto";
import { ListPlatformAlertsDto } from "./dto/list-platform-alerts.dto";
import { ListWorkerRuntimeHealthDto } from "./dto/list-worker-runtime-health.dto";
import { ReportWorkerRuntimeHeartbeatDto } from "./dto/report-worker-runtime-heartbeat.dto";

type WorkerRuntimeHeartbeatRecord = Prisma.WorkerRuntimeHeartbeatGetPayload<{}>;
type PlatformAlertRecord = Prisma.PlatformAlertGetPayload<{}>;

type WorkerRuntimeHealthProjection = {
  workerId: string;
  healthStatus: "healthy" | "degraded" | "stale";
  environment: WorkerRuntimeEnvironment;
  executionMode: WorkerRuntimeExecutionMode;
  lastIterationStatus: WorkerRuntimeIterationStatus;
  lastHeartbeatAt: string;
  lastIterationStartedAt: string | null;
  lastIterationCompletedAt: string | null;
  consecutiveFailureCount: number;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  lastReconciliationScanRunId: string | null;
  lastReconciliationScanStartedAt: string | null;
  lastReconciliationScanCompletedAt: string | null;
  lastReconciliationScanStatus: LedgerReconciliationScanRunStatus | null;
  runtimeMetadata: Prisma.JsonValue | null;
  latestIterationMetrics: Prisma.JsonValue | null;
  createdAt: string;
  updatedAt: string;
};

type WorkerRuntimeHeartbeatMutationResult = {
  heartbeat: WorkerRuntimeHealthProjection;
};

type WorkerRuntimeHealthListResult = {
  workers: WorkerRuntimeHealthProjection[];
  limit: number;
  staleAfterSeconds: number;
  totalCount: number;
};

type PlatformAlertProjection = {
  id: string;
  dedupeKey: string;
  category: PlatformAlertCategory;
  severity: PlatformAlertSeverity;
  status: PlatformAlertStatus;
  code: string;
  summary: string;
  detail: string | null;
  metadata: Prisma.JsonValue | null;
  firstDetectedAt: string;
  lastDetectedAt: string;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type PlatformAlertListResult = {
  alerts: PlatformAlertProjection[];
  limit: number;
  totalCount: number;
};

type OperationsSectionStatus = "healthy" | "warning" | "critical";

type OperationsStatusResult = {
  generatedAt: string;
  alertSummary: {
    openCount: number;
    criticalCount: number;
    warningCount: number;
  };
  workerHealth: {
    status: OperationsSectionStatus;
    staleAfterSeconds: number;
    totalWorkers: number;
    healthyWorkers: number;
    degradedWorkers: number;
    staleWorkers: number;
  };
  queueHealth: {
    status: OperationsSectionStatus;
    queuedDepositCount: number;
    queuedWithdrawalCount: number;
    totalQueuedCount: number;
    agedQueuedCount: number;
    manualWithdrawalBacklogCount: number;
    oldestQueuedIntentCreatedAt: string | null;
  };
  chainHealth: {
    status: OperationsSectionStatus;
    laggingBroadcastCount: number;
    criticalLaggingBroadcastCount: number;
    recentFailedTransactionCount: number;
    oldestLaggingBroadcastCreatedAt: string | null;
  };
  treasuryHealth: {
    status: OperationsSectionStatus;
    managedWorkerCount: number;
    activeTreasuryWalletCount: number;
    activeOperationalWalletCount: number;
    missingManagedWalletCoverage: boolean;
  };
  reconciliationHealth: {
    status: OperationsSectionStatus;
    openMismatchCount: number;
    criticalMismatchCount: number;
    recentFailedScanCount: number;
    latestScanStatus: LedgerReconciliationScanRunStatus | null;
    latestScanStartedAt: string | null;
  };
  incidentSafety: {
    status: OperationsSectionStatus;
    openReviewCaseCount: number;
    openOversightIncidentCount: number;
    activeRestrictedAccountCount: number;
  };
  recentAlerts: PlatformAlertProjection[];
};

type OperationsSnapshot = {
  generatedAt: Date;
  staleAfterSeconds: number;
  workers: WorkerRuntimeHealthProjection[];
  workerHealth: OperationsStatusResult["workerHealth"];
  queueHealth: OperationsStatusResult["queueHealth"];
  chainHealth: OperationsStatusResult["chainHealth"];
  treasuryHealth: OperationsStatusResult["treasuryHealth"];
  reconciliationHealth: OperationsStatusResult["reconciliationHealth"];
  incidentSafety: OperationsStatusResult["incidentSafety"];
  alertCandidates: PlatformAlertCandidate[];
};

type PlatformAlertCandidate = {
  dedupeKey: string;
  category: PlatformAlertCategory;
  severity: PlatformAlertSeverity;
  code: string;
  summary: string;
  detail: string | null;
  metadata: Prisma.InputJsonValue | null;
};

const DEFAULT_STALE_AFTER_SECONDS = 180;
const DEFAULT_RECENT_ALERT_LIMIT = 8;
const FAILED_SCAN_LOOKBACK_HOURS = 6;
const FAILED_BLOCKCHAIN_LOOKBACK_HOURS = 6;
const QUEUE_WARNING_COUNT = 10;
const QUEUE_CRITICAL_COUNT = 25;
const QUEUE_WARNING_AGE_SECONDS = 15 * 60;
const QUEUE_CRITICAL_AGE_SECONDS = 60 * 60;
const CHAIN_WARNING_AGE_SECONDS = 15 * 60;
const CHAIN_CRITICAL_AGE_SECONDS = 60 * 60;
const CHAIN_FAILED_WARNING_COUNT = 1;
const CHAIN_FAILED_CRITICAL_COUNT = 5;
const INCIDENT_REVIEW_WARNING_COUNT = 10;
const INCIDENT_OVERSIGHT_WARNING_COUNT = 5;
const INCIDENT_RESTRICTED_WARNING_COUNT = 5;

function buildPastDate(hours: number): Date {
  return new Date(Date.now() - hours * 60 * 60 * 1000);
}

function buildPastDateSeconds(seconds: number): Date {
  return new Date(Date.now() - seconds * 1000);
}

function isJsonObject(
  value: Prisma.JsonValue | null
): value is Prisma.JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function readJsonNumber(
  value: Prisma.JsonValue | null,
  key: string
): number {
  if (!isJsonObject(value)) {
    return 0;
  }

  const rawValue = value[key];
  return typeof rawValue === "number" && Number.isFinite(rawValue)
    ? rawValue
    : 0;
}

@Injectable()
export class OperationsMonitoringService {
  private readonly productChainId: number;

  constructor(private readonly prismaService: PrismaService) {
    this.productChainId = loadProductChainRuntimeConfig().productChainId;
  }

  private resolveHealthStatus(
    record: WorkerRuntimeHeartbeatRecord,
    staleAfterSeconds: number
  ): "healthy" | "degraded" | "stale" {
    const staleThresholdMs = staleAfterSeconds * 1000;
    const heartbeatAgeMs = Date.now() - record.lastHeartbeatAt.getTime();

    if (heartbeatAgeMs > staleThresholdMs) {
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

  private mapWorkerRuntimeHealthProjection(
    record: WorkerRuntimeHeartbeatRecord,
    staleAfterSeconds: number
  ): WorkerRuntimeHealthProjection {
    return {
      workerId: record.workerId,
      healthStatus: this.resolveHealthStatus(record, staleAfterSeconds),
      environment: record.environment,
      executionMode: record.executionMode,
      lastIterationStatus: record.lastIterationStatus,
      lastHeartbeatAt: record.lastHeartbeatAt.toISOString(),
      lastIterationStartedAt: record.lastIterationStartedAt?.toISOString() ?? null,
      lastIterationCompletedAt:
        record.lastIterationCompletedAt?.toISOString() ?? null,
      consecutiveFailureCount: record.consecutiveFailureCount,
      lastErrorCode: record.lastErrorCode ?? null,
      lastErrorMessage: record.lastErrorMessage ?? null,
      lastReconciliationScanRunId: record.lastReconciliationScanRunId ?? null,
      lastReconciliationScanStartedAt:
        record.lastReconciliationScanStartedAt?.toISOString() ?? null,
      lastReconciliationScanCompletedAt:
        record.lastReconciliationScanCompletedAt?.toISOString() ?? null,
      lastReconciliationScanStatus: record.lastReconciliationScanStatus ?? null,
      runtimeMetadata: record.runtimeMetadata ?? null,
      latestIterationMetrics: record.latestIterationMetrics ?? null,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString()
    };
  }

  private mapPlatformAlertProjection(
    record: PlatformAlertRecord
  ): PlatformAlertProjection {
    return {
      id: record.id,
      dedupeKey: record.dedupeKey,
      category: record.category,
      severity: record.severity,
      status: record.status,
      code: record.code,
      summary: record.summary,
      detail: record.detail ?? null,
      metadata: record.metadata ?? null,
      firstDetectedAt: record.firstDetectedAt.toISOString(),
      lastDetectedAt: record.lastDetectedAt.toISOString(),
      resolvedAt: record.resolvedAt?.toISOString() ?? null,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString()
    };
  }

  private summarizeWorkerHealth(
    workers: WorkerRuntimeHealthProjection[],
    staleAfterSeconds: number
  ): OperationsStatusResult["workerHealth"] {
    const healthyWorkers = workers.filter(
      (worker) => worker.healthStatus === "healthy"
    ).length;
    const degradedWorkers = workers.filter(
      (worker) => worker.healthStatus === "degraded"
    ).length;
    const staleWorkers = workers.filter(
      (worker) => worker.healthStatus === "stale"
    ).length;

    let status: OperationsSectionStatus = "healthy";

    if (workers.length === 0 || staleWorkers > 0) {
      status = "critical";
    } else if (degradedWorkers > 0) {
      status = "warning";
    }

    return {
      status,
      staleAfterSeconds,
      totalWorkers: workers.length,
      healthyWorkers,
      degradedWorkers,
      staleWorkers
    };
  }

  private buildAlertCandidates(snapshot: {
    workers: WorkerRuntimeHealthProjection[];
    workerHealth: OperationsStatusResult["workerHealth"];
    queueHealth: OperationsStatusResult["queueHealth"];
    chainHealth: OperationsStatusResult["chainHealth"];
    treasuryHealth: OperationsStatusResult["treasuryHealth"];
    reconciliationHealth: OperationsStatusResult["reconciliationHealth"];
  }): PlatformAlertCandidate[] {
    const alertCandidates: PlatformAlertCandidate[] = [];

    if (snapshot.workerHealth.totalWorkers === 0) {
      alertCandidates.push({
        dedupeKey: "worker:no-heartbeats",
        category: PlatformAlertCategory.worker,
        severity: PlatformAlertSeverity.critical,
        code: "worker_runtime_absent",
        summary: "No worker heartbeats are being recorded.",
        detail:
          "The platform has no active worker runtime heartbeat coverage, so queue execution and reconciliation scheduling may be stopped.",
        metadata: {
          runbookPath:
            "docs/runbooks/operations-monitoring-and-alerts-api.md",
          staleAfterSeconds: snapshot.workerHealth.staleAfterSeconds
        }
      });
    }

    for (const worker of snapshot.workers) {
      if (worker.healthStatus === "stale") {
        alertCandidates.push({
          dedupeKey: `worker:stale:${worker.workerId}`,
          category: PlatformAlertCategory.worker,
          severity: PlatformAlertSeverity.critical,
          code: "worker_heartbeat_stale",
          summary: `Worker ${worker.workerId} heartbeat is stale.`,
          detail: `The last heartbeat for ${worker.workerId} was recorded at ${worker.lastHeartbeatAt}.`,
          metadata: {
            runbookPath:
              "docs/runbooks/operations-monitoring-and-alerts-api.md",
            workerId: worker.workerId,
            lastHeartbeatAt: worker.lastHeartbeatAt,
            staleAfterSeconds: snapshot.workerHealth.staleAfterSeconds
          }
        });
      }

      if (worker.healthStatus === "degraded") {
        const severity =
          worker.lastIterationStatus === "failed" ||
          worker.lastReconciliationScanStatus === "failed" ||
          worker.consecutiveFailureCount >= 3
            ? PlatformAlertSeverity.critical
            : PlatformAlertSeverity.warning;

        alertCandidates.push({
          dedupeKey: `worker:degraded:${worker.workerId}`,
          category: PlatformAlertCategory.worker,
          severity,
          code: "worker_runtime_degraded",
          summary: `Worker ${worker.workerId} is degraded.`,
          detail:
            worker.lastErrorMessage ??
            `Iteration status is ${worker.lastIterationStatus} with ${worker.consecutiveFailureCount} consecutive failures.`,
          metadata: {
            runbookPath:
              "docs/runbooks/operations-monitoring-and-alerts-api.md",
            workerId: worker.workerId,
            lastIterationStatus: worker.lastIterationStatus,
            lastErrorCode: worker.lastErrorCode,
            consecutiveFailureCount: worker.consecutiveFailureCount,
            lastReconciliationScanStatus: worker.lastReconciliationScanStatus
          }
        });
      }
    }

    if (
      snapshot.reconciliationHealth.criticalMismatchCount > 0 ||
      snapshot.reconciliationHealth.recentFailedScanCount > 0
    ) {
      alertCandidates.push({
        dedupeKey: "reconciliation:core-health",
        category: PlatformAlertCategory.reconciliation,
        severity:
          snapshot.reconciliationHealth.criticalMismatchCount > 0
            ? PlatformAlertSeverity.critical
            : PlatformAlertSeverity.warning,
        code: "ledger_reconciliation_attention_required",
        summary: "Ledger reconciliation requires operator attention.",
        detail: `Open critical mismatches: ${snapshot.reconciliationHealth.criticalMismatchCount}. Failed scans in the recent window: ${snapshot.reconciliationHealth.recentFailedScanCount}.`,
        metadata: {
          runbookPath:
            "docs/runbooks/operations-monitoring-and-alerts-api.md",
          openMismatchCount: snapshot.reconciliationHealth.openMismatchCount,
          criticalMismatchCount:
            snapshot.reconciliationHealth.criticalMismatchCount,
          recentFailedScanCount:
            snapshot.reconciliationHealth.recentFailedScanCount,
          latestScanStatus: snapshot.reconciliationHealth.latestScanStatus,
          latestScanStartedAt: snapshot.reconciliationHealth.latestScanStartedAt
        }
      });
    }

    if (
      snapshot.queueHealth.totalQueuedCount >= QUEUE_WARNING_COUNT ||
      snapshot.queueHealth.agedQueuedCount > 0 ||
      snapshot.queueHealth.manualWithdrawalBacklogCount > 0
    ) {
      alertCandidates.push({
        dedupeKey: "queue:backlog",
        category: PlatformAlertCategory.queue,
        severity:
          snapshot.queueHealth.totalQueuedCount >= QUEUE_CRITICAL_COUNT ||
          snapshot.queueHealth.manualWithdrawalBacklogCount >= 10 ||
          snapshot.queueHealth.oldestQueuedIntentCreatedAt !== null
            ? snapshot.queueHealth.status === "critical"
              ? PlatformAlertSeverity.critical
              : PlatformAlertSeverity.warning
            : PlatformAlertSeverity.warning,
        code: "execution_queue_backlog",
        summary: "Execution queue backlog is above the healthy envelope.",
        detail: `Queued deposits: ${snapshot.queueHealth.queuedDepositCount}. Queued withdrawals: ${snapshot.queueHealth.queuedWithdrawalCount}. Manual withdrawal backlog: ${snapshot.queueHealth.manualWithdrawalBacklogCount}.`,
        metadata: {
          runbookPath:
            "docs/runbooks/operations-monitoring-and-alerts-api.md",
          queuedDepositCount: snapshot.queueHealth.queuedDepositCount,
          queuedWithdrawalCount: snapshot.queueHealth.queuedWithdrawalCount,
          agedQueuedCount: snapshot.queueHealth.agedQueuedCount,
          manualWithdrawalBacklogCount:
            snapshot.queueHealth.manualWithdrawalBacklogCount,
          oldestQueuedIntentCreatedAt:
            snapshot.queueHealth.oldestQueuedIntentCreatedAt
        }
      });
    }

    if (
      snapshot.chainHealth.laggingBroadcastCount > 0 ||
      snapshot.chainHealth.recentFailedTransactionCount > 0
    ) {
      alertCandidates.push({
        dedupeKey: "chain:broadcast-health",
        category: PlatformAlertCategory.chain,
        severity:
          snapshot.chainHealth.criticalLaggingBroadcastCount > 0 ||
          snapshot.chainHealth.recentFailedTransactionCount >=
            CHAIN_FAILED_CRITICAL_COUNT
            ? PlatformAlertSeverity.critical
            : PlatformAlertSeverity.warning,
        code: "chain_broadcast_confirmation_lag",
        summary: "Broadcast confirmations are lagging or failing.",
        detail: `Lagging broadcasts: ${snapshot.chainHealth.laggingBroadcastCount}. Recent failed blockchain transactions: ${snapshot.chainHealth.recentFailedTransactionCount}.`,
        metadata: {
          runbookPath:
            "docs/runbooks/operations-monitoring-and-alerts-api.md",
          laggingBroadcastCount: snapshot.chainHealth.laggingBroadcastCount,
          criticalLaggingBroadcastCount:
            snapshot.chainHealth.criticalLaggingBroadcastCount,
          recentFailedTransactionCount:
            snapshot.chainHealth.recentFailedTransactionCount,
          oldestLaggingBroadcastCreatedAt:
            snapshot.chainHealth.oldestLaggingBroadcastCreatedAt
        }
      });
    }

    if (snapshot.treasuryHealth.missingManagedWalletCoverage) {
      alertCandidates.push({
        dedupeKey: "treasury:managed-wallet-coverage",
        category: PlatformAlertCategory.treasury,
        severity: PlatformAlertSeverity.critical,
        code: "managed_wallet_boundary_missing",
        summary: "Managed execution is missing treasury or operational wallet coverage.",
        detail: `Managed workers: ${snapshot.treasuryHealth.managedWorkerCount}. Active treasury wallets: ${snapshot.treasuryHealth.activeTreasuryWalletCount}. Active operational wallets: ${snapshot.treasuryHealth.activeOperationalWalletCount}.`,
        metadata: {
          runbookPath:
            "docs/runbooks/operations-monitoring-and-alerts-api.md",
          managedWorkerCount: snapshot.treasuryHealth.managedWorkerCount,
          activeTreasuryWalletCount:
            snapshot.treasuryHealth.activeTreasuryWalletCount,
          activeOperationalWalletCount:
            snapshot.treasuryHealth.activeOperationalWalletCount,
          chainId: this.productChainId
        }
      });
    }

    return alertCandidates;
  }

  private async syncPlatformAlerts(
    alertCandidates: PlatformAlertCandidate[],
    generatedAt: Date
  ): Promise<void> {
    const activeDedupeKeys = new Set(
      alertCandidates.map((candidate) => candidate.dedupeKey)
    );

    for (const candidate of alertCandidates) {
      await this.prismaService.platformAlert.upsert({
        where: {
          dedupeKey: candidate.dedupeKey
        },
        create: {
          dedupeKey: candidate.dedupeKey,
          category: candidate.category,
          severity: candidate.severity,
          status: PlatformAlertStatus.open,
          code: candidate.code,
          summary: candidate.summary,
          detail: candidate.detail ?? null,
          metadata: candidate.metadata ?? Prisma.JsonNull,
          firstDetectedAt: generatedAt,
          lastDetectedAt: generatedAt,
          resolvedAt: null
        },
        update: {
          category: candidate.category,
          severity: candidate.severity,
          status: PlatformAlertStatus.open,
          code: candidate.code,
          summary: candidate.summary,
          detail: candidate.detail ?? null,
          metadata: candidate.metadata ?? Prisma.JsonNull,
          lastDetectedAt: generatedAt,
          resolvedAt: null
        }
      });
    }

    const existingOpenAlerts = await this.prismaService.platformAlert.findMany({
      where: {
        status: PlatformAlertStatus.open
      },
      select: {
        dedupeKey: true
      }
    });

    const resolvedAlertKeys = existingOpenAlerts
      .map((alert) => alert.dedupeKey)
      .filter((dedupeKey) => !activeDedupeKeys.has(dedupeKey));

    if (resolvedAlertKeys.length > 0) {
      await this.prismaService.platformAlert.updateMany({
        where: {
          dedupeKey: {
            in: resolvedAlertKeys
          },
          status: PlatformAlertStatus.open
        },
        data: {
          status: PlatformAlertStatus.resolved,
          resolvedAt: generatedAt,
          lastDetectedAt: generatedAt
        }
      });
    }
  }

  private async buildOperationsSnapshot(
    staleAfterSeconds: number
  ): Promise<OperationsSnapshot> {
    const failedScanSince = buildPastDate(FAILED_SCAN_LOOKBACK_HOURS);
    const failedBlockchainSince = buildPastDate(FAILED_BLOCKCHAIN_LOOKBACK_HOURS);
    const queueWarningBefore = buildPastDateSeconds(QUEUE_WARNING_AGE_SECONDS);
    const queueCriticalBefore = buildPastDateSeconds(QUEUE_CRITICAL_AGE_SECONDS);
    const chainWarningBefore = buildPastDateSeconds(CHAIN_WARNING_AGE_SECONDS);
    const chainCriticalBefore = buildPastDateSeconds(CHAIN_CRITICAL_AGE_SECONDS);

    const [
      workerRecords,
      queuedDepositCount,
      queuedWithdrawalCount,
      agedQueuedCount,
      oldestQueuedIntent,
      criticalLaggingBroadcastCount,
      warningLaggingBroadcastCount,
      oldestLaggingBroadcast,
      recentFailedTransactionCount,
      openMismatchCount,
      criticalMismatchCount,
      recentFailedScanCount,
      latestScanRun,
      activeTreasuryWalletCount,
      activeOperationalWalletCount,
      openReviewCaseCount,
      openOversightIncidentCount,
      activeRestrictedAccountCount
    ] = await Promise.all([
      this.prismaService.workerRuntimeHeartbeat.findMany({
        orderBy: {
          lastHeartbeatAt: "desc"
        }
      }),
      this.prismaService.transactionIntent.count({
        where: {
          status: TransactionIntentStatus.queued,
          intentType: TransactionIntentType.deposit
        }
      }),
      this.prismaService.transactionIntent.count({
        where: {
          status: TransactionIntentStatus.queued,
          intentType: TransactionIntentType.withdrawal
        }
      }),
      this.prismaService.transactionIntent.count({
        where: {
          status: TransactionIntentStatus.queued,
          createdAt: {
            lte: queueWarningBefore
          }
        }
      }),
      this.prismaService.transactionIntent.findFirst({
        where: {
          status: TransactionIntentStatus.queued
        },
        orderBy: {
          createdAt: "asc"
        },
        select: {
          createdAt: true
        }
      }),
      this.prismaService.blockchainTransaction.count({
        where: {
          status: BlockchainTransactionStatus.broadcast,
          confirmedAt: null,
          createdAt: {
            lte: chainCriticalBefore
          }
        }
      }),
      this.prismaService.blockchainTransaction.count({
        where: {
          status: BlockchainTransactionStatus.broadcast,
          confirmedAt: null,
          createdAt: {
            lte: chainWarningBefore
          }
        }
      }),
      this.prismaService.blockchainTransaction.findFirst({
        where: {
          status: BlockchainTransactionStatus.broadcast,
          confirmedAt: null,
          createdAt: {
            lte: chainWarningBefore
          }
        },
        orderBy: {
          createdAt: "asc"
        },
        select: {
          createdAt: true
        }
      }),
      this.prismaService.blockchainTransaction.count({
        where: {
          status: {
            in: [
              BlockchainTransactionStatus.failed,
              BlockchainTransactionStatus.dropped,
              BlockchainTransactionStatus.replaced
            ]
          },
          updatedAt: {
            gte: failedBlockchainSince
          }
        }
      }),
      this.prismaService.ledgerReconciliationMismatch.count({
        where: {
          status: LedgerReconciliationMismatchStatus.open
        }
      }),
      this.prismaService.ledgerReconciliationMismatch.count({
        where: {
          status: LedgerReconciliationMismatchStatus.open,
          severity: LedgerReconciliationMismatchSeverity.critical
        }
      }),
      this.prismaService.ledgerReconciliationScanRun.count({
        where: {
          status: LedgerReconciliationScanRunStatus.failed,
          startedAt: {
            gte: failedScanSince
          }
        }
      }),
      this.prismaService.ledgerReconciliationScanRun.findFirst({
        orderBy: {
          startedAt: "desc"
        },
        select: {
          status: true,
          startedAt: true
        }
      }),
      this.prismaService.wallet.count({
        where: {
          chainId: this.productChainId,
          kind: WalletKind.treasury,
          status: WalletStatus.active
        }
      }),
      this.prismaService.wallet.count({
        where: {
          chainId: this.productChainId,
          kind: WalletKind.operational,
          status: WalletStatus.active
        }
      }),
      this.prismaService.reviewCase.count({
        where: {
          status: {
            in: [ReviewCaseStatus.open, ReviewCaseStatus.in_progress]
          }
        }
      }),
      this.prismaService.oversightIncident.count({
        where: {
          status: {
            in: [OversightIncidentStatus.open, OversightIncidentStatus.in_progress]
          }
        }
      }),
      this.prismaService.customerAccount.count({
        where: {
          status: AccountLifecycleStatus.restricted
        }
      })
    ]);

    const workers = workerRecords.map((record) =>
      this.mapWorkerRuntimeHealthProjection(record, staleAfterSeconds)
    );
    const workerHealth = this.summarizeWorkerHealth(workers, staleAfterSeconds);

    const totalQueuedCount = queuedDepositCount + queuedWithdrawalCount;
    const manualWithdrawalBacklogCount = workers.reduce(
      (total, worker) =>
        total + readJsonNumber(worker.latestIterationMetrics, "manualWithdrawalBacklogCount"),
      0
    );
    const oldestQueuedIntentCreatedAt = oldestQueuedIntent?.createdAt.toISOString() ?? null;
    let queueStatus: OperationsSectionStatus = "healthy";

    if (
      totalQueuedCount >= QUEUE_CRITICAL_COUNT ||
      manualWithdrawalBacklogCount >= 10 ||
      (oldestQueuedIntentCreatedAt !== null &&
        new Date(oldestQueuedIntentCreatedAt).getTime() <=
          queueCriticalBefore.getTime())
    ) {
      queueStatus = "critical";
    } else if (
      totalQueuedCount >= QUEUE_WARNING_COUNT ||
      agedQueuedCount > 0 ||
      manualWithdrawalBacklogCount > 0
    ) {
      queueStatus = "warning";
    }

    const queueHealth: OperationsStatusResult["queueHealth"] = {
      status: queueStatus,
      queuedDepositCount,
      queuedWithdrawalCount,
      totalQueuedCount,
      agedQueuedCount,
      manualWithdrawalBacklogCount,
      oldestQueuedIntentCreatedAt
    };

    let chainStatus: OperationsSectionStatus = "healthy";

    if (
      criticalLaggingBroadcastCount > 0 ||
      recentFailedTransactionCount >= CHAIN_FAILED_CRITICAL_COUNT
    ) {
      chainStatus = "critical";
    } else if (
      warningLaggingBroadcastCount > 0 ||
      recentFailedTransactionCount >= CHAIN_FAILED_WARNING_COUNT
    ) {
      chainStatus = "warning";
    }

    const chainHealth: OperationsStatusResult["chainHealth"] = {
      status: chainStatus,
      laggingBroadcastCount: warningLaggingBroadcastCount,
      criticalLaggingBroadcastCount,
      recentFailedTransactionCount,
      oldestLaggingBroadcastCreatedAt:
        oldestLaggingBroadcast?.createdAt.toISOString() ?? null
    };

    const managedWorkerCount = workers.filter(
      (worker) =>
        worker.executionMode === WorkerRuntimeExecutionMode.managed &&
        worker.healthStatus !== "stale"
    ).length;
    const missingManagedWalletCoverage =
      managedWorkerCount > 0 &&
      (activeTreasuryWalletCount === 0 || activeOperationalWalletCount === 0);
    const treasuryStatus: OperationsSectionStatus = missingManagedWalletCoverage
      ? "critical"
      : "healthy";
    const treasuryHealth: OperationsStatusResult["treasuryHealth"] = {
      status: treasuryStatus,
      managedWorkerCount,
      activeTreasuryWalletCount,
      activeOperationalWalletCount,
      missingManagedWalletCoverage
    };

    let reconciliationStatus: OperationsSectionStatus = "healthy";

    if (criticalMismatchCount > 0 || recentFailedScanCount > 0) {
      reconciliationStatus = "critical";
    } else if (openMismatchCount > 0) {
      reconciliationStatus = "warning";
    }

    const reconciliationHealth: OperationsStatusResult["reconciliationHealth"] = {
      status: reconciliationStatus,
      openMismatchCount,
      criticalMismatchCount,
      recentFailedScanCount,
      latestScanStatus: latestScanRun?.status ?? null,
      latestScanStartedAt: latestScanRun?.startedAt.toISOString() ?? null
    };

    let incidentSafetyStatus: OperationsSectionStatus = "healthy";

    if (
      openReviewCaseCount >= INCIDENT_REVIEW_WARNING_COUNT ||
      openOversightIncidentCount >= INCIDENT_OVERSIGHT_WARNING_COUNT ||
      activeRestrictedAccountCount >= INCIDENT_RESTRICTED_WARNING_COUNT
    ) {
      incidentSafetyStatus = "warning";
    }

    const incidentSafety: OperationsStatusResult["incidentSafety"] = {
      status: incidentSafetyStatus,
      openReviewCaseCount,
      openOversightIncidentCount,
      activeRestrictedAccountCount
    };

    return {
      generatedAt: new Date(),
      staleAfterSeconds,
      workers,
      workerHealth,
      queueHealth,
      chainHealth,
      treasuryHealth,
      reconciliationHealth,
      incidentSafety,
      alertCandidates: this.buildAlertCandidates({
        workers,
        workerHealth,
        queueHealth,
        chainHealth,
        treasuryHealth,
        reconciliationHealth
      })
    };
  }

  async reportWorkerRuntimeHeartbeat(
    workerId: string,
    dto: ReportWorkerRuntimeHeartbeatDto
  ): Promise<WorkerRuntimeHeartbeatMutationResult> {
    const heartbeat = await this.prismaService.workerRuntimeHeartbeat.upsert({
      where: {
        workerId
      },
      create: {
        workerId,
        environment: dto.environment,
        executionMode: dto.executionMode,
        lastIterationStatus: dto.lastIterationStatus,
        lastHeartbeatAt: new Date(),
        lastIterationStartedAt: dto.lastIterationStartedAt
          ? new Date(dto.lastIterationStartedAt)
          : null,
        lastIterationCompletedAt: dto.lastIterationCompletedAt
          ? new Date(dto.lastIterationCompletedAt)
          : null,
        consecutiveFailureCount: dto.lastIterationStatus === "failed" ? 1 : 0,
        lastErrorCode: dto.lastErrorCode?.trim() || null,
        lastErrorMessage: dto.lastErrorMessage?.trim() || null,
        lastReconciliationScanRunId:
          dto.lastReconciliationScanRunId?.trim() || null,
        lastReconciliationScanStartedAt: dto.lastReconciliationScanStartedAt
          ? new Date(dto.lastReconciliationScanStartedAt)
          : null,
        lastReconciliationScanCompletedAt: dto.lastReconciliationScanCompletedAt
          ? new Date(dto.lastReconciliationScanCompletedAt)
          : null,
        lastReconciliationScanStatus:
          (dto.lastReconciliationScanStatus as LedgerReconciliationScanRunStatus | undefined) ??
          null,
        runtimeMetadata: dto.runtimeMetadata
          ? (dto.runtimeMetadata as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        latestIterationMetrics: dto.latestIterationMetrics
          ? ({
              ...dto.latestIterationMetrics,
              lastIterationDurationMs: dto.lastIterationDurationMs ?? null
            } as Prisma.InputJsonValue)
          : Prisma.JsonNull
      },
      update: {
        environment: dto.environment,
        executionMode: dto.executionMode,
        lastIterationStatus: dto.lastIterationStatus,
        lastHeartbeatAt: new Date(),
        lastIterationStartedAt: dto.lastIterationStartedAt
          ? new Date(dto.lastIterationStartedAt)
          : null,
        lastIterationCompletedAt: dto.lastIterationCompletedAt
          ? new Date(dto.lastIterationCompletedAt)
          : null,
        consecutiveFailureCount:
          dto.lastIterationStatus === "failed" ? { increment: 1 } : 0,
        lastErrorCode: dto.lastErrorCode?.trim() || null,
        lastErrorMessage: dto.lastErrorMessage?.trim() || null,
        lastReconciliationScanRunId:
          dto.lastReconciliationScanRunId?.trim() || null,
        lastReconciliationScanStartedAt: dto.lastReconciliationScanStartedAt
          ? new Date(dto.lastReconciliationScanStartedAt)
          : null,
        lastReconciliationScanCompletedAt: dto.lastReconciliationScanCompletedAt
          ? new Date(dto.lastReconciliationScanCompletedAt)
          : null,
        lastReconciliationScanStatus:
          (dto.lastReconciliationScanStatus as LedgerReconciliationScanRunStatus | undefined) ??
          null,
        runtimeMetadata: dto.runtimeMetadata
          ? (dto.runtimeMetadata as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        latestIterationMetrics: dto.latestIterationMetrics
          ? ({
              ...dto.latestIterationMetrics,
              lastIterationDurationMs: dto.lastIterationDurationMs ?? null
            } as Prisma.InputJsonValue)
          : Prisma.JsonNull
      }
    });

    return {
      heartbeat: this.mapWorkerRuntimeHealthProjection(
        heartbeat,
        DEFAULT_STALE_AFTER_SECONDS
      )
    };
  }

  async listWorkerRuntimeHealth(
    query: ListWorkerRuntimeHealthDto
  ): Promise<WorkerRuntimeHealthListResult> {
    const limit = query.limit ?? 20;
    const staleAfterSeconds =
      query.staleAfterSeconds ?? DEFAULT_STALE_AFTER_SECONDS;
    const where: Prisma.WorkerRuntimeHeartbeatWhereInput = {};

    if (query.workerId?.trim()) {
      where.workerId = query.workerId.trim();
    }

    const records = await this.prismaService.workerRuntimeHeartbeat.findMany({
      where,
      orderBy: {
        lastHeartbeatAt: "desc"
      },
      ...(query.healthStatus ? {} : { take: limit })
    });

    const projectedWorkers = records
      .map((record) =>
        this.mapWorkerRuntimeHealthProjection(record, staleAfterSeconds)
      )
      .filter((record) =>
        query.healthStatus ? record.healthStatus === query.healthStatus : true
      );

    return {
      workers: projectedWorkers.slice(0, limit),
      limit,
      staleAfterSeconds,
      totalCount: projectedWorkers.length
    };
  }

  async getOperationsStatus(
    query: GetOperationsStatusDto
  ): Promise<OperationsStatusResult> {
    const staleAfterSeconds =
      query.staleAfterSeconds ?? DEFAULT_STALE_AFTER_SECONDS;
    const recentAlertLimit = query.recentAlertLimit ?? DEFAULT_RECENT_ALERT_LIMIT;
    const snapshot = await this.buildOperationsSnapshot(staleAfterSeconds);

    await this.syncPlatformAlerts(snapshot.alertCandidates, snapshot.generatedAt);

    const [recentAlerts, openCount, criticalCount, warningCount] =
      await Promise.all([
        this.prismaService.platformAlert.findMany({
          where: {
            status: PlatformAlertStatus.open
          },
          orderBy: [
            {
              severity: "desc"
            },
            {
              lastDetectedAt: "desc"
            }
          ],
          take: recentAlertLimit
        }),
        this.prismaService.platformAlert.count({
          where: {
            status: PlatformAlertStatus.open
          }
        }),
        this.prismaService.platformAlert.count({
          where: {
            status: PlatformAlertStatus.open,
            severity: PlatformAlertSeverity.critical
          }
        }),
        this.prismaService.platformAlert.count({
          where: {
            status: PlatformAlertStatus.open,
            severity: PlatformAlertSeverity.warning
          }
        })
      ]);

    return {
      generatedAt: snapshot.generatedAt.toISOString(),
      alertSummary: {
        openCount,
        criticalCount,
        warningCount
      },
      workerHealth: snapshot.workerHealth,
      queueHealth: snapshot.queueHealth,
      chainHealth: snapshot.chainHealth,
      treasuryHealth: snapshot.treasuryHealth,
      reconciliationHealth: snapshot.reconciliationHealth,
      incidentSafety: snapshot.incidentSafety,
      recentAlerts: recentAlerts.map((alert) =>
        this.mapPlatformAlertProjection(alert)
      )
    };
  }

  async listPlatformAlerts(
    query: ListPlatformAlertsDto
  ): Promise<PlatformAlertListResult> {
    const limit = query.limit ?? 20;
    const staleAfterSeconds =
      query.staleAfterSeconds ?? DEFAULT_STALE_AFTER_SECONDS;
    const snapshot = await this.buildOperationsSnapshot(staleAfterSeconds);

    await this.syncPlatformAlerts(snapshot.alertCandidates, snapshot.generatedAt);

    const where: Prisma.PlatformAlertWhereInput = {};

    if (query.status) {
      where.status = query.status as PlatformAlertStatus;
    }

    if (query.severity) {
      where.severity = query.severity as PlatformAlertSeverity;
    }

    if (query.category) {
      where.category = query.category as PlatformAlertCategory;
    }

    const alerts = await this.prismaService.platformAlert.findMany({
      where,
      orderBy: [
        {
          status: "asc"
        },
        {
          severity: "desc"
        },
        {
          lastDetectedAt: "desc"
        }
      ],
      take: limit
    });

    const totalCount = await this.prismaService.platformAlert.count({
      where
    });

    return {
      alerts: alerts.map((alert) => this.mapPlatformAlertProjection(alert)),
      limit,
      totalCount
    };
  }
}
