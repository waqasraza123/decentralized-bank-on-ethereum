import { loadPlatformAlertDeliveryRuntimeConfig } from "@stealth-trails-bank/config/api";

describe("loadPlatformAlertDeliveryRuntimeConfig", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv
    };
    delete process.env["PLATFORM_ALERT_DELIVERY_TARGETS_JSON"];
    delete process.env["PLATFORM_ALERT_DELIVERY_REQUEST_TIMEOUT_MS"];
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
        categories: ["worker", "queue"],
        minimumSeverity: "critical",
        eventTypes: ["opened", "reopened", "owner_assigned"]
      }
    ]);

    const result = loadPlatformAlertDeliveryRuntimeConfig(process.env);

    expect(result.requestTimeoutMs).toBe(7000);
    expect(result.targets).toEqual([
      {
        name: "ops-critical",
        url: "https://ops.example.com/hooks/platform-alerts",
        bearerToken: "secret-token",
        categories: ["worker", "queue"],
        minimumSeverity: "critical",
        eventTypes: ["opened", "reopened", "owner_assigned"]
      }
    ]);
  });
});
