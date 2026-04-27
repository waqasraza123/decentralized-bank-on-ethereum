import axios, { type AxiosInstance } from "axios";
import {
  ReleaseReadinessEnvironment,
  ReleaseReadinessEvidenceType
} from "@prisma/client";
import {
  notificationCutoverVerificationEvidenceType
} from "./dto/create-release-readiness-evidence.dto";

type ApiEnvelope<T> = {
  status: "success" | "failed";
  message: string;
  data?: T;
};

type ReleaseReadinessDrillSession = {
  baseUrl: string;
  accessToken?: string;
  customerAccessToken?: string;
};

type ReleaseReadinessDrillOptions = {
  evidenceType: ReleaseReadinessEvidenceType;
  staleAfterSeconds?: number;
  recentAlertLimit?: number;
  lookbackHours?: number;
  expectedTargetName?: string;
  expectedTargetHealthStatus?: "warning" | "critical";
  expectedAlertId?: string;
  expectedDedupeKey?: string;
  expectedMinReEscalations?: number;
  expectedWorkerId?: string;
  expectedMinHealthyWorkers?: number;
  requireNotificationFeedItem?: boolean;
};

type DrillCheckResult = {
  name: string;
  path: string;
  ok: boolean;
  statusCode: number;
  summary: string;
  payload: Record<string, unknown>;
};

type ReleaseReadinessDrillResult = {
  evidenceType: ReleaseReadinessEvidenceType;
  status: "passed" | "failed";
  summary: string;
  observedAt: string;
  failures: string[];
  checks: DrillCheckResult[];
  evidencePayload: Record<string, unknown>;
};

type OperationsStatusData = {
  generatedAt: string;
  workerHealth: {
    status: "healthy" | "warning" | "critical";
    healthyWorkers: number;
    totalWorkers: number;
    staleWorkers: number;
  };
  queueHealth: {
    status: "healthy" | "warning" | "critical";
    totalQueuedCount: number;
  };
  reconciliationHealth: {
    status: "healthy" | "warning" | "critical";
    recentFailedScanCount: number;
    latestScanStatus: string | null;
  };
  recentAlerts: Array<{
    id: string;
    severity: string;
    status: string;
    code: string;
    summary: string;
  }>;
};

type WorkerRuntimeHealthListData = {
  workers: Array<{
    workerId: string;
    healthStatus: "healthy" | "degraded" | "stale";
    lastHeartbeatAt: string;
    lastIterationStatus: string;
    consecutiveFailureCount: number;
  }>;
  staleAfterSeconds: number;
  totalCount: number;
};

type PlatformAlertListData = {
  alerts: Array<{
    id: string;
    dedupeKey: string;
    severity: "warning" | "critical";
    status: "open" | "resolved";
    category: string;
    code: string;
    summary: string;
    deliverySummary: {
      reEscalationCount: number;
      escalatedCount: number;
      failedCount: number;
      pendingCount: number;
      lastStatus: "pending" | "succeeded" | "failed" | null;
      lastTargetName: string | null;
    };
  }>;
  limit: number;
  totalCount: number;
};

type PlatformAlertDeliveryTargetHealthListData = {
  generatedAt: string;
  lookbackHours: number;
  summary: {
    totalTargetCount: number;
    healthyTargetCount: number;
    warningTargetCount: number;
    criticalTargetCount: number;
  };
  targets: Array<{
    targetName: string;
    healthStatus: "healthy" | "warning" | "critical";
    recentDeliveryCount: number;
    recentFailedCount: number;
    pendingDeliveryCount: number;
    recentFailureRatePercent: number | null;
    consecutiveFailureCount: number;
    sloBreaches: string[];
  }>;
};

type LedgerReconciliationRunListData = {
  runs: Array<{
    id: string;
    status: string;
    startedAt: string;
    completedAt: string | null;
  }>;
  totalCount: number;
};

type ReviewCaseListData = {
  reviewCases: Array<{
    id: string;
    status: string;
    type: string;
    updatedAt: string;
  }>;
  limit: number;
};

type AuditEventListData = {
  events: Array<{
    id: string;
    action: string;
    targetType: string;
    createdAt: string;
  }>;
  totalCount: number;
};

type NotificationFeedData = {
  items: Array<{
    id: string;
    deliverySequence: number;
    category: string;
    priority: string;
    readAt: string | null;
    archivedAt: string | null;
    createdAt: string;
  }>;
  unreadCount: number;
  limit: number;
};

