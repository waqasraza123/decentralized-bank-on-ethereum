import { loadSharedLoginBootstrapRuntimeConfig } from "@stealth-trails-bank/config/api";

describe("loadSharedLoginBootstrapRuntimeConfig", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv
    };
    delete process.env["NODE_ENV"];
    delete process.env["SHARED_LOGIN_ENABLED"];
    delete process.env["SHARED_LOGIN_EMAIL"];
    delete process.env["SHARED_LOGIN_PASSWORD"];
    delete process.env["SHARED_LOGIN_FIRST_NAME"];
    delete process.env["SHARED_LOGIN_LAST_NAME"];
    delete process.env["SHARED_LOGIN_SUPABASE_USER_ID"];
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("defaults shared login bootstrap to disabled in production", () => {
    process.env["NODE_ENV"] = "production";

    const result = loadSharedLoginBootstrapRuntimeConfig(process.env);

    expect(result.enabled).toBe(false);
  });

  it("rejects default production shared-login credentials when bootstrap is enabled", () => {
    process.env["NODE_ENV"] = "production";
    process.env["SHARED_LOGIN_ENABLED"] = "true";

    expect(() =>
      loadSharedLoginBootstrapRuntimeConfig(process.env)
    ).toThrow(
      "SHARED_LOGIN_EMAIL must be explicitly overridden when shared login bootstrap is enabled in production."
    );
  });

  it("accepts explicit production shared-login bootstrap credentials", () => {
    process.env["NODE_ENV"] = "production";
    process.env["SHARED_LOGIN_ENABLED"] = "true";
    process.env["SHARED_LOGIN_EMAIL"] = "ops@example.com";
    process.env["SHARED_LOGIN_PASSWORD"] = "correct-horse-battery-staple";
    process.env["SHARED_LOGIN_SUPABASE_USER_ID"] = "ops-shared-login";

    const result = loadSharedLoginBootstrapRuntimeConfig(process.env);

    expect(result).toEqual({
      enabled: true,
      email: "ops@example.com",
      password: "correct-horse-battery-staple",
      firstName: "Shared",
      lastName: "Admin",
      supabaseUserId: "ops-shared-login"
    });
  });
});
