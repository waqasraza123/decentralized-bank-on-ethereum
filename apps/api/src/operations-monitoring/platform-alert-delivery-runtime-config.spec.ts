import {
  loadPlatformAlertAutomationRuntimeConfig,
  loadPlatformAlertDeliveryRuntimeConfig,
  loadPlatformAlertDeliveryHealthSloRuntimeConfig,
  loadPlatformAlertReEscalationRuntimeConfig
} from "@stealth-trails-bank/config/api";

describe("loadPlatformAlertDeliveryRuntimeConfig", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv
    };
    delete process.env["PLATFORM_ALERT_DELIVERY_TARGETS_JSON"];
    delete process.env["PLATFORM_ALERT_DELIVERY_REQUEST_TIMEOUT_MS"];
    delete process.env["PLATFORM_ALERT_AUTOMATION_POLICIES_JSON"];
    delete process.env["PLATFORM_ALERT_DELIVERY_HEALTH_SLO_JSON"];
    delete process.env["PLATFORM_ALERT_REESCALATION_UNACKNOWLEDGED_SECONDS"];
    delete process.env["PLATFORM_ALERT_REESCALATION_UNOWNED_SECONDS"];
    delete process.env["PLATFORM_ALERT_REESCALATION_REPEAT_SECONDS"];
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("defaults to no targets and a bounded timeout", () => {
    const result = loadPlatformAlertDeliveryRuntimeConfig(process.env);

    expect(result.targets).toEqual([]);
    expect(result.requestTimeoutMs).toBe(5000);
  });

  it("parses valid delivery targets from json", () => {
    process.env["PLATFORM_ALERT_DELIVERY_REQUEST_TIMEOUT_MS"] = "7000";
    process.env["PLATFORM_ALERT_DELIVERY_TARGETS_JSON"] = JSON.stringify([
      {
        name: "ops-critical",
        url: "https://ops.example.com/hooks/platform-alerts",
        bearerToken: "secret-token",
        deliveryMode: "direct",
        categories: ["worker", "queue"],
        minimumSeverity: "critical",
        eventTypes: ["opened", "reopened", "owner_assigned", "re_escalated"],
        failoverTargetNames: ["ops-failover"]
      },
      {
        name: "ops-failover",
        url: "https://pager.example.com/hooks/platform-alerts",
        deliveryMode: "failover_only",
        categories: ["worker", "queue"],
        minimumSeverity: "critical",
        eventTypes: ["opened", "reopened", "owner_assigned", "re_escalated"]
      }
    ]);

    const result = loadPlatformAlertDeliveryRuntimeConfig(process.env);

    expect(result.requestTimeoutMs).toBe(7000);
    expect(result.targets).toEqual([
      {
        name: "ops-critical",
        url: "https://ops.example.com/hooks/platform-alerts",
        bearerToken: "secret-token",
        deliveryMode: "direct",
        categories: ["worker", "queue"],
        minimumSeverity: "critical",
        eventTypes: ["opened", "reopened", "owner_assigned", "re_escalated"],
        failoverTargetNames: ["ops-failover"]
      },
      {
        name: "ops-failover",
        url: "https://pager.example.com/hooks/platform-alerts",
        bearerToken: null,
        deliveryMode: "failover_only",
        categories: ["worker", "queue"],
        minimumSeverity: "critical",
        eventTypes: ["opened", "reopened", "owner_assigned", "re_escalated"],
        failoverTargetNames: []
      }
    ]);
  });

  it("parses valid automation policies from json", () => {
    process.env["PLATFORM_ALERT_AUTOMATION_POLICIES_JSON"] = JSON.stringify([
      {
        name: "critical-worker-auto-route",
        categories: ["worker"],
        minimumSeverity: "critical",
        autoRouteToReviewCase: true,
        routeNote: "Escalate worker outages immediately."
      }
    ]);

    const result = loadPlatformAlertAutomationRuntimeConfig(process.env);

    expect(result.policies).toEqual([
      {
        name: "critical-worker-auto-route",
        categories: ["worker"],
        minimumSeverity: "critical",
        autoRouteToReviewCase: true,
        routeNote: "Escalate worker outages immediately."
      }
    ]);
  });

  it("loads re-escalation timing defaults and overrides", () => {
    expect(loadPlatformAlertReEscalationRuntimeConfig(process.env)).toEqual({
      unacknowledgedCriticalAlertThresholdSeconds: 900,
      unownedCriticalAlertThresholdSeconds: 600,
      repeatIntervalSeconds: 1800
    });

    process.env["PLATFORM_ALERT_REESCALATION_UNACKNOWLEDGED_SECONDS"] = "1200";
    process.env["PLATFORM_ALERT_REESCALATION_UNOWNED_SECONDS"] = "900";
    process.env["PLATFORM_ALERT_REESCALATION_REPEAT_SECONDS"] = "2400";

    expect(loadPlatformAlertReEscalationRuntimeConfig(process.env)).toEqual({
      unacknowledgedCriticalAlertThresholdSeconds: 1200,
      unownedCriticalAlertThresholdSeconds: 900,
      repeatIntervalSeconds: 2400
    });
  });

  it("loads delivery target health SLO defaults and overrides", () => {
    expect(loadPlatformAlertDeliveryHealthSloRuntimeConfig(process.env)).toEqual({
      lookbackHours: 24,
      minimumRecentDeliveries: 3,
      warningFailureRatePercent: 25,
      criticalFailureRatePercent: 50,
      warningPendingCount: 2,
      criticalPendingCount: 5,
      warningAverageDeliveryLatencyMs: 15000,
      criticalAverageDeliveryLatencyMs: 60000,
      warningConsecutiveFailures: 2,
      criticalConsecutiveFailures: 3
    });

    process.env["PLATFORM_ALERT_DELIVERY_HEALTH_SLO_JSON"] = JSON.stringify({
      lookbackHours: 48,
      minimumRecentDeliveries: 5,
      warningFailureRatePercent: 20,
      criticalFailureRatePercent: 40,
      warningPendingCount: 3,
      criticalPendingCount: 6,
      warningAverageDeliveryLatencyMs: 12000,
      criticalAverageDeliveryLatencyMs: 45000,
      warningConsecutiveFailures: 3,
      criticalConsecutiveFailures: 4
    });

    expect(loadPlatformAlertDeliveryHealthSloRuntimeConfig(process.env)).toEqual({
      lookbackHours: 48,
      minimumRecentDeliveries: 5,
      warningFailureRatePercent: 20,
      criticalFailureRatePercent: 40,
      warningPendingCount: 3,
      criticalPendingCount: 6,
      warningAverageDeliveryLatencyMs: 12000,
      criticalAverageDeliveryLatencyMs: 45000,
      warningConsecutiveFailures: 3,
      criticalConsecutiveFailures: 4
    });
  });
});