type NotificationUnreadSummaryData = {
  unreadCount: number;
  criticalCount: number;
  highCount: number;
};

type NotificationPreferencesData = {
  notificationPreferences: {
    audience: "customer" | "operator";
    supportedChannels: string[];
    entries: Array<{
      category: string;
      channels: Array<{
        channel: string;
        enabled: boolean;
        mandatory: boolean;
      }>;
    }>;
    updatedAt: string | null;
  };
};

type NotificationSocketSessionData = {
  audience: "customer" | "operator";
  recipientKey: string;
  socketToken: string;
  expiresAt: string;
  latestSequence: number;
  heartbeatIntervalMs: number;
  supportedChannels: string[];
};

const DEFAULT_STALE_AFTER_SECONDS = 180;
const DEFAULT_RECENT_ALERT_LIMIT = 20;
const DEFAULT_LOOKBACK_HOURS = 24;

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, "");
}

function createClient(
  session: ReleaseReadinessDrillSession,
  accessTokenOverride?: string
): AxiosInstance {
  const accessToken = accessTokenOverride?.trim() ?? session.accessToken?.trim();

  if (!accessToken) {
    throw new Error(
      "Release-readiness drill runner requires an operator bearer token."
    );
  }

  return axios.create({
    baseURL: normalizeBaseUrl(session.baseUrl),
    headers: {
      Authorization: `Bearer ${accessToken}`
    },
    timeout: 15_000
  });
}

function createCustomerClient(
  session: ReleaseReadinessDrillSession
): AxiosInstance {
  const customerAccessToken = session.customerAccessToken?.trim();

  if (!customerAccessToken) {
    throw new Error(
      "Notification cutover verification requires --customer-access-token."
    );
  }

  return createClient(session, customerAccessToken);
}

async function requestData<T>(
  client: AxiosInstance,
  path: string,
  params: Record<string, string | number | undefined>
): Promise<{
  statusCode: number;
  data: T;
}> {
  const response = await client.get<ApiEnvelope<T>>(path, {
    params
  });

  if (response.data.data === undefined) {
    throw new Error(response.data.message || `API response for ${path} had no data.`);
  }

  return {
    statusCode: response.status,
    data: response.data.data
  };
}

async function postData<T>(
  client: AxiosInstance,
  path: string,
  body: Record<string, unknown> = {}
): Promise<{
  statusCode: number;
  data: T;
}> {
  const response = await client.post<ApiEnvelope<T>>(path, body);

  if (response.data.data === undefined) {
    throw new Error(response.data.message || `API response for ${path} had no data.`);
  }

  return {
    statusCode: response.status,
    data: response.data.data
  };
}

function buildFailedResult(
  evidenceType: ReleaseReadinessEvidenceType,
  checks: DrillCheckResult[],
  failures: string[],
  evidencePayload: Record<string, unknown>
): ReleaseReadinessDrillResult {
  return {
    evidenceType,
    status: "failed",
    summary: failures[0] ?? `${evidenceType} drill validation failed.`,
    observedAt: new Date().toISOString(),
    failures,
    checks,
    evidencePayload
  };
}

function buildPassedResult(
  evidenceType: ReleaseReadinessEvidenceType,
  checks: DrillCheckResult[],
  summary: string,
  evidencePayload: Record<string, unknown>
): ReleaseReadinessDrillResult {
  return {
    evidenceType,
    status: "passed",
    summary,
    observedAt: new Date().toISOString(),
    failures: [],
    checks,
    evidencePayload
  };
}

