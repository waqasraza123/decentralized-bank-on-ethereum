export type ClientTelemetryLevel = "info" | "warning" | "error";

export type ClientTelemetryKind =
  | "message"
  | "exception"
  | "http_error"
  | "bootstrap_error"
  | "unhandled_rejection"
  | "query_error"
  | "mutation_error";

export type ClientTelemetryContext = Record<string, unknown>;

export type ClientTelemetryConfig = {
  readonly app: string;
  readonly endpoint?: string | null;
  readonly environment?: string | null;
  readonly release?: string | null;
  readonly defaultTags?: Record<string, string | null | undefined>;
};

export type ClientTelemetryEvent = {
  readonly app: string;
  readonly environment: string;
  readonly release: string | null;
  readonly sessionId: string;
  readonly timestamp: string;
  readonly kind: ClientTelemetryKind;
  readonly level: ClientTelemetryLevel;
  readonly message: string;
  readonly errorName?: string;
  readonly stack?: string;
  readonly tags?: Record<string, string>;
  readonly context?: ClientTelemetryContext;
};

export type CaptureTelemetryOptions = {
  readonly kind?: ClientTelemetryKind;
  readonly level?: ClientTelemetryLevel;
  readonly tags?: Record<string, string | null | undefined>;
  readonly context?: ClientTelemetryContext;
};

type FetchLike = (
  input: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    keepalive?: boolean;
  }
) => Promise<unknown>;

type GlobalWithTelemetryTransport = typeof globalThis & {
  navigator?: {
    sendBeacon?: (url: string, data?: string) => boolean;
  };
  fetch?: FetchLike;
  addEventListener?: (
    name: string,
    listener: (event: unknown) => void
  ) => void;
  removeEventListener?: (
    name: string,
    listener: (event: unknown) => void
  ) => void;
};

function trimToNull(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function createSessionId() {
  const timePart = Date.now().toString(36);
  const randomPart = Math.random().toString(36).slice(2, 10);
  return `${timePart}-${randomPart}`;
}

function normalizeTags(
  value: Record<string, string | null | undefined> | undefined
): Record<string, string> | undefined {
  if (!value) {
    return undefined;
  }

  const entries = Object.entries(value)
    .map(([key, item]) => [key, trimToNull(item)] as const)
    .filter((entry): entry is readonly [string, string] => entry[1] !== null);

  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

function serializeTelemetryValue(
  value: unknown,
  depth = 0
): unknown {
  if (
    value === null ||
    value === undefined ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack
    };
  }

  if (depth >= 3) {
    return "[truncated]";
  }

  if (Array.isArray(value)) {
    return value.map((item) => serializeTelemetryValue(item, depth + 1));
  }

  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        serializeTelemetryValue(item, depth + 1)
      ])
    );
  }

  return String(value);
}

function normalizeContext(
  value: ClientTelemetryContext | undefined
): ClientTelemetryContext | undefined {
  if (!value) {
    return undefined;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      serializeTelemetryValue(item)
    ])
  );
}

function normalizeError(error: unknown) {
  if (error instanceof Error) {
    return {
      message: error.message,
      errorName: error.name,
      stack: error.stack
    };
  }

  if (typeof error === "string") {
    return {
      message: error
    };
  }

  return {
    message: "Unknown client error",
    context: serializeTelemetryValue(error)
  };
}

async function dispatchTelemetry(
  endpoint: string,
  payload: ClientTelemetryEvent
) {
  const globalTarget = globalThis as GlobalWithTelemetryTransport;
  const body = JSON.stringify(payload);

  if (typeof globalTarget.navigator?.sendBeacon === "function") {
    try {
      const delivered = globalTarget.navigator.sendBeacon(endpoint, body);

      if (delivered) {
        return;
      }
    } catch {
      // Fall through to fetch transport.
    }
  }

  if (typeof globalTarget.fetch === "function") {
    try {
      await globalTarget.fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body,
        keepalive: true
      });
    } catch {
      // Telemetry must never interrupt product flows.
    }
  }
}

