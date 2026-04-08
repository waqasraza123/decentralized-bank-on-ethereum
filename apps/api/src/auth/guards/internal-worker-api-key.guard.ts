import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException
} from "@nestjs/common";
import { loadInternalWorkerRuntimeConfig } from "@stealth-trails-bank/config/api";
import { matchesApiKey, readHeaderValue } from "@stealth-trails-bank/security/node";

type InternalWorkerRequest = {
  headers: Record<string, string | string[] | undefined>;
  internalWorker?: {
    workerId: string;
  };
};

@Injectable()
export class InternalWorkerApiKeyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<InternalWorkerRequest>();
    const providedApiKey = readHeaderValue(request.headers, "x-worker-api-key");
    const workerId = readHeaderValue(request.headers, "x-worker-id");

    if (!providedApiKey) {
      throw new UnauthorizedException("Missing worker API key.");
    }

    if (!workerId) {
      throw new UnauthorizedException("Missing worker id.");
    }

    const { internalWorkerApiKey } = loadInternalWorkerRuntimeConfig();

    if (!matchesApiKey(providedApiKey, internalWorkerApiKey)) {
      throw new UnauthorizedException("Invalid worker API key.");
    }

    request.internalWorker = {
      workerId
    };

    return true;
  }
}