export function evaluatePlatformAlertDeliverySloProbe(
  targetHealth: PlatformAlertDeliveryTargetHealthListData,
  alerts: PlatformAlertListData,
  options: ReleaseReadinessDrillOptions
): ReleaseReadinessDrillResult {
  const expectedTargetName = options.expectedTargetName?.trim();
  const expectedHealthStatus = options.expectedTargetHealthStatus;
  const failures: string[] = [];
  const matchingTargets = expectedTargetName
    ? targetHealth.targets.filter((target) => target.targetName === expectedTargetName)
    : targetHealth.targets.filter(
        (target) =>
          target.healthStatus !== "healthy" || target.sloBreaches.length > 0
      );
  const matchingTarget = matchingTargets[0] ?? null;

  if (!matchingTarget) {
    failures.push(
      expectedTargetName
        ? `No delivery target named ${expectedTargetName} was found in target health output.`
        : "No delivery target showed a warning or critical SLO posture."
    );
  } else if (
    expectedHealthStatus &&
    matchingTarget.healthStatus !== expectedHealthStatus
  ) {
    failures.push(
      `Delivery target ${matchingTarget.targetName} was ${matchingTarget.healthStatus}, expected ${expectedHealthStatus}.`
    );
  }

  const matchingOperationsAlerts = alerts.alerts.filter(
    (alert) => alert.category === "operations"
  );

  if (matchingOperationsAlerts.length === 0) {
    failures.push(
      "No open operations alert was present while validating delivery-target SLO posture."
    );
  }

  const checks: DrillCheckResult[] = [
    {
      name: "delivery_target_health",
      path: "/operations/internal/alerts/delivery-target-health",
      ok: matchingTarget !== null,
      statusCode: 200,
      summary: matchingTarget
        ? `Matched delivery target ${matchingTarget.targetName} with ${matchingTarget.healthStatus} health.`
        : "No matching delivery target found.",
      payload: {
        generatedAt: targetHealth.generatedAt,
        matchingTarget,
        targetSummary: targetHealth.summary
      }
    },
    {
      name: "operations_alerts",
      path: "/operations/internal/alerts",
      ok: matchingOperationsAlerts.length > 0,
      statusCode: 200,
      summary:
        matchingOperationsAlerts.length > 0
          ? `${matchingOperationsAlerts.length} open operations alerts observed.`
          : "No open operations alerts observed.",
      payload: {
        observedAlertCount: matchingOperationsAlerts.length,
        matchingOperationsAlerts
      }
    }
  ];

  const evidencePayload = {
    targetHealth: {
      generatedAt: targetHealth.generatedAt,
      lookbackHours: targetHealth.lookbackHours,
      summary: targetHealth.summary,
      matchingTarget
    },
    operationsAlerts: matchingOperationsAlerts
  };

  if (failures.length > 0) {
    return buildFailedResult(
      ReleaseReadinessEvidenceType.platform_alert_delivery_slo,
      checks,
      failures,
      evidencePayload
    );
  }

  return buildPassedResult(
    ReleaseReadinessEvidenceType.platform_alert_delivery_slo,
    checks,
    `Validated delivery-target SLO drill through target ${
      matchingTarget!.targetName
    } with ${matchingTarget!.healthStatus} health and ${
      matchingOperationsAlerts.length
    } open operations alerts.`,
    evidencePayload
  );
}

export function evaluateCriticalAlertReEscalationProbe(
  alerts: PlatformAlertListData,
  options: ReleaseReadinessDrillOptions
): ReleaseReadinessDrillResult {
  const expectedAlertId = options.expectedAlertId?.trim();
  const expectedDedupeKey = options.expectedDedupeKey?.trim();
  const expectedMinReEscalations = options.expectedMinReEscalations ?? 1;
  const matchingAlert =
    alerts.alerts.find((alert) => alert.id === expectedAlertId) ??
    alerts.alerts.find((alert) => alert.dedupeKey === expectedDedupeKey) ??
    alerts.alerts.find(
      (alert) => alert.deliverySummary.reEscalationCount >= expectedMinReEscalations
    ) ??
    null;
  const failures: string[] = [];

  if (!matchingAlert) {
    failures.push(
      "No critical alert matched the requested re-escalation proof criteria."
    );
  } else if (
    matchingAlert.deliverySummary.reEscalationCount < expectedMinReEscalations
  ) {
    failures.push(
      `Alert ${matchingAlert.id} had ${matchingAlert.deliverySummary.reEscalationCount} re-escalations, expected at least ${expectedMinReEscalations}.`
    );
  }

  const checks: DrillCheckResult[] = [
    {
      name: "critical_alerts",
      path: "/operations/internal/alerts",
      ok: matchingAlert !== null,
      statusCode: 200,
      summary: matchingAlert
        ? `Alert ${matchingAlert.id} recorded ${matchingAlert.deliverySummary.reEscalationCount} re-escalations.`
        : "No matching critical alert found.",
      payload: {
        matchingAlert,
        observedAlertCount: alerts.alerts.length
      }
    }
  ];

  const evidencePayload = {
    matchingAlert,
    observedAlertCount: alerts.alerts.length,
    expectedMinReEscalations
  };

  if (failures.length > 0) {
    return buildFailedResult(
      ReleaseReadinessEvidenceType.critical_alert_reescalation,
      checks,
      failures,
      evidencePayload
    );
  }

  return buildPassedResult(
    ReleaseReadinessEvidenceType.critical_alert_reescalation,
    checks,
    `Validated critical alert re-escalation drill on alert ${matchingAlert!.id} with ${matchingAlert!.deliverySummary.reEscalationCount} re-escalations.`,
    evidencePayload
  );
}

