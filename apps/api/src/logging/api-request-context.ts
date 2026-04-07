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
    operatorRole?: string;
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
} {
  if (request.internalOperator?.operatorId) {
    return {
      actorType: "operator",
      actorId: request.internalOperator.operatorId,
      actorRole: request.internalOperator.operatorRole ?? null
    };
  }

  if (request.internalWorker?.workerId) {
    return {
      actorType: "worker",
      actorId: request.internalWorker.workerId,
      actorRole: null
    };
  }

  if (request.user?.id) {
    return {
      actorType: "customer",
      actorId: request.user.id,
      actorRole: null
    };
  }

  return {
    actorType: "anonymous",
    actorId: null,
    actorRole: null
  };
}
