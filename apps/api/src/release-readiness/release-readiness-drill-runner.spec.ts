import { ReleaseReadinessEvidenceType } from "@prisma/client";
import {
  evaluateCriticalAlertReEscalationProbe,
  evaluateNotificationCutoverVerificationProbe,
  evaluatePlatformAlertDeliverySloProbe,
  evaluateWorkerRollbackProbe
} from "./release-readiness-drill-runner";

describe("release-readiness-drill-runner", () => {
  it("passes delivery target SLO validation when a degraded target and operations alert exist", () => {
    const result = evaluatePlatformAlertDeliverySloProbe(
      {
        generatedAt: "2026-04-08T10:00:00.000Z",
        lookbackHours: 24,
        summary: {
          totalTargetCount: 1,
          healthyTargetCount: 0,
          warningTargetCount: 0,
          criticalTargetCount: 1
        },
        targets: [
          {
            targetName: "ops-critical",
            healthStatus: "critical",
            recentDeliveryCount: 5,
            recentFailedCount: 3,
            pendingDeliveryCount: 1,
            recentFailureRatePercent: 60,
            consecutiveFailureCount: 3,
            sloBreaches: ["failure_rate"]
          }
        ]
      },
      {
        alerts: [
          {
            id: "alert_1",
            dedupeKey: "ops.delivery-target-health",
            severity: "critical",
            status: "open",
            category: "operations",
            code: "platform_alert_delivery_health_slo_breach",
            summary: "Target health degraded",
            deliverySummary: {
              reEscalationCount: 0,
              escalatedCount: 1,
              failedCount: 0,
              pendingCount: 0,
              lastStatus: "succeeded",
              lastTargetName: "ops-critical"
            }
          }
        ],
        limit: 20,
        totalCount: 1
      },
      {
        evidenceType: ReleaseReadinessEvidenceType.platform_alert_delivery_slo,
        expectedTargetName: "ops-critical",
        expectedTargetHealthStatus: "critical"
      }
    );

    expect(result.status).toBe("passed");
    expect(result.failures).toHaveLength(0);
  });

  it("fails re-escalation validation when no alert meets the threshold", () => {
    const result = evaluateCriticalAlertReEscalationProbe(
      {
        alerts: [
          {
            id: "alert_1",
            dedupeKey: "worker.down",
            severity: "critical",
            status: "open",
            category: "worker",
            code: "worker_failure",
            summary: "Worker unhealthy",
            deliverySummary: {
              reEscalationCount: 0,
              escalatedCount: 1,
              failedCount: 0,
              pendingCount: 0,
              lastStatus: "succeeded",
              lastTargetName: "ops-critical"
            }
          }
        ],
        limit: 20,
        totalCount: 1
      },
      {
        evidenceType: ReleaseReadinessEvidenceType.critical_alert_reescalation,
        expectedMinReEscalations: 1
      }
    );

    expect(result.status).toBe("failed");
    expect(result.failures[0]).toContain("No critical alert matched");
  });

  it("fails worker rollback validation when healthy workers are missing", () => {
    const result = evaluateWorkerRollbackProbe(
      {
        generatedAt: "2026-04-08T10:00:00.000Z",
        workerHealth: {
          status: "critical",
          healthyWorkers: 0,
          totalWorkers: 1,
          staleWorkers: 1
        },
        queueHealth: {
          status: "healthy",
          totalQueuedCount: 0
        },
        reconciliationHealth: {
          status: "healthy",
          recentFailedScanCount: 0,
          latestScanStatus: "succeeded"
        },
        recentAlerts: []
      },
      {
        workers: [
          {
            workerId: "worker-staging-1",
            healthStatus: "stale",
            lastHeartbeatAt: "2026-04-08T09:00:00.000Z",
            lastIterationStatus: "succeeded",
            consecutiveFailureCount: 0
          }
        ],
        staleAfterSeconds: 180,
        totalCount: 1
      },
      {
        evidenceType: ReleaseReadinessEvidenceType.worker_rollback_drill,
        expectedWorkerId: "worker-staging-1",
        expectedMinHealthyWorkers: 1
      }
    );

    expect(result.status).toBe("failed");
    expect(result.failures.join(" ")).toContain("worker-staging-1");
  });

  it("passes notification cutover verification when customer and operator surfaces are coherent", () => {
    const futureExpiry = new Date(Date.now() + 60_000).toISOString();
    const buildFeed = () => ({
      items: [
        {
          id: "notification_1",
          deliverySequence: 4,
          category: "money_movement",
          priority: "high",
          readAt: null,
          archivedAt: null,
          createdAt: "2026-04-27T10:00:00.000Z"
        }
      ],
      unreadCount: 1,
      limit: 5
    });
    const buildUnreadSummary = () => ({
      unreadCount: 1,
      criticalCount: 0,
      highCount: 1
    });
    const buildPreferences = (audience: "customer" | "operator") => ({
      notificationPreferences: {
        audience,
        supportedChannels: ["in_app", "email"],
        entries: [
          {
            category: "money_movement",
            channels: [
              { channel: "in_app", enabled: true, mandatory: true },
              { channel: "email", enabled: true, mandatory: false }
            ]
          }
        ],
        updatedAt: "2026-04-27T10:00:00.000Z"
      }
    });
    const buildSocketSession = (audience: "customer" | "operator") => ({
      audience,
      recipientKey: `${audience}:recipient_1`,
      socketToken: `${audience}_socket_token`,
      expiresAt: futureExpiry,
      latestSequence: 4,
      heartbeatIntervalMs: 20_000,
      supportedChannels: ["in_app", "email"]
    });

    const result = evaluateNotificationCutoverVerificationProbe({
      customerFeed: buildFeed(),
      customerUnreadSummary: buildUnreadSummary(),
      customerPreferences: buildPreferences("customer"),
      customerSocketSession: buildSocketSession("customer"),
      operatorFeed: buildFeed(),
      operatorUnreadSummary: buildUnreadSummary(),
      operatorPreferences: buildPreferences("operator"),
      operatorSocketSession: buildSocketSession("operator"),
      options: {
        evidenceType:
          "notification_cutover_verification" as ReleaseReadinessEvidenceType,
        requireNotificationFeedItem: true
      }
    });

    expect(result.status).toBe("passed");
    expect(result.failures).toHaveLength(0);
  });
});