export function evaluateRestoreOrApiRollbackProbe(
  evidenceType: "database_restore_drill" | "api_rollback_drill",
  operationsStatus: OperationsStatusData,
  ledgerRuns: LedgerReconciliationRunListData,
  reviewCases: ReviewCaseListData,
  auditEvents: AuditEventListData
): ReleaseReadinessDrillResult {
  const checks: DrillCheckResult[] = [
    {
      name: "operations_status",
      path: "/operations/internal/status",
      ok: true,
      statusCode: 200,
      summary: `Operations status returned ${operationsStatus.workerHealth.status} worker health and ${operationsStatus.reconciliationHealth.status} reconciliation health.`,
      payload: {
        generatedAt: operationsStatus.generatedAt,
        workerHealth: operationsStatus.workerHealth,
        reconciliationHealth: operationsStatus.reconciliationHealth
      }
    },
    {
      name: "ledger_reconciliation_runs",
      path: "/ledger/internal/reconciliation/runs",
      ok: true,
      statusCode: 200,
      summary: `Loaded ${ledgerRuns.totalCount} reconciliation runs.`,
      payload: {
        latestRun: ledgerRuns.runs[0] ?? null,
        totalCount: ledgerRuns.totalCount
      }
    },
    {
      name: "review_cases",
      path: "/review-cases/internal",
      ok: true,
      statusCode: 200,
      summary: `Loaded ${reviewCases.reviewCases.length} review cases from operator API.`,
      payload: {
        firstReviewCase: reviewCases.reviewCases[0] ?? null,
        returnedCount: reviewCases.reviewCases.length
      }
    },
    {
      name: "audit_events",
      path: "/audit-events/internal",
      ok: true,
      statusCode: 200,
      summary: `Loaded ${auditEvents.events.length} audit events from operator API.`,
      payload: {
        firstAuditEvent: auditEvents.events[0] ?? null,
        totalCount: auditEvents.totalCount
      }
    }
  ];

  const evidencePayload = {
    operationsStatus: {
      generatedAt: operationsStatus.generatedAt,
      workerHealth: operationsStatus.workerHealth,
      reconciliationHealth: operationsStatus.reconciliationHealth
    },
    ledgerRuns: {
      latestRun: ledgerRuns.runs[0] ?? null,
      totalCount: ledgerRuns.totalCount
    },
    reviewCases: {
      firstReviewCase: reviewCases.reviewCases[0] ?? null,
      returnedCount: reviewCases.reviewCases.length
    },
    auditEvents: {
      firstAuditEvent: auditEvents.events[0] ?? null,
      totalCount: auditEvents.totalCount
    }
  };

  return buildPassedResult(
    evidenceType,
    checks,
    evidenceType === ReleaseReadinessEvidenceType.database_restore_drill
      ? "Validated restore drill operator surfaces and reconciliation reads after restore."
      : "Validated rollback drill operator surfaces and reconciliation reads after API rollback.",
    evidencePayload
  );
}

