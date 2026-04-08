import { timingSafeEqual } from "node:crypto";

export function matchesApiKey(
  providedApiKey: string,
  configuredApiKey: string
): boolean {
  const providedBuffer = Buffer.from(providedApiKey);
  const configuredBuffer = Buffer.from(configuredApiKey);

  if (providedBuffer.length !== configuredBuffer.length) {
    return false;
  }

  return timingSafeEqual(providedBuffer, configuredBuffer);
}
