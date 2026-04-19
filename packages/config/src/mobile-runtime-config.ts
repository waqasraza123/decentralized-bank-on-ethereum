import {
  readOptionalRuntimeEnv,
  type RuntimeEnvShape
} from "./runtime-env";

export type MobileRuntimeConfig = {
  readonly apiBaseUrl: string;
  readonly telemetryEndpoint: string | null;
  readonly telemetryEnvironment: string;
  readonly telemetryRelease: string | null;
};

function readLocalWebDevApiBaseUrl(): string | undefined {
  if (typeof globalThis.location === "undefined") {
    return undefined;
  }

  const hostname = globalThis.location.hostname;

  if (hostname !== "localhost" && hostname !== "127.0.0.1") {
    return undefined;
  }

  return "http://localhost:9101";
}

export function loadMobileRuntimeConfig(
  env: RuntimeEnvShape
): MobileRuntimeConfig {
  const apiBaseUrl =
    readOptionalRuntimeEnv(env, "EXPO_PUBLIC_API_BASE_URL") ??
    readLocalWebDevApiBaseUrl();

  if (!apiBaseUrl) {
    throw new Error(
      "Missing required environment variable: EXPO_PUBLIC_API_BASE_URL. " +
        "Create apps/mobile/.env from apps/mobile/.env.example, or set " +
        "EXPO_PUBLIC_API_BASE_URL before starting Expo."
    );
  }

  return {
    apiBaseUrl,
    telemetryEndpoint:
      readOptionalRuntimeEnv(env, "EXPO_PUBLIC_TELEMETRY_ENDPOINT") ?? null,
    telemetryEnvironment:
      readOptionalRuntimeEnv(env, "EXPO_PUBLIC_TELEMETRY_ENVIRONMENT") ??
      "development",
    telemetryRelease:
      readOptionalRuntimeEnv(env, "EXPO_PUBLIC_TELEMETRY_RELEASE") ?? null
  };
}
