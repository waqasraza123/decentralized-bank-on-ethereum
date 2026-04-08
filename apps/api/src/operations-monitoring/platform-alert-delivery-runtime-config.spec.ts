import {
  loadPlatformAlertAutomationRuntimeConfig,
  loadPlatformAlertDeliveryRuntimeConfig,
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
});
