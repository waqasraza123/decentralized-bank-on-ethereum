import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Optional,
  UnauthorizedException
} from "@nestjs/common";
import { OperatorIdentityService } from "../operator-identity.service";

type InternalOperatorRequest = {
  headers: Record<string, string | string[] | undefined>;
  requestId?: string;
  originalUrl?: string;
  url?: string;
  ip?: string;
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
};

@Injectable()
export class InternalOperatorApiKeyGuard implements CanActivate {
  constructor(
    @Optional()
    private readonly operatorIdentityService?: OperatorIdentityService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<InternalOperatorRequest>();

    const resolvedFromBearer =
      await this.operatorIdentityService?.resolveFromBearerToken?.({
        headers: request.headers,
        requestId: request.requestId ?? null,
        requestPath: request.originalUrl ?? request.url ?? null,
        userAgent:
          typeof request.headers["user-agent"] === "string"
            ? request.headers["user-agent"]
            : null,
        origin:
          typeof request.headers.origin === "string"
            ? request.headers.origin
            : null,
        remoteAddress: request.ip ?? null
      });

    const resolvedOperator =
      resolvedFromBearer ??
      this.operatorIdentityService?.resolveFromLegacyApiKey?.({
        headers: request.headers,
        requestId: request.requestId ?? null,
        requestPath: request.originalUrl ?? request.url ?? null,
        userAgent:
          typeof request.headers["user-agent"] === "string"
            ? request.headers["user-agent"]
            : null,
        origin:
          typeof request.headers.origin === "string"
            ? request.headers.origin
            : null,
        remoteAddress: request.ip ?? null
      });

    if (!resolvedOperator) {
      throw new UnauthorizedException(
        "Operator authentication requires a bearer token or an allowed legacy operator API key."
      );
    }

    request.internalOperator = {
      operatorId: resolvedOperator.operatorId,
      operatorRole: resolvedOperator.operatorRole,
      operatorDbId: resolvedOperator.operatorDbId,
      operatorRoles: [...resolvedOperator.operatorRoles],
      operatorSupabaseUserId: resolvedOperator.operatorSupabaseUserId,
      operatorEmail: resolvedOperator.operatorEmail,
      authSource: resolvedOperator.authSource,
      environment: resolvedOperator.environment,
      sessionCorrelationId: resolvedOperator.sessionCorrelationId
    };

    return true;
  }
}
