import {
  createInternalWorkerApiClient,
  InternalApiUnavailableError,
} from "../runtime/internal-worker-api-client";
import {
  createManagedDepositBroadcaster,
} from "../runtime/deposit-broadcaster";
import { createGovernedExecutorDispatchClient } from "../runtime/governed-executor-dispatch-client";
import { createJsonRpcClient } from "../runtime/json-rpc-client";
import { createPolicyControlledWithdrawalBroadcaster } from "../runtime/policy-controlled-withdrawal-broadcaster";
import { createSolvencyReportAnchorBroadcaster } from "../runtime/solvency-anchor-broadcaster";
import { createManagedWithdrawalBroadcaster } from "../runtime/withdrawal-broadcaster";
import { createWorkerLogger } from "../runtime/worker-logger";
import { WorkerOrchestrator } from "../runtime/worker-orchestrator";
import { loadWorkerRuntime } from "../runtime/worker-runtime";
import type {
  TrackedLedgerReconciliationScanResult,
  WorkerHeartbeatPayload,
  WorkerIterationMetrics,
} from "../runtime/worker-types";

export type WorkerCronJobOptions = {
  runIteration?: boolean;
  runLedgerReconciliationScan?: boolean;
  runSolvencySnapshot?: boolean;
  runPlatformAlertReEscalation?: boolean;
};

export type WorkerCronJobResult = {
  workerId: string;
  environment: string;
  executionMode: string;
  iterationStatus?: "succeeded" | "failed";
  iterationMetrics?: WorkerIterationMetrics;
  ledgerReconciliationScan?: {
    status: "succeeded";
    scanRunId: string;
    activeMismatchCount: number;
  };
  solvencySnapshot?: {
    status: "succeeded";
    snapshotId: string;
    issueCount: number;
    criticalIssueCount: number;
  };
  platformAlertReEscalation?: {
    status: "succeeded";
    evaluatedAlertCount: number;
    reEscalatedAlertCount: number;
  };
};

function normalizeWorkerError(error: unknown): {
  code: string;
  message: string;
} {
  if (error instanceof InternalApiUnavailableError) {
    return {
      code: error.code ?? "internal_api_unavailable",
      message: error.message,
    };
  }

  if (error instanceof Error) {
    return {
      code: error.name || "worker_iteration_failed",
      message: error.message,
    };
  }

  return {
    code: "worker_iteration_failed",
    message: "Worker iteration failed.",
  };
}

function normalizeHttpError(error: unknown): { code: string; message: string } {
  return normalizeWorkerError(error);
}

function buildRuntimeMetadata(runtime: ReturnType<typeof loadWorkerRuntime>) {
  return {
    pollIntervalMs: runtime.pollIntervalMs,
    batchLimit: runtime.batchLimit,
    internalApiStartupGracePeriodMs: runtime.internalApiStartupGracePeriodMs,
    confirmationBlocks: runtime.confirmationBlocks,
    reconciliationScanIntervalMs: runtime.reconciliationScanIntervalMs,
    solvencySnapshotIntervalMs: runtime.solvencySnapshotIntervalMs,
    governedExecutionDispatchIntervalMs:
      runtime.governedExecutionDispatchIntervalMs,
    platformAlertReEscalationIntervalMs:
      runtime.platformAlertReEscalationIntervalMs,
    governedExecutorDispatchConfigured: Boolean(
      runtime.governedExecutorDispatchBaseUrl &&
        runtime.governedExecutorDispatchApiKey,
    ),
    policyControlledWithdrawalReady: Boolean(
      runtime.policyControlledWithdrawalExecutorPrivateKey &&
        runtime.policyControlledWithdrawalPolicySignerPrivateKey,
    ),
    solvencyAnchorBroadcasterReady: Boolean(
      runtime.solvencyAnchorContractAddress &&
        runtime.solvencyAnchorSignerPrivateKey,
    ),
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
    args.logger.error("worker_heartbeat_report_failed", {
      error,
    });
  }
}

function createWorkerExecutionContext() {
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
  const withdrawalBroadcaster =
    runtime.executionMode === "managed"
      ? createManagedWithdrawalBroadcaster(runtime)
      : null;
  const policyControlledWithdrawalBroadcaster =
    runtime.executionMode === "managed"
      ? createPolicyControlledWithdrawalBroadcaster(runtime)
      : null;
  const solvencyReportAnchorBroadcaster =
    createSolvencyReportAnchorBroadcaster(runtime);
  const governedExecutorDispatchClient =
    createGovernedExecutorDispatchClient(runtime);
  const orchestrator = new WorkerOrchestrator({
    runtime,
    internalApiClient,
    governedExecutorDispatchClient,
    rpcClient,
    depositBroadcaster,
    withdrawalBroadcaster,
    policyControlledWithdrawalBroadcaster,
    solvencyReportAnchorBroadcaster,
    logger,
  });

  return {
    runtime,
    logger,
    internalApiClient,
    orchestrator,
  };
}

