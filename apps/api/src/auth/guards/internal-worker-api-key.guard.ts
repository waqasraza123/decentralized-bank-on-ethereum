import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException
} from "@nestjs/common";
import { timingSafeEqual } from "node:crypto";
import { loadInternalWorkerRuntimeConfig } from "@stealth-trails-bank/config/api";

type InternalWorkerRequest = {
  headers: Record<string, string | string[] | undefined>;
  internalWorker?: {
    workerId: string;
  };
};

@Injectable()
export class InternalWorkerApiKeyGuard implements CanActivate {
  private readHeaderValue(
    request: InternalWorkerRequest,
    headerName: string
  ): string | null {
    const normalizedHeaderName = headerName.toLowerCase();
    const headerValue =
      request.headers[normalizedHeaderName] ?? request.headers[headerName];

    if (typeof headerValue === "string") {
      const normalizedHeaderValue = headerValue.trim();
      return normalizedHeaderValue ? normalizedHeaderValue : null;
    }

    if (Array.isArray(headerValue) && headerValue.length > 0) {
      const firstHeaderValue = headerValue[0]?.trim() ?? "";
      return firstHeaderValue ? firstHeaderValue : null;
    }

    return null;
  }

  private matchesApiKey(
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

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<InternalWorkerRequest>();
    const providedApiKey = this.readHeaderValue(request, "x-worker-api-key");
    const workerId = this.readHeaderValue(request, "x-worker-id");

    if (!providedApiKey) {
      throw new UnauthorizedException("Missing worker API key.");
    }

    if (!workerId) {
      throw new UnauthorizedException("Missing worker id.");
    }

    const { internalWorkerApiKey } = loadInternalWorkerRuntimeConfig();

    if (!this.matchesApiKey(providedApiKey, internalWorkerApiKey)) {
      throw new UnauthorizedException("Invalid worker API key.");
    }

    request.internalWorker = {
      workerId
    };

    return true;
  }
}