export function evaluateWorkerRollbackProbe(
  operationsStatus: OperationsStatusData,
  workerHealth: WorkerRuntimeHealthListData,
  options: ReleaseReadinessDrillOptions
): ReleaseReadinessDrillResult {
  const expectedMinHealthyWorkers = options.expectedMinHealthyWorkers ?? 1;
  const expectedWorkerId = options.expectedWorkerId?.trim();
  const matchingWorker = expectedWorkerId
    ? workerHealth.workers.find((worker) => worker.workerId === expectedWorkerId) ??
      null
    : workerHealth.workers.find((worker) => worker.healthStatus === "healthy") ??
      null;
  const failures: string[] = [];

  if (workerHealth.workers.length < expectedMinHealthyWorkers) {
    failures.push(
      `Only ${workerHealth.workers.length} worker records were returned, expected at least ${expectedMinHealthyWorkers}.`
    );
  }

  if (!matchingWorker) {
    failures.push(
      expectedWorkerId
        ? `Expected worker ${expectedWorkerId} was not found in worker health output.`
        : "No healthy worker was observed after rollback validation."
    );
  } else if (matchingWorker.healthStatus !== "healthy") {
    failures.push(
      `Worker ${matchingWorker.workerId} reported ${matchingWorker.healthStatus} health instead of healthy.`
    );
  }

  if (operationsStatus.workerHealth.healthyWorkers < expectedMinHealthyWorkers) {
    failures.push(
      `Operations status reported ${operationsStatus.workerHealth.healthyWorkers} healthy workers, expected at least ${expectedMinHealthyWorkers}.`
    );
  }

  const checks: DrillCheckResult[] = [
    {
      name: "worker_runtime_health",
      path: "/operations/internal/workers/health",
      ok: matchingWorker !== null && matchingWorker.healthStatus === "healthy",
      statusCode: 200,
      summary: matchingWorker
        ? `Worker ${matchingWorker.workerId} is ${matchingWorker.healthStatus}.`
        : "No matching worker found.",
      payload: {
        staleAfterSeconds: workerHealth.staleAfterSeconds,
        matchingWorker,
        workers: workerHealth.workers
      }
    },
    {
      name: "operations_status",
      path: "/operations/internal/status",
      ok: operationsStatus.workerHealth.healthyWorkers >= expectedMinHealthyWorkers,
      statusCode: 200,
      summary: `Operations status reported ${operationsStatus.workerHealth.healthyWorkers}/${operationsStatus.workerHealth.totalWorkers} healthy workers.`,
      payload: {
        workerHealth: operationsStatus.workerHealth
      }
    }
  ];

  const evidencePayload = {
    workerHealth: {
      staleAfterSeconds: workerHealth.staleAfterSeconds,
      workers: workerHealth.workers,
      matchingWorker
    },
    operationsStatus: {
      workerHealth: operationsStatus.workerHealth
    },
    expectedMinHealthyWorkers
  };

  if (failures.length > 0) {
    return buildFailedResult(
      ReleaseReadinessEvidenceType.worker_rollback_drill,
      checks,
      failures,
      evidencePayload
    );
  }

  return buildPassedResult(
    ReleaseReadinessEvidenceType.worker_rollback_drill,
    checks,
    `Validated worker rollback drill with ${
      operationsStatus.workerHealth.healthyWorkers
    } healthy workers and fresh heartbeat for ${matchingWorker!.workerId}.`,
    evidencePayload
  );
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 0;
}

function hasSupportedNotificationChannels(
  supportedChannels: string[]
): boolean {
  return (
    supportedChannels.includes("in_app") && supportedChannels.includes("email")
  );
}

function sanitizeSocketSession(
  socketSession: NotificationSocketSessionData
): Record<string, unknown> {
  return {
    audience: socketSession.audience,
    recipientKey: socketSession.recipientKey,
    hasSocketToken: socketSession.socketToken.trim().length > 0,
    expiresAt: socketSession.expiresAt,
    latestSequence: socketSession.latestSequence,
    heartbeatIntervalMs: socketSession.heartbeatIntervalMs,
    supportedChannels: socketSession.supportedChannels
  };
}

