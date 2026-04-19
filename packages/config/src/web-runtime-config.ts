import {
  readOptionalRuntimeEnv,
  readRequiredRuntimeEnv,
  type RuntimeEnvShape
} from "./runtime-env";

export type WebRuntimeConfig = {
  readonly serverUrl: string;
  readonly telemetryEndpoint: string | null;
  readonly telemetryEnvironment: string;
  readonly telemetryRelease: string | null;
};

export function loadWebRuntimeConfig(
  env: RuntimeEnvShape
): WebRuntimeConfig {
  return {
    serverUrl: readRequiredRuntimeEnv(env, "VITE_SERVER_URL"),
    telemetryEndpoint:
      readOptionalRuntimeEnv(env, "VITE_TELEMETRY_ENDPOINT") ?? null,
    telemetryEnvironment:
      readOptionalRuntimeEnv(env, "VITE_TELEMETRY_ENVIRONMENT") ??
      "development",
    telemetryRelease:
      readOptionalRuntimeEnv(env, "VITE_TELEMETRY_RELEASE") ?? null
  };
}
