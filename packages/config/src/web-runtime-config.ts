import {
  readRequiredRuntimeEnv,
  type RuntimeEnvShape
} from "./runtime-env";

export type WebRuntimeConfig = {
  readonly serverUrl: string;
};

export function loadWebRuntimeConfig(
  env: RuntimeEnvShape
): WebRuntimeConfig {
  return {
    serverUrl: readRequiredRuntimeEnv(env, "VITE_SERVER_URL")
  };
}
