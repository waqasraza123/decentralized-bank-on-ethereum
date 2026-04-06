import {
  LedgerReconciliationScanRunStatus,
  PlatformAlertCategory,
  PlatformAlertSeverity,
  PlatformAlertStatus,
  WorkerRuntimeExecutionMode,
  WorkerRuntimeEnvironment,
  WorkerRuntimeIterationStatus
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { OperationsMonitoringService } from "./operations-monitoring.service";

jest.mock("@stealth-trails-bank/config/api", () => ({
  loadProductChainRuntimeConfig: () => ({
    productChainId: 8453
  })
}));

function buildHeartbeatRecord(
  overrides: Partial<Record<string, unknown>> = {}
) {
  return {
    id: "heartbeat_1",
    workerId: "worker_1",
    environment: WorkerRuntimeEnvironment.production,
    executionMode: WorkerRuntimeExecutionMode.monitor,
    lastIterationStatus: WorkerRuntimeIterationStatus.succeeded,
    lastHeartbeatAt: new Date("2026-04-06T10:00:00.000Z"),
    lastIterationStartedAt: new Date("2026-04-06T09:59:58.000Z"),
    lastIterationCompletedAt: new Date("2026-04-06T10:00:00.000Z"),
    consecutiveFailureCount: 0,
    lastErrorCode: null,
    lastErrorMessage: null,
    lastReconciliationScanRunId: "scan_run_1",
    lastReconciliationScanStartedAt: new Date("2026-04-06T09:55:00.000Z"),
    lastReconciliationScanCompletedAt: new Date("2026-04-06T09:55:01.000Z"),
    lastReconciliationScanStatus: LedgerReconciliationScanRunStatus.succeeded,
    runtimeMetadata: {
      pollIntervalMs: 1000
    },
    latestIterationMetrics: {
      queuedDepositCount: 1,
      manualWithdrawalBacklogCount: 0
    },
    createdAt: new Date("2026-04-06T09:00:00.000Z"),
    updatedAt: new Date("2026-04-06T10:00:00.000Z"),
    ...overrides
  };
}

function buildPlatformAlertRecord(
  overrides: Partial<Record<string, unknown>> = {}
) {
  return {
    id: "alert_1",
    dedupeKey: "worker:degraded:worker_1",
    category: PlatformAlertCategory.worker,
    severity: PlatformAlertSeverity.warning,
    status: PlatformAlertStatus.open,
    code: "worker_runtime_degraded",
    summary: "Worker worker_1 is degraded.",
    detail: "Iteration status is failed.",
    metadata: {
      workerId: "worker_1"
    },
    firstDetectedAt: new Date("2026-04-06T10:00:00.000Z"),
    lastDetectedAt: new Date("2026-04-06T10:00:00.000Z"),
    resolvedAt: null,
    createdAt: new Date("2026-04-06T10:00:00.000Z"),
    updatedAt: new Date("2026-04-06T10:00:00.000Z"),
    ...overrides
  };
}

function createService() {
  const prismaService = {
    workerRuntimeHeartbeat: {
      upsert: jest.fn(),
      findMany: jest.fn()
    },
    transactionIntent: {
      count: jest.fn(),
      findFirst: jest.fn()
    },
    blockchainTransaction: {
      count: jest.fn(),
      findFirst: jest.fn()
    },
    ledgerReconciliationMismatch: {
      count: jest.fn()
    },
    ledgerReconciliationScanRun: {
      count: jest.fn(),
      findFirst: jest.fn()
    },
    wallet: {
      count: jest.fn()
    },
    reviewCase: {
      count: jest.fn()
    },
    oversightIncident: {
      count: jest.fn()
    },
    customerAccount: {
      count: jest.fn()
    },
    platformAlert: {
      upsert: jest.fn(),
      findMany: jest.fn(),
      updateMany: jest.fn(),
      count: jest.fn()
    }
  } as unknown as PrismaService;

  return {
    prismaService,
    service: new OperationsMonitoringService(prismaService)
  };
}

function mockHealthySnapshotQueries(prismaService: PrismaService) {
  (prismaService.workerRuntimeHeartbeat.findMany as jest.Mock).mockResolvedValue([
    buildHeartbeatRecord()
  ]);
  (prismaService.transactionIntent.count as jest.Mock)
    .mockResolvedValueOnce(1)
    .mockResolvedValueOnce(0)
    .mockResolvedValueOnce(0);
  (prismaService.transactionIntent.findFirst as jest.Mock).mockResolvedValue({
    createdAt: new Date("2026-04-06T09:59:00.000Z")
  });
  (prismaService.blockchainTransaction.count as jest.Mock)
    .mockResolvedValueOnce(0)
    .mockResolvedValueOnce(0)
    .mockResolvedValueOnce(0);
  (prismaService.blockchainTransaction.findFirst as jest.Mock).mockResolvedValue(
    null
  );
  (prismaService.ledgerReconciliationMismatch.count as jest.Mock)
    .mockResolvedValueOnce(0)
    .mockResolvedValueOnce(0);
  (prismaService.ledgerReconciliationScanRun.count as jest.Mock).mockResolvedValue(
    0
  );
  (prismaService.ledgerReconciliationScanRun.findFirst as jest.Mock).mockResolvedValue(
    {
      status: LedgerReconciliationScanRunStatus.succeeded,
      startedAt: new Date("2026-04-06T09:55:00.000Z")
    }
  );
  (prismaService.wallet.count as jest.Mock)
    .mockResolvedValueOnce(1)
    .mockResolvedValueOnce(1);
  (prismaService.reviewCase.count as jest.Mock).mockResolvedValue(2);
  (prismaService.oversightIncident.count as jest.Mock).mockResolvedValue(1);
  (prismaService.customerAccount.count as jest.Mock).mockResolvedValue(0);
}

describe("OperationsMonitoringService", () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it("records worker heartbeat updates and resets consecutive failures after a successful iteration", async () => {
    const { service, prismaService } = createService();
    const stored = buildHeartbeatRecord();

    jest.spyOn(Date, "now").mockReturnValue(
      new Date("2026-04-06T10:00:30.000Z").getTime()
    );
    (prismaService.workerRuntimeHeartbeat.upsert as jest.Mock).mockResolvedValue(
      stored
    );

    const result = await service.reportWorkerRuntimeHeartbeat("worker_1", {
      environment: "production",
      executionMode: "monitor",
      lastIterationStatus: "succeeded",
      lastIterationStartedAt: "2026-04-06T09:59:58.000Z",
      lastIterationCompletedAt: "2026-04-06T10:00:00.000Z",
      lastReconciliationScanRunId: "scan_run_1",
      lastReconciliationScanStatus: "succeeded",
      runtimeMetadata: {
        pollIntervalMs: 1000
      },
      latestIterationMetrics: {
        queuedDepositCount: 1
      },
      lastIterationDurationMs: 2000
    });

    expect(prismaService.workerRuntimeHeartbeat.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          consecutiveFailureCount: 0,
          lastIterationStatus: WorkerRuntimeIterationStatus.succeeded
        })
      })
    );
    expect(result.heartbeat.healthStatus).toBe("healthy");
  });

  it("classifies workers as degraded when the latest reconciliation scan failed", async () => {
    const { service, prismaService } = createService();
    const degraded = buildHeartbeatRecord({
      lastReconciliationScanStatus: LedgerReconciliationScanRunStatus.failed
    });

    jest.spyOn(Date, "now").mockReturnValue(
      new Date("2026-04-06T10:00:30.000Z").getTime()
    );
    (prismaService.workerRuntimeHeartbeat.findMany as jest.Mock).mockResolvedValue([
      degraded
    ]);

    const result = await service.listWorkerRuntimeHealth({
      staleAfterSeconds: 120
    });

    expect(result.workers[0]?.healthStatus).toBe("degraded");
  });

  it("classifies workers as stale when the last heartbeat is too old", async () => {
    const { service, prismaService } = createService();
    const stale = buildHeartbeatRecord({
      lastHeartbeatAt: new Date("2026-04-06T09:55:00.000Z")
    });

    jest.spyOn(Date, "now").mockReturnValue(
      new Date("2026-04-06T10:00:30.000Z").getTime()
    );
    (prismaService.workerRuntimeHeartbeat.findMany as jest.Mock).mockResolvedValue([
      stale
    ]);

    const result = await service.listWorkerRuntimeHealth({
      staleAfterSeconds: 120
    });

    expect(result.workers[0]?.healthStatus).toBe("stale");
  });

  it("builds operations status and persists open alerts for degraded worker and reconciliation failures", async () => {
    const { service, prismaService } = createService();

    jest.spyOn(Date, "now").mockReturnValue(
      new Date("2026-04-06T10:00:30.000Z").getTime()
    );

    (prismaService.workerRuntimeHeartbeat.findMany as jest.Mock).mockResolvedValue([
      buildHeartbeatRecord({
        lastIterationStatus: WorkerRuntimeIterationStatus.failed,
        consecutiveFailureCount: 2,
        lastErrorMessage: "RPC timeout"
      })
    ]);
    (prismaService.transactionIntent.count as jest.Mock)
      .mockResolvedValueOnce(12)
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(3);
    (prismaService.transactionIntent.findFirst as jest.Mock).mockResolvedValue({
      createdAt: new Date("2026-04-06T09:50:00.000Z")
    });
    (prismaService.blockchainTransaction.count as jest.Mock)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(2);
    (prismaService.blockchainTransaction.findFirst as jest.Mock).mockResolvedValue(
      {
        createdAt: new Date("2026-04-06T08:45:00.000Z")
      }
    );
    (prismaService.ledgerReconciliationMismatch.count as jest.Mock)
      .mockResolvedValueOnce(6)
      .mockResolvedValueOnce(2);
    (prismaService.ledgerReconciliationScanRun.count as jest.Mock).mockResolvedValue(
      1
    );
    (prismaService.ledgerReconciliationScanRun.findFirst as jest.Mock).mockResolvedValue(
      {
        status: LedgerReconciliationScanRunStatus.failed,
        startedAt: new Date("2026-04-06T09:59:00.000Z")
      }
    );
    (prismaService.wallet.count as jest.Mock)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);
    (prismaService.reviewCase.count as jest.Mock).mockResolvedValue(14);
    (prismaService.oversightIncident.count as jest.Mock).mockResolvedValue(6);
    (prismaService.customerAccount.count as jest.Mock).mockResolvedValue(5);
    (prismaService.platformAlert.upsert as jest.Mock).mockResolvedValue(
      buildPlatformAlertRecord()
    );
    (prismaService.platformAlert.findMany as jest.Mock)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        buildPlatformAlertRecord(),
        buildPlatformAlertRecord({
          id: "alert_2",
          dedupeKey: "reconciliation:core-health",
          category: PlatformAlertCategory.reconciliation,
          severity: PlatformAlertSeverity.critical,
          code: "ledger_reconciliation_attention_required",
          summary: "Ledger reconciliation requires operator attention."
        })
      ]);
    (prismaService.platformAlert.count as jest.Mock)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1);

    const result = await service.getOperationsStatus({
      recentAlertLimit: 8,
      staleAfterSeconds: 180
    });

    expect(result.workerHealth.status).toBe("warning");
    expect(result.queueHealth.status).toBe("warning");
    expect(result.chainHealth.status).toBe("warning");
    expect(result.reconciliationHealth.status).toBe("critical");
    expect(result.treasuryHealth.status).toBe("healthy");
    expect(result.alertSummary.openCount).toBe(2);
    expect(prismaService.platformAlert.upsert).toHaveBeenCalled();
    expect(prismaService.platformAlert.updateMany).not.toHaveBeenCalled();
  });

  it("lists platform alerts after refreshing durable alert state", async () => {
    const { service, prismaService } = createService();

    jest.spyOn(Date, "now").mockReturnValue(
      new Date("2026-04-06T10:00:30.000Z").getTime()
    );

    mockHealthySnapshotQueries(prismaService);
    (prismaService.platformAlert.findMany as jest.Mock)
      .mockResolvedValueOnce([
        {
          dedupeKey: "worker:stale:worker_legacy"
        }
      ])
      .mockResolvedValueOnce([
        buildPlatformAlertRecord({
          status: PlatformAlertStatus.resolved,
          resolvedAt: new Date("2026-04-06T10:00:30.000Z")
        })
      ]);
    (prismaService.platformAlert.count as jest.Mock).mockResolvedValue(1);

    const result = await service.listPlatformAlerts({
      limit: 20,
      status: "resolved"
    });

    expect(prismaService.platformAlert.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          dedupeKey: {
            in: ["worker:stale:worker_legacy"]
          }
        })
      })
    );
    expect(result.totalCount).toBe(1);
    expect(result.alerts[0]?.status).toBe("resolved");
  });
});
