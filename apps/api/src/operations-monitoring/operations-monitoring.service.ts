import { Injectable } from "@nestjs/common";
import {
  LedgerReconciliationScanRunStatus,
  Prisma,
  WorkerRuntimeEnvironment,
  WorkerRuntimeExecutionMode,
  WorkerRuntimeIterationStatus
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { ListWorkerRuntimeHealthDto } from "./dto/list-worker-runtime-health.dto";
import { ReportWorkerRuntimeHeartbeatDto } from "./dto/report-worker-runtime-heartbeat.dto";

type WorkerRuntimeHeartbeatRecord = Prisma.WorkerRuntimeHeartbeatGetPayload<{}>;

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

@Injectable()
export class OperationsMonitoringService {
  constructor(private readonly prismaService: PrismaService) {}

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
        consecutiveFailureCount:
          dto.lastIterationStatus === "failed" ? 1 : 0,
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
          dto.lastIterationStatus === "failed"
            ? {
                increment: 1
              }
            : 0,
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
      heartbeat: this.mapWorkerRuntimeHealthProjection(heartbeat, 120)
    };
  }

  async listWorkerRuntimeHealth(
    query: ListWorkerRuntimeHealthDto
  ): Promise<WorkerRuntimeHealthListResult> {
    const limit = query.limit ?? 20;
    const staleAfterSeconds = query.staleAfterSeconds ?? 120;
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
}
