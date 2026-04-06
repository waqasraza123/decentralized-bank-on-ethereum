import { findWorkspaceBoundary } from "@stealth-trails-bank/config";
import type { WorkspaceBoundary } from "@stealth-trails-bank/types";
import {
  createInternalWorkerApiClient,
  InternalApiUnavailableError
} from "./runtime/internal-worker-api-client";
import { createManagedDepositBroadcaster } from "./runtime/deposit-broadcaster";
import { createJsonRpcClient } from "./runtime/json-rpc-client";
import { createWorkerLogger } from "./runtime/worker-logger";
import { WorkerOrchestrator } from "./runtime/worker-orchestrator";
import { loadWorkerRuntime } from "./runtime/worker-runtime";
import type {
  TrackedLedgerReconciliationScanResult,
  WorkerHeartbeatPayload,
  WorkerIterationMetrics
} from "./runtime/worker-types";

function requireWorkerWorkspaceBoundary(): WorkspaceBoundary {
  const workspaceBoundary = findWorkspaceBoundary("worker");

  if (!workspaceBoundary) {
    throw new Error("Worker workspace boundary is not configured.");
  }

  return workspaceBoundary;
}

export const workerWorkspaceBoundary = requireWorkerWorkspaceBoundary();

export function getWorkerWorkspaceBoundary(): WorkspaceBoundary {
  return workerWorkspaceBoundary;
}

function normalizeWorkerError(error: unknown): {
  code: string;
  message: string;
} {
  if (error instanceof InternalApiUnavailableError) {
    return {
      code: error.code ?? "internal_api_unavailable",
      message: error.message
    };
  }

  if (error instanceof Error) {
    return {
      code: error.name || "worker_iteration_failed",
      message: error.message
    };
  }

  return {
    code: "worker_iteration_failed",
    message: "Worker iteration failed."
  };
}

async function safeReportWorkerHeartbeat(args: {
  internalApiClient: ReturnType<typeof createInternalWorkerApiClient>;
  logger: ReturnType<typeof createWorkerLogger>;
  payload: WorkerHeartbeatPayload;
}): Promise<void> {
  try {
    await args.internalApiClient.reportWorkerHeartbeat(args.payload);
  } catch (error) {
    if (error instanceof InternalApiUnavailableError) {
      args.logger.warn("worker_heartbeat_report_retryable_failure", {
        baseUrl: error.baseUrl,
        errorCode: error.code,
        message: error.message
      });
      return;
    }

    args.logger.error("worker_heartbeat_report_failed", {
      error
    });
  }
}