function evaluateNotificationAudienceProbe(input: {
  audience: "customer" | "operator";
  feed: NotificationFeedData;
  unreadSummary: NotificationUnreadSummaryData;
  preferences: NotificationPreferencesData;
  socketSession: NotificationSocketSessionData;
  requireFeedItem: boolean;
}): {
  failures: string[];
  checks: DrillCheckResult[];
  payload: Record<string, unknown>;
} {
  const failures: string[] = [];
  const feedItems = input.feed.items;
  const latestFeedSequence = feedItems.reduce(
    (current, item) => Math.max(current, item.deliverySequence),
    0
  );
  const preferenceMatrix = input.preferences.notificationPreferences;
  const socketExpiresAt = Date.parse(input.socketSession.expiresAt);

  if (!Array.isArray(feedItems)) {
    failures.push(`${input.audience} notification feed did not return items.`);
  }

  if (input.requireFeedItem && feedItems.length === 0) {
    failures.push(
      `${input.audience} notification feed did not include a cutover verification item.`
    );
  }

  if (!isNonNegativeInteger(input.feed.unreadCount)) {
    failures.push(`${input.audience} notification feed unreadCount is invalid.`);
  }

  if (
    !isNonNegativeInteger(input.unreadSummary.unreadCount) ||
    !isNonNegativeInteger(input.unreadSummary.criticalCount) ||
    !isNonNegativeInteger(input.unreadSummary.highCount)
  ) {
    failures.push(
      `${input.audience} notification unread summary returned invalid counters.`
    );
  }

  if (preferenceMatrix.audience !== input.audience) {
    failures.push(
      `${input.audience} notification preferences returned audience ${preferenceMatrix.audience}.`
    );
  }

  if (!hasSupportedNotificationChannels(preferenceMatrix.supportedChannels)) {
    failures.push(
      `${input.audience} notification preferences do not expose in_app and email channels.`
    );
  }

  if (preferenceMatrix.entries.length === 0) {
    failures.push(`${input.audience} notification preference matrix is empty.`);
  }

  if (input.socketSession.audience !== input.audience) {
    failures.push(
      `${input.audience} notification socket session returned audience ${input.socketSession.audience}.`
    );
  }

  if (!input.socketSession.recipientKey.startsWith(`${input.audience}:`)) {
    failures.push(
      `${input.audience} notification socket session recipient key is malformed.`
    );
  }

  if (input.socketSession.socketToken.trim().length === 0) {
    failures.push(
      `${input.audience} notification socket session did not issue a token.`
    );
  }

  if (
    !isNonNegativeInteger(input.socketSession.latestSequence) ||
    input.socketSession.latestSequence < latestFeedSequence
  ) {
    failures.push(
      `${input.audience} notification socket session latestSequence is behind the feed.`
    );
  }

  if (!Number.isFinite(socketExpiresAt) || socketExpiresAt <= Date.now()) {
    failures.push(
      `${input.audience} notification socket session expiresAt is not in the future.`
    );
  }

  if (
    !Number.isInteger(input.socketSession.heartbeatIntervalMs) ||
    input.socketSession.heartbeatIntervalMs <= 0
  ) {
    failures.push(
      `${input.audience} notification socket session heartbeat interval is invalid.`
    );
  }

  if (!hasSupportedNotificationChannels(input.socketSession.supportedChannels)) {
    failures.push(
      `${input.audience} notification socket session does not expose in_app and email channels.`
    );
  }

  const payload = {
    feed: {
      itemCount: feedItems.length,
      unreadCount: input.feed.unreadCount,
      latestFeedSequence,
      sampleItems: feedItems.slice(0, 5)
    },
    unreadSummary: input.unreadSummary,
    preferences: {
      audience: preferenceMatrix.audience,
      supportedChannels: preferenceMatrix.supportedChannels,
      entryCount: preferenceMatrix.entries.length,
      categories: preferenceMatrix.entries.map((entry) => entry.category)
    },
    socketSession: sanitizeSocketSession(input.socketSession)
  };

  const checks: DrillCheckResult[] = [
    {
      name: `${input.audience}_notification_feed`,
      path:
        input.audience === "customer"
          ? "/notifications/me"
          : "/notifications/internal/me",
      ok:
        Array.isArray(feedItems) &&
        isNonNegativeInteger(input.feed.unreadCount) &&
        (!input.requireFeedItem || feedItems.length > 0),
      statusCode: 200,
      summary: `Loaded ${feedItems.length} ${input.audience} notification feed items with ${input.feed.unreadCount} unread.`,
      payload: payload.feed as Record<string, unknown>
    },
    {
      name: `${input.audience}_notification_unread_summary`,
      path:
        input.audience === "customer"
          ? "/notifications/me/unread-count"
          : "/notifications/internal/me/unread-count",
      ok:
        isNonNegativeInteger(input.unreadSummary.unreadCount) &&
        isNonNegativeInteger(input.unreadSummary.criticalCount) &&
        isNonNegativeInteger(input.unreadSummary.highCount),
      statusCode: 200,
      summary: `Loaded ${input.audience} unread summary with ${input.unreadSummary.unreadCount} unread notifications.`,
      payload: { ...input.unreadSummary }
    },
    {
      name: `${input.audience}_notification_preferences`,
      path:
        input.audience === "customer"
          ? "/notifications/me/preferences"
          : "/notifications/internal/me/preferences",
      ok:
        preferenceMatrix.audience === input.audience &&
        hasSupportedNotificationChannels(preferenceMatrix.supportedChannels) &&
        preferenceMatrix.entries.length > 0,
      statusCode: 200,
      summary: `Loaded ${input.audience} notification preference matrix with ${preferenceMatrix.entries.length} categories.`,
      payload: payload.preferences as Record<string, unknown>
    },
    {
      name: `${input.audience}_notification_socket_session`,
      path:
        input.audience === "customer"
          ? "/notifications/me/socket-session"
          : "/notifications/internal/me/socket-session",
      ok:
        input.socketSession.audience === input.audience &&
        input.socketSession.recipientKey.startsWith(`${input.audience}:`) &&
        input.socketSession.socketToken.trim().length > 0 &&
        isNonNegativeInteger(input.socketSession.latestSequence) &&
        input.socketSession.latestSequence >= latestFeedSequence &&
        Number.isFinite(socketExpiresAt) &&
        socketExpiresAt > Date.now() &&
        Number.isInteger(input.socketSession.heartbeatIntervalMs) &&
        input.socketSession.heartbeatIntervalMs > 0 &&
        hasSupportedNotificationChannels(input.socketSession.supportedChannels),
      statusCode: 200,
      summary: `Issued ${input.audience} notification websocket resume session at sequence ${input.socketSession.latestSequence}.`,
      payload: payload.socketSession as Record<string, unknown>
    }
  ];

  return {
    failures,
    checks,
    payload
  };
}