export function createClientTelemetry(config: ClientTelemetryConfig) {
  const endpoint = trimToNull(config.endpoint);
  const environment = trimToNull(config.environment) ?? "development";
  const release = trimToNull(config.release);
  const defaultTags = normalizeTags(config.defaultTags);
  const sessionId = createSessionId();

  function capture(
    kind: ClientTelemetryKind,
    message: string,
    {
      level = "error",
      tags,
      context
    }: CaptureTelemetryOptions = {},
    error?: unknown
  ) {
    if (!endpoint) {
      return false;
    }

    const normalizedError = error ? normalizeError(error) : null;
    const payload: ClientTelemetryEvent = {
      app: config.app,
      environment,
      release,
      sessionId,
      timestamp: new Date().toISOString(),
      kind,
      level,
      message,
      errorName: normalizedError?.errorName,
      stack: normalizedError?.stack,
      tags: normalizeTags({
        ...defaultTags,
        ...tags
      }),
      context: normalizeContext({
        ...(normalizedError?.context
          ? { normalizedError: normalizedError.context }
          : {}),
        ...context
      })
    };

    void dispatchTelemetry(endpoint, payload);
    return true;
  }

  return {
    isEnabled: endpoint !== null,
    captureMessage(message: string, options?: CaptureTelemetryOptions) {
      return capture(options?.kind ?? "message", message, {
        level: options?.level ?? "info",
        tags: options?.tags,
        context: options?.context
      });
    },
    captureException(
      error: unknown,
      options: CaptureTelemetryOptions & {
        readonly message?: string;
      } = {}
    ) {
      const normalizedError = normalizeError(error);
      return capture(
        options.kind ?? "exception",
        options.message ?? normalizedError.message,
        {
          level: options.level ?? "error",
          tags: options.tags,
          context: options.context
        },
        error
      );
    }
  };
}

export function installGlobalTelemetryHandlers(
  telemetry: ReturnType<typeof createClientTelemetry>,
  options: {
    readonly source: string;
    readonly resolveContext?: () => ClientTelemetryContext | undefined;
  }
) {
  const globalTarget = globalThis as GlobalWithTelemetryTransport;

  if (
    typeof globalTarget.addEventListener !== "function" ||
    typeof globalTarget.removeEventListener !== "function"
  ) {
    return () => undefined;
  }

  const buildContext = () => ({
    source: options.source,
    ...options.resolveContext?.()
  });

  const errorListener = (event: unknown) => {
    const runtimeEvent =
      event && typeof event === "object"
        ? (event as {
            readonly error?: unknown;
            readonly message?: string;
            readonly filename?: string;
            readonly lineno?: number;
            readonly colno?: number;
          })
        : undefined;

    telemetry.captureException(runtimeEvent?.error ?? runtimeEvent?.message, {
      kind: "exception",
      message:
        typeof runtimeEvent?.message === "string"
          ? runtimeEvent.message
          : "Unhandled runtime error",
      context: {
        ...buildContext(),
        fileName: runtimeEvent?.filename,
        line: runtimeEvent?.lineno,
        column: runtimeEvent?.colno
      }
    });
  };

  const rejectionListener = (event: unknown) => {
    const rejectionEvent =
      event && typeof event === "object"
        ? (event as {
            readonly reason?: unknown;
          })
        : undefined;

    telemetry.captureException(rejectionEvent?.reason, {
      kind: "unhandled_rejection",
      message: "Unhandled promise rejection",
      context: buildContext()
    });
  };

  globalTarget.addEventListener("error", errorListener);
  globalTarget.addEventListener("unhandledrejection", rejectionListener);

  return () => {
    globalTarget.removeEventListener?.("error", errorListener);
    globalTarget.removeEventListener?.(
      "unhandledrejection",
      rejectionListener
    );
  };
}