export async function startWorkerRuntime(): Promise<void> {
  const runtime = loadWorkerRuntime();
  const logger = createWorkerLogger(runtime);
  const internalApiClient = createInternalWorkerApiClient(runtime);
  const rpcClient = runtime.rpcUrl
    ? createJsonRpcClient(runtime.rpcUrl, runtime.requestTimeoutMs)
    : null;
  const depositBroadcaster =
    runtime.executionMode === "managed"
      ? createManagedDepositBroadcaster(runtime)
      : null;
  const orchestrator = new WorkerOrchestrator({
    runtime,
    internalApiClient,
    rpcClient,
    depositBroadcaster,
    logger
  });

  let shutdownRequested = false;
  let lastReconciliationScanAttemptedAt = 0;
  let lastReconciliationScanResult: TrackedLedgerReconciliationScanResult | null =
    null;
  let lastReconciliationScanFailure: {
    startedAt: string;
    completedAt: string;
    errorCode: string;
    errorMessage: string;
  } | null = null;

  const requestShutdown = (signal: string) => {
    if (shutdownRequested) {
      return;
    }

    shutdownRequested = true;
    logger.info("worker_shutdown_requested", {
      signal
    });
  };

  process.once("SIGINT", () => {
    requestShutdown("SIGINT");
  });
  process.once("SIGTERM", () => {
    requestShutdown("SIGTERM");
  });

  logger.info("worker_started", {
    executionMode: runtime.executionMode,
    batchLimit: runtime.batchLimit,
    pollIntervalMs: runtime.pollIntervalMs,
    confirmationBlocks: runtime.confirmationBlocks
  });

  while (!shutdownRequested) {
    const iterationStartedAt = new Date();

    await safeReportWorkerHeartbeat({
      internalApiClient,
      logger,
      payload: {
        environment: runtime.environment,
        executionMode: runtime.executionMode,
        lastIterationStatus: "running",
        lastIterationStartedAt: iterationStartedAt.toISOString(),
        lastReconciliationScanRunId: lastReconciliationScanResult?.scanRun.id,
        lastReconciliationScanStartedAt:
          lastReconciliationScanFailure?.startedAt ??
          lastReconciliationScanResult?.scanRun.startedAt,
        lastReconciliationScanCompletedAt:
          lastReconciliationScanFailure?.completedAt ??
          lastReconciliationScanResult?.scanRun.completedAt ??
          undefined,
        lastReconciliationScanStatus:
          (lastReconciliationScanFailure
            ? "failed"
            : lastReconciliationScanResult?.scanRun.status) as
            | "running"
            | "succeeded"
            | "failed"
            | undefined,
        runtimeMetadata: {
          pollIntervalMs: runtime.pollIntervalMs,
          batchLimit: runtime.batchLimit,
          confirmationBlocks: runtime.confirmationBlocks,
          reconciliationScanIntervalMs: runtime.reconciliationScanIntervalMs
        }
      }
    });

    let iterationMetrics: WorkerIterationMetrics | null = null;

    try {
      iterationMetrics = await orchestrator.runOnce();

      const now = Date.now();
      if (now - lastReconciliationScanAttemptedAt >= runtime.reconciliationScanIntervalMs) {
        lastReconciliationScanAttemptedAt = now;
        const reconciliationScanStartedAt = new Date();
        lastReconciliationScanFailure = null;

        try {
          const scanResult = await internalApiClient.triggerLedgerReconciliationScan({});
          lastReconciliationScanResult = scanResult;
          logger.info("scheduled_ledger_reconciliation_scan_completed", {
            scanRunId: scanResult.scanRun.id,
            status: scanResult.scanRun.status,
            activeMismatchCount: scanResult.result.activeMismatchCount,
            createdCount: scanResult.result.createdCount,
            reopenedCount: scanResult.result.reopenedCount,
            autoResolvedCount: scanResult.result.autoResolvedCount
          });
        } catch (error) {
          const normalizedError = normalizeWorkerError(error);
          lastReconciliationScanFailure = {
            startedAt: reconciliationScanStartedAt.toISOString(),
            completedAt: new Date().toISOString(),
            errorCode: normalizedError.code,
            errorMessage: normalizedError.message
          };
          logger.error("scheduled_ledger_reconciliation_scan_failed", {
            error
          });
        }
      }

      const iterationCompletedAt = new Date();

      await safeReportWorkerHeartbeat({
        internalApiClient,
        logger,
        payload: {
          environment: runtime.environment,
          executionMode: runtime.executionMode,
          lastIterationStatus: "succeeded",
          lastIterationStartedAt: iterationStartedAt.toISOString(),
          lastIterationCompletedAt: iterationCompletedAt.toISOString(),
          lastReconciliationScanRunId: lastReconciliationScanResult?.scanRun.id,
          lastReconciliationScanStartedAt:
            lastReconciliationScanFailure?.startedAt ??
            lastReconciliationScanResult?.scanRun.startedAt,
          lastReconciliationScanCompletedAt:
            lastReconciliationScanFailure?.completedAt ??
            lastReconciliationScanResult?.scanRun.completedAt ??
            undefined,
          lastReconciliationScanStatus:
            (lastReconciliationScanFailure
              ? "failed"
              : lastReconciliationScanResult?.scanRun.status) as
              | "running"
              | "succeeded"
              | "failed"
              | undefined,
          runtimeMetadata: {
            pollIntervalMs: runtime.pollIntervalMs,
            batchLimit: runtime.batchLimit,
            confirmationBlocks: runtime.confirmationBlocks,
            reconciliationScanIntervalMs: runtime.reconciliationScanIntervalMs
          },
          latestIterationMetrics: iterationMetrics,
          lastIterationDurationMs:
            iterationCompletedAt.getTime() - iterationStartedAt.getTime()
        }
      });
    } catch (error) {
      const normalizedError = normalizeWorkerError(error);

      await safeReportWorkerHeartbeat({
        internalApiClient,
        logger,
        payload: {
          environment: runtime.environment,
          executionMode: runtime.executionMode,
          lastIterationStatus: "failed",
          lastIterationStartedAt: iterationStartedAt.toISOString(),
          lastIterationCompletedAt: new Date().toISOString(),
          lastErrorCode: normalizedError.code,
          lastErrorMessage: normalizedError.message,
          lastReconciliationScanRunId: lastReconciliationScanResult?.scanRun.id,
          lastReconciliationScanStartedAt:
            lastReconciliationScanFailure?.startedAt ??
            lastReconciliationScanResult?.scanRun.startedAt,
          lastReconciliationScanCompletedAt:
            lastReconciliationScanFailure?.completedAt ??
            lastReconciliationScanResult?.scanRun.completedAt ??
            undefined,
          lastReconciliationScanStatus:
            (lastReconciliationScanFailure
              ? "failed"
              : lastReconciliationScanResult?.scanRun.status) as
              | "running"
              | "succeeded"
              | "failed"
              | undefined,
          runtimeMetadata: {
            pollIntervalMs: runtime.pollIntervalMs,
            batchLimit: runtime.batchLimit,
            confirmationBlocks: runtime.confirmationBlocks,
            reconciliationScanIntervalMs: runtime.reconciliationScanIntervalMs
          },
          latestIterationMetrics: iterationMetrics ?? undefined,
          lastIterationDurationMs: Date.now() - iterationStartedAt.getTime()
        }
      });

      if (error instanceof InternalApiUnavailableError) {
        logger.warn("internal_api_unavailable_retrying", {
          baseUrl: error.baseUrl,
          errorCode: error.code,
          retryInMs: runtime.pollIntervalMs
        });
      } else {
        logger.error("worker_iteration_failed", {
          error
        });
      }
    }

    if (shutdownRequested) {
      break;
    }

    await new Promise<void>((resolve) => {
      const cleanup = () => {
        clearTimeout(timeout);
        process.off("SIGINT", cancelDelay);
        process.off("SIGTERM", cancelDelay);
      };

      const timeout = setTimeout(() => {
        cleanup();
        resolve();
      }, runtime.pollIntervalMs);

      const cancelDelay = () => {
        cleanup();
        resolve();
      };

      process.once("SIGINT", cancelDelay);
      process.once("SIGTERM", cancelDelay);
    });
  }

  logger.info("worker_stopped", {});
}

if (require.main === module) {
  void startWorkerRuntime().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