export function evaluateNotificationCutoverVerificationProbe(input: {
  customerFeed: NotificationFeedData;
  customerUnreadSummary: NotificationUnreadSummaryData;
  customerPreferences: NotificationPreferencesData;
  customerSocketSession: NotificationSocketSessionData;
  operatorFeed: NotificationFeedData;
  operatorUnreadSummary: NotificationUnreadSummaryData;
  operatorPreferences: NotificationPreferencesData;
  operatorSocketSession: NotificationSocketSessionData;
  options: ReleaseReadinessDrillOptions;
}): ReleaseReadinessDrillResult {
  const customerResult = evaluateNotificationAudienceProbe({
    audience: "customer",
    feed: input.customerFeed,
    unreadSummary: input.customerUnreadSummary,
    preferences: input.customerPreferences,
    socketSession: input.customerSocketSession,
    requireFeedItem: input.options.requireNotificationFeedItem ?? false
  });
  const operatorResult = evaluateNotificationAudienceProbe({
    audience: "operator",
    feed: input.operatorFeed,
    unreadSummary: input.operatorUnreadSummary,
    preferences: input.operatorPreferences,
    socketSession: input.operatorSocketSession,
    requireFeedItem: input.options.requireNotificationFeedItem ?? false
  });
  const failures = [...customerResult.failures, ...operatorResult.failures];
  const checks = [...customerResult.checks, ...operatorResult.checks];
  const evidencePayload = {
    customer: customerResult.payload,
    operator: operatorResult.payload,
    requireNotificationFeedItem:
      input.options.requireNotificationFeedItem ?? false
  };

  if (failures.length > 0) {
    return buildFailedResult(
      notificationCutoverVerificationEvidenceType,
      checks,
      failures,
      evidencePayload
    );
  }

  return buildPassedResult(
    notificationCutoverVerificationEvidenceType,
    checks,
    "Validated notification cutover across customer and operator inboxes, unread summaries, preference matrices, and websocket resume sessions.",
    evidencePayload
  );
}

