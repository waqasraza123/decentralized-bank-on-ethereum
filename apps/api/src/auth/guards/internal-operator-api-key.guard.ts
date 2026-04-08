import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException
} from "@nestjs/common";
import { loadInternalOperatorRuntimeConfig } from "@stealth-trails-bank/config/api";
import { matchesApiKey, readHeaderValue } from "@stealth-trails-bank/security/node";

type InternalOperatorRequest = {
  headers: Record<string, string | string[] | undefined>;
  internalOperator?: {
    operatorId: string;
    operatorRole?: string;
  };
};

@Injectable()
export class InternalOperatorApiKeyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<InternalOperatorRequest>();
    const providedApiKey = readHeaderValue(request.headers, "x-operator-api-key");
    const operatorId = readHeaderValue(request.headers, "x-operator-id");
    const operatorRole = readHeaderValue(request.headers, "x-operator-role");

    if (!providedApiKey) {
      throw new UnauthorizedException("Missing operator API key.");
    }

    if (!operatorId) {
      throw new UnauthorizedException("Missing operator id.");
    }

    const { internalOperatorApiKey } = loadInternalOperatorRuntimeConfig();

    if (!matchesApiKey(providedApiKey, internalOperatorApiKey)) {
      throw new UnauthorizedException("Invalid operator API key.");
    }

    request.internalOperator = operatorRole
      ? {
          operatorId,
          operatorRole: operatorRole.toLowerCase()
        }
      : {
          operatorId
        };

    return true;
  }
}
