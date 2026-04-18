import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException
} from "@nestjs/common";
import { loadInternalGovernedExecutorRuntimeConfig } from "@stealth-trails-bank/config/api";
import { matchesApiKey, readHeaderValue } from "@stealth-trails-bank/security/node";

type InternalGovernedExecutorRequest = {
  headers: Record<string, string | string[] | undefined>;
  internalGovernedExecutor?: {
    executorId: string;
  };
};

@Injectable()
export class InternalGovernedExecutorApiKeyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request =
      context.switchToHttp().getRequest<InternalGovernedExecutorRequest>();
    const providedApiKey = readHeaderValue(
      request.headers,
      "x-governed-executor-api-key"
    );
    const executorId = readHeaderValue(
      request.headers,
      "x-governed-executor-id"
    );

    if (!providedApiKey) {
      throw new UnauthorizedException("Missing governed executor API key.");
    }

    if (!executorId) {
      throw new UnauthorizedException("Missing governed executor id.");
    }

    const { internalGovernedExecutorApiKey } =
      loadInternalGovernedExecutorRuntimeConfig();

    if (!matchesApiKey(providedApiKey, internalGovernedExecutorApiKey)) {
      throw new UnauthorizedException("Invalid governed executor API key.");
    }

    request.internalGovernedExecutor = {
      executorId
    };

    return true;
  }
}
