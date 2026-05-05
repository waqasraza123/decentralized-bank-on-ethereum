import { randomUUID } from "node:crypto";

export const REQUEST_ID_HEADER = "x-request-id";
const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{8,128}$/;

export type ApiResponseLike = {
  setHeader(name: string, value: string): void;
};

export type ApiNextFunction = () => void;

export type ApiRequestContext = {
  headers: Record<string, string | string[] | undefined>;
  method?: string;
  originalUrl?: string;
  url?: string;
  route?: {
    path?: string;
  };
  ip?: string;
  requestId?: string;
  user?: {
    id: string;
    email?: string;
  };
  internalOperator?: {
    operatorId: string;
    operatorRole?: string | null;
    operatorDbId?: string | null;
    operatorRoles?: string[];
    operatorSupabaseUserId?: string | null;
    operatorEmail?: string | null;
    authSource?: "operator_jwt" | "supabase_jwt" | "legacy_api_key";
    environment?: string | null;
    sessionCorrelationId?: string | null;
  };
  internalWorker?: {
    workerId: string;
  };
};

export function normalizeHeaderValue(
  value: string | string[] | undefined
): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }

  if (Array.isArray(value) && value.length > 0) {
    return normalizeHeaderValue(value[0]);
  }

  return null;
}

export function resolveRequestId(
  value: string | string[] | undefined
): string {
  const normalized = normalizeHeaderValue(value);

  if (normalized && REQUEST_ID_PATTERN.test(normalized)) {
    return normalized;
  }

  return randomUUID();
}

export function assignRequestContext(
  request: ApiRequestContext,
  response: ApiResponseLike,
  next: ApiNextFunction
): void {
  const requestId = resolveRequestId(request.headers[REQUEST_ID_HEADER]);

  request.requestId = requestId;
  response.setHeader(REQUEST_ID_HEADER, requestId);
  next();
}

export function resolveRequestActor(request: ApiRequestContext): {
  actorType: "customer" | "operator" | "worker" | "anonymous";
  actorId: string | null;
  actorRole: string | null;
  authSource?: string | null;
  environment?: string | null;
  sessionCorrelationId?: string | null;
} {
  if (request.internalOperator?.operatorId) {
    return {
      actorType: "operator",
      actorId: request.internalOperator.operatorId,
      actorRole: request.internalOperator.operatorRole ?? null,
      authSource: request.internalOperator.authSource ?? null,
      environment: request.internalOperator.environment ?? null,
      sessionCorrelationId: request.internalOperator.sessionCorrelationId ?? null
    };
  }

  if (request.internalWorker?.workerId) {
    return {
      actorType: "worker",
      actorId: request.internalWorker.workerId,
      actorRole: null,
      authSource: null,
      environment: null,
      sessionCorrelationId: null
    };
  }

  if (request.user?.id) {
    return {
      actorType: "customer",
      actorId: request.user.id,
      actorRole: null,
      authSource: null,
      environment: null,
      sessionCorrelationId: null
    };
  }

  return {
    actorType: "anonymous",
    actorId: null,
    actorRole: null,
    authSource: null,
    environment: null,
    sessionCorrelationId: null
  };
}