export async function runReleaseReadinessDrill(
  session: ReleaseReadinessDrillSession,
  options: ReleaseReadinessDrillOptions,
  client: AxiosInstance = createClient(session)
): Promise<ReleaseReadinessDrillResult> {
  const staleAfterSeconds = options.staleAfterSeconds ?? DEFAULT_STALE_AFTER_SECONDS;
  const recentAlertLimit = options.recentAlertLimit ?? DEFAULT_RECENT_ALERT_LIMIT;
  const lookbackHours = options.lookbackHours ?? DEFAULT_LOOKBACK_HOURS;

  switch (options.evidenceType) {
    case ReleaseReadinessEvidenceType.database_restore_drill:
    case ReleaseReadinessEvidenceType.api_rollback_drill: {
      const [operationsStatus, ledgerRuns, reviewCases, auditEvents] =
        await Promise.all([
          requestData<OperationsStatusData>(client, "/operations/internal/status", {
            staleAfterSeconds,
            recentAlertLimit
          }),
          requestData<LedgerReconciliationRunListData>(
            client,
            "/ledger/internal/reconciliation/runs",
            {
              limit: 1
            }
          ),
          requestData<ReviewCaseListData>(client, "/review-cases/internal", {
            limit: 1
          }),
          requestData<AuditEventListData>(client, "/audit-events/internal", {
            limit: 1
          })
        ]);

      return evaluateRestoreOrApiRollbackProbe(
        options.evidenceType,
        operationsStatus.data,
        ledgerRuns.data,
        reviewCases.data,
        auditEvents.data
      );
    }

    case ReleaseReadinessEvidenceType.worker_rollback_drill: {
      const [operationsStatus, workerHealth] = await Promise.all([
        requestData<OperationsStatusData>(client, "/operations/internal/status", {
          staleAfterSeconds,
          recentAlertLimit
        }),
        requestData<WorkerRuntimeHealthListData>(
          client,
          "/operations/internal/workers/health",
          {
            limit: Math.max(options.expectedMinHealthyWorkers ?? 1, 5),
            staleAfterSeconds,
            workerId: options.expectedWorkerId
          }
        )
      ]);

      return evaluateWorkerRollbackProbe(
        operationsStatus.data,
        workerHealth.data,
        options
      );
    }

    case ReleaseReadinessEvidenceType.platform_alert_delivery_slo: {
      const [targetHealth, alerts] = await Promise.all([
        requestData<PlatformAlertDeliveryTargetHealthListData>(
          client,
          "/operations/internal/alerts/delivery-target-health",
          {
            lookbackHours
          }
        ),
        requestData<PlatformAlertListData>(client, "/operations/internal/alerts", {
          limit: recentAlertLimit,
          staleAfterSeconds,
          status: "open",
          category: "operations"
        })
      ]);

      return evaluatePlatformAlertDeliverySloProbe(
        targetHealth.data,
        alerts.data,
        options
      );
    }

    case ReleaseReadinessEvidenceType.critical_alert_reescalation: {
      const alerts = await requestData<PlatformAlertListData>(
        client,
        "/operations/internal/alerts",
        {
          limit: recentAlertLimit,
          staleAfterSeconds,
          status: "open",
          severity: "critical"
        }
      );

      return evaluateCriticalAlertReEscalationProbe(alerts.data, options);
    }

    case notificationCutoverVerificationEvidenceType: {
      const customerClient = createCustomerClient(session);

      const [
        customerFeed,
        customerUnreadSummary,
        customerPreferences,
        customerSocketSession,
        operatorFeed,
        operatorUnreadSummary,
        operatorPreferences,
        operatorSocketSession
      ] = await Promise.all([
        requestData<NotificationFeedData>(customerClient, "/notifications/me", {
          limit: 5
        }),
        requestData<NotificationUnreadSummaryData>(
          customerClient,
          "/notifications/me/unread-count",
          {}
        ),
        requestData<NotificationPreferencesData>(
          customerClient,
          "/notifications/me/preferences",
          {}
        ),
        postData<NotificationSocketSessionData>(
          customerClient,
          "/notifications/me/socket-session",
          {}
        ),
        requestData<NotificationFeedData>(client, "/notifications/internal/me", {
          limit: 5
        }),
        requestData<NotificationUnreadSummaryData>(
          client,
          "/notifications/internal/me/unread-count",
          {}
        ),
        requestData<NotificationPreferencesData>(
          client,
          "/notifications/internal/me/preferences",
          {}
        ),
        postData<NotificationSocketSessionData>(
          client,
          "/notifications/internal/me/socket-session",
          {}
        )
      ]);

      return evaluateNotificationCutoverVerificationProbe({
        customerFeed: customerFeed.data,
        customerUnreadSummary: customerUnreadSummary.data,
        customerPreferences: customerPreferences.data,
        customerSocketSession: customerSocketSession.data,
        operatorFeed: operatorFeed.data,
        operatorUnreadSummary: operatorUnreadSummary.data,
        operatorPreferences: operatorPreferences.data,
        operatorSocketSession: operatorSocketSession.data,
        options
      });
    }

    default:
      throw new Error(`Unsupported drill evidence type: ${options.evidenceType}`);
  }
}

export async function recordReleaseReadinessEvidence(
  session: ReleaseReadinessDrillSession,
  payload: {
    evidenceType: ReleaseReadinessEvidenceType;
    environment: ReleaseReadinessEnvironment;
    status: "passed" | "failed";
    summary: string;
    note?: string;
    releaseIdentifier?: string;
    rollbackReleaseIdentifier?: string;
    backupReference?: string;
    observedAt: string;
    evidenceLinks?: string[];
    evidencePayload: Record<string, unknown>;
  },
  client: AxiosInstance = createClient(session)
): Promise<{
  evidence: {
    id: string;
    status: "passed" | "failed";
  };
}> {
  const response = await client.post<
    ApiEnvelope<{
      evidence: {
        id: string;
        status: "passed" | "failed";
      };
    }>
  >("/release-readiness/internal/evidence", payload);

  if (response.data.data === undefined) {
    throw new Error(
      response.data.message ||
        "Release readiness evidence API response did not include data."
    );
  }

  return response.data.data;
}

export type {
  ReleaseReadinessDrillOptions,
  ReleaseReadinessDrillResult,
  ReleaseReadinessDrillSession
};
