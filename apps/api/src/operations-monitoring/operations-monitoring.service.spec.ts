import {
  LedgerReconciliationScanRunStatus,
  WorkerRuntimeExecutionMode,
  WorkerRuntimeEnvironment,
  WorkerRuntimeIterationStatus
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { OperationsMonitoringService } from "./operations-monitoring.service";

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
      queuedDepositCount: 1
    },
    createdAt: new Date("2026-04-06T09:00:00.000Z"),
    updatedAt: new Date("2026-04-06T10:00:00.000Z"),
    ...overrides
  };
}

function createService() {
  const prismaService = {
    workerRuntimeHeartbeat: {
      upsert: jest.fn(),
      findMany: jest.fn()
    }
  } as unknown as PrismaService;

  return {
    prismaService,
    service: new OperationsMonitoringService(prismaService)
  };
}

describe("OperationsMonitoringService", () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it("records worker heartbeat updates and resets consecutive failures after a successful iteration", async () => {
    const { service, prismaService } = createService();
    const stored = buildHeartbeatRecord();

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
});