export async function executeWorkerCronJob(
  options: WorkerCronJobOptions,
): Promise<WorkerCronJobResult> {
  const { runtime, logger, internalApiClient, orchestrator } =
    createWorkerExecutionContext();
  const result: WorkerCronJobResult = {
    workerId: runtime.workerId,
    environment: runtime.environment,
    executionMode: runtime.executionMode,
  };

  if (options.runIteration) {
    const iterationStartedAt = new Date();

    await safeReportWorkerHeartbeat({
      internalApiClient,
      logger,
      payload: {
        environment: runtime.environment,
        executionMode: runtime.executionMode,
        lastIterationStatus: "running",
        lastIterationStartedAt: iterationStartedAt.toISOString(),
        runtimeMetadata: buildRuntimeMetadata(runtime),
      },
    });

    try {
      const iterationMetrics = await orchestrator.runOnce();
      const iterationCompletedAt = new Date();

      result.iterationStatus = "succeeded";
      result.iterationMetrics = iterationMetrics;

      await safeReportWorkerHeartbeat({
        internalApiClient,
        logger,
        payload: {
          environment: runtime.environment,
          executionMode: runtime.executionMode,
          lastIterationStatus: "succeeded",
          lastIterationStartedAt: iterationStartedAt.toISOString(),
          lastIterationCompletedAt: iterationCompletedAt.toISOString(),
          runtimeMetadata: buildRuntimeMetadata(runtime),
          latestIterationMetrics: iterationMetrics,
          lastIterationDurationMs:
            iterationCompletedAt.getTime() - iterationStartedAt.getTime(),
        },
      });
    } catch (error) {
      const normalizedError = normalizeWorkerError(error);
      const iterationCompletedAt = new Date();

      result.iterationStatus = "failed";

      await safeReportWorkerHeartbeat({
        internalApiClient,
        logger,
        payload: {
          environment: runtime.environment,
          executionMode: runtime.executionMode,
          lastIterationStatus: "failed",
          lastIterationStartedAt: iterationStartedAt.toISOString(),
          lastIterationCompletedAt: iterationCompletedAt.toISOString(),
          lastErrorCode: normalizedError.code,
          lastErrorMessage: normalizedError.message,
          runtimeMetadata: buildRuntimeMetadata(runtime),
          lastIterationDurationMs:
            iterationCompletedAt.getTime() - iterationStartedAt.getTime(),
        },
      });

      throw error;
    }
  }

  if (options.runLedgerReconciliationScan) {
    const scanResult: TrackedLedgerReconciliationScanResult =
      await internalApiClient.triggerLedgerReconciliationScan({});

    logger.info("scheduled_ledger_reconciliation_scan_completed", {
      scanRunId: scanResult.scanRun.id,
      status: scanResult.scanRun.status,
      activeMismatchCount: scanResult.result.activeMismatchCount,
      createdCount: scanResult.result.createdCount,
      reopenedCount: scanResult.result.reopenedCount,
      autoResolvedCount: scanResult.result.autoResolvedCount,
    });

    result.ledgerReconciliationScan = {
      status: "succeeded",
      scanRunId: scanResult.scanRun.id,
      activeMismatchCount: scanResult.result.activeMismatchCount,
    };
  }

  if (options.runSolvencySnapshot) {
    const solvencySnapshotResult =
      await internalApiClient.triggerSolvencySnapshot();

    logger.info("scheduled_solvency_snapshot_completed", {
      snapshotId: solvencySnapshotResult.snapshot.id,
      status: solvencySnapshotResult.snapshot.status,
      evidenceFreshness: solvencySnapshotResult.snapshot.evidenceFreshness,
      issueCount: solvencySnapshotResult.issueCount,
      criticalIssueCount: solvencySnapshotResult.criticalIssueCount,
      policyStatus: solvencySnapshotResult.policyState.status,
    });

    result.solvencySnapshot = {
      status: "succeeded",
      snapshotId: solvencySnapshotResult.snapshot.id,
      issueCount: solvencySnapshotResult.issueCount,
      criticalIssueCount: solvencySnapshotResult.criticalIssueCount,
    };
  }

  if (options.runPlatformAlertReEscalation) {
    const reEscalationResult =
      await internalApiClient.triggerCriticalAlertReEscalationSweep({});

    logger.info("scheduled_platform_alert_reescalation_completed", {
      evaluatedAlertCount: reEscalationResult.evaluatedAlertCount,
      reEscalatedAlertCount: reEscalationResult.reEscalatedAlertCount,
      skippedPendingDeliveryCount:
        reEscalationResult.skippedPendingDeliveryCount,
      remainingDueAlertCount: reEscalationResult.remainingDueAlertCount,
    });

    result.platformAlertReEscalation = {
      status: "succeeded",
      evaluatedAlertCount: reEscalationResult.evaluatedAlertCount,
      reEscalatedAlertCount: reEscalationResult.reEscalatedAlertCount,
    };
  }

  return result;
}

export function authorizeCronRequest(request: Request): Response | null {
  const cronSecret = process.env.CRON_SECRET?.trim();

  if (!cronSecret) {
    return Response.json(
      {
        ok: false,
        error: {
          code: "cron_secret_not_configured",
          message: "CRON_SECRET is not configured for this deployment.",
        },
      },
      { status: 500 },
    );
  }

  const authorizationHeader = request.headers.get("authorization");

  if (authorizationHeader !== `Bearer ${cronSecret}`) {
    return Response.json(
      {
        ok: false,
        error: {
          code: "unauthorized",
          message: "Unauthorized cron invocation.",
        },
      },
      { status: 401 },
    );
  }

  return null;
}

export function createCronFailureResponse(error: unknown): Response {
  const normalizedError = normalizeHttpError(error);

  return Response.json(
    {
      ok: false,
      error: normalizedError,
    },
    { status: 500 },
  );
}
