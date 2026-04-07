function serializeError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack
    };
  }

  return error;
}

export function writeStructuredApiLog(
  level: "info" | "warn" | "error",
  event: string,
  metadata: Record<string, unknown>
): void {
  const payload = {
    timestamp: new Date().toISOString(),
    level,
    service: "api",
    event,
    ...metadata,
    ...(metadata.error
      ? {
          error: serializeError(metadata.error)
        }
      : {})
  };

  const serializedPayload = JSON.stringify(payload);

  if (level === "error") {
    console.error(serializedPayload);
    return;
  }

  if (level === "warn") {
    console.warn(serializedPayload);
    return;
  }

  console.log(serializedPayload);
}
