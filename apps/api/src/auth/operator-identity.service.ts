import {
  ForbiddenException,
  Injectable,
  Optional,
  UnauthorizedException
} from "@nestjs/common";
import { Prisma, ReleaseReadinessEnvironment } from "@prisma/client";
import { randomUUID } from "node:crypto";
import {
  loadInternalOperatorRuntimeConfig,
  loadOperatorAuthRuntimeConfig
} from "@stealth-trails-bank/config/api";
import { matchesApiKey, readHeaderValue } from "@stealth-trails-bank/security/node";
import * as jwt from "jsonwebtoken";
import { PrismaService } from "../prisma/prisma.service";
import { normalizeOperatorRole } from "./internal-operator-role-policy";

type OperatorAuthHeaders = Record<string, string | string[] | undefined>;

export type OperatorIdentityResolutionInput = {
  headers: OperatorAuthHeaders;
  requestId?: string | null;
  requestPath?: string | null;
  userAgent?: string | null;
  origin?: string | null;
  remoteAddress?: string | null;
};

export type ResolvedOperatorIdentity = {
  operatorDbId: string | null;
  operatorId: string;
  operatorRole: string | null;
  operatorRoles: string[];
  operatorSupabaseUserId: string | null;
  operatorEmail: string | null;
  authSource: "operator_jwt" | "supabase_jwt" | "legacy_api_key";
  environment: ReleaseReadinessEnvironment;
  sessionCorrelationId: string | null;
};

type VerifiedOperatorToken = {
  sub: string;
  email: string | null;
  aal: string | null;
  sessionId: string | null;
  authSource: "operator_jwt" | "supabase_jwt";
};

type OperatorRecord = Prisma.OperatorGetPayload<{
  include: {
    roleAssignments: true;
    environmentAccess: true;
  };
}>;

@Injectable()
export class OperatorIdentityService {
  constructor(@Optional() private readonly prismaService?: PrismaService) {}

  private getOperatorRuntimeEnvironment(): ReleaseReadinessEnvironment {
    const { operatorRuntimeEnvironment } = loadOperatorAuthRuntimeConfig();

    switch (operatorRuntimeEnvironment) {
      case "staging":
        return ReleaseReadinessEnvironment.staging;
      case "production_like":
        return ReleaseReadinessEnvironment.production_like;
      case "production":
        return ReleaseReadinessEnvironment.production;
      default:
        return ReleaseReadinessEnvironment.development;
    }
  }

  private readBearerToken(headers: OperatorAuthHeaders): string | null {
    const authorizationHeader =
      readHeaderValue(headers, "authorization") ??
      readHeaderValue(headers, "Authorization");

    if (!authorizationHeader) {
      return null;
    }

    const [scheme, token] = authorizationHeader.split(/\s+/, 2);

    if (scheme?.toLowerCase() !== "bearer" || !token?.trim()) {
      throw new UnauthorizedException("Authorization header must use Bearer auth.");
    }

    return token.trim();
  }

  private verifyAppOperatorToken(token: string): VerifiedOperatorToken | null {
    try {
      const { operatorJwtSecret } = loadOperatorAuthRuntimeConfig();
      const payload = jwt.verify(token, operatorJwtSecret);

      if (!payload || typeof payload === "string") {
        return null;
      }

      if (payload["stb_token_type"] !== "operator") {
        return null;
      }

      const sub = payload["sub"];
      const email = payload["email"];
      const aal = payload["aal"];
      const sessionId =
        typeof payload["session_id"] === "string"
          ? payload["session_id"]
          : typeof payload["sessionId"] === "string"
            ? payload["sessionId"]
            : null;

      if (typeof sub !== "string" || sub.trim().length === 0) {
        return null;
      }

      return {
        sub: sub.trim(),
        email:
          typeof email === "string" && email.trim().length > 0
            ? email.trim().toLowerCase()
            : null,
        aal: typeof aal === "string" && aal.trim().length > 0 ? aal.trim() : null,
        sessionId,
        authSource: "operator_jwt"
      };
    } catch {
      return null;
    }
  }

  private verifySupabaseOperatorToken(token: string): VerifiedOperatorToken | null {
    try {
      const { supabaseJwtSecret } = loadOperatorAuthRuntimeConfig();

      if (!supabaseJwtSecret) {
        return null;
      }

      const payload = jwt.verify(token, supabaseJwtSecret);

      if (!payload || typeof payload === "string") {
        return null;
      }

      const sub = payload["sub"];
      const email = payload["email"];
      const aal = payload["aal"];
      const sessionId =
        typeof payload["session_id"] === "string"
          ? payload["session_id"]
          : typeof payload["sessionId"] === "string"
            ? payload["sessionId"]
            : null;

      if (typeof sub !== "string" || sub.trim().length === 0) {
        return null;
      }

      return {
        sub: sub.trim(),
        email:
          typeof email === "string" && email.trim().length > 0
            ? email.trim().toLowerCase()
            : null,
        aal: typeof aal === "string" && aal.trim().length > 0 ? aal.trim() : null,
        sessionId,
        authSource: "supabase_jwt"
      };
    } catch {
      return null;
    }
  }

  private verifyOperatorBearerToken(token: string): VerifiedOperatorToken {
    const verifiedToken =
      this.verifyAppOperatorToken(token) ?? this.verifySupabaseOperatorToken(token);

    if (!verifiedToken) {
      throw new UnauthorizedException("Invalid or expired operator bearer token.");
    }

    return verifiedToken;
  }

  private async findOperatorRecord(
    token: VerifiedOperatorToken
  ): Promise<OperatorRecord | null> {
    if (!this.prismaService) {
      throw new UnauthorizedException(
        "Operator identity service is not configured with Prisma."
      );
    }

    return this.prismaService.operator.findFirst({
      where: {
        status: "active",
        OR: [
          {
            operatorId: token.sub
          },
          {
            supabaseUserId: token.sub
          },
          ...(token.email
            ? [
                {
                  email: token.email
                }
              ]
            : [])
        ]
      },
      include: {
        roleAssignments: {
          where: {
            status: "active",
            revokedAt: null
          },
          orderBy: [{ isPrimary: "desc" }, { grantedAt: "asc" }]
        },
        environmentAccess: {
          where: {
            status: "active",
            revokedAt: null
          },
          orderBy: { grantedAt: "asc" }
        }
      }
    });
  }

  private assertOperatorEnvironmentAccess(
    operator: OperatorRecord
  ): ReleaseReadinessEnvironment {
    const environment = this.getOperatorRuntimeEnvironment();

    if (
      !operator.environmentAccess.some((entry) => entry.environment === environment)
    ) {
      throw new ForbiddenException(
        `Operator ${operator.operatorId} is not allowlisted for ${environment}.`
      );
    }

    return environment;
  }

  private resolveAssignedRoles(operator: OperatorRecord): string[] {
    return operator.roleAssignments
      .map((assignment: OperatorRecord["roleAssignments"][number]) =>
        normalizeOperatorRole(assignment.role)
      )
      .filter((role: string | null): role is string => Boolean(role));
  }

  private async writeOperatorSessionAudit(
    operator: OperatorRecord,
    identity: ResolvedOperatorIdentity,
    token: VerifiedOperatorToken | null,
    input: OperatorIdentityResolutionInput
  ): Promise<void> {
    if (!this.prismaService) {
      return;
    }

    await this.prismaService.operatorSessionAudit.create({
      data: {
        operatorId: operator.id,
        authSource: identity.authSource,
        environment: identity.environment,
        requestPath: input.requestPath ?? null,
        requestId: input.requestId ?? null,
        sessionCorrelationId: identity.sessionCorrelationId,
        userAgent: input.userAgent ?? null,
        origin: input.origin ?? null,
        remoteAddress: input.remoteAddress ?? null,
        tokenAal: token?.aal ?? null,
        roleSnapshot: [...identity.operatorRoles]
      }
    });
  }

  async resolveFromBearerToken(
    input: OperatorIdentityResolutionInput
  ): Promise<ResolvedOperatorIdentity | null> {
    const bearerToken = this.readBearerToken(input.headers);

    if (!bearerToken) {
      return null;
    }

    const verifiedToken = this.verifyOperatorBearerToken(bearerToken);
    const operator = await this.findOperatorRecord(verifiedToken);

    if (!operator) {
      throw new UnauthorizedException(
        "Bearer token is valid, but no active operator record matches it."
      );
    }

    const environment = this.assertOperatorEnvironmentAccess(operator);
    const roles = this.resolveAssignedRoles(operator);
    const primaryRole =
      roles[0] ??
      normalizeOperatorRole(operator.roleAssignments[0]?.role) ??
      null;

    if (!primaryRole) {
      throw new ForbiddenException(
        `Operator ${operator.operatorId} does not have an active assigned role.`
      );
    }

    const { requiredMfaEnvironments } = loadOperatorAuthRuntimeConfig();
    const mfaRequiredForEnvironment = requiredMfaEnvironments.includes(
      environment as unknown as "development" | "staging" | "production_like" | "production"
    );

    if (
      operator.mfaRequired &&
      mfaRequiredForEnvironment &&
      verifiedToken.aal?.toLowerCase() !== "aal2"
    ) {
      throw new ForbiddenException(
        `Operator ${operator.operatorId} must complete MFA for ${environment}.`
      );
    }

    const identity: ResolvedOperatorIdentity = {
      operatorDbId: operator.id,
      operatorId: operator.operatorId,
      operatorRole: primaryRole,
      operatorRoles: roles.length > 0 ? roles : [primaryRole],
      operatorSupabaseUserId: operator.supabaseUserId ?? null,
      operatorEmail: operator.email,
      authSource: verifiedToken.authSource,
      environment,
      sessionCorrelationId: verifiedToken.sessionId
    };

    await this.writeOperatorSessionAudit(
      operator,
      identity,
      verifiedToken,
      input
    );

    return identity;
  }

  resolveFromLegacyApiKey(
    input: OperatorIdentityResolutionInput
  ): ResolvedOperatorIdentity | null {
    const { allowLegacyOperatorApiKeyAuth } = loadOperatorAuthRuntimeConfig();

    if (!allowLegacyOperatorApiKeyAuth) {
      return null;
    }

    const providedApiKey = readHeaderValue(input.headers, "x-operator-api-key");
    const operatorId = readHeaderValue(input.headers, "x-operator-id");
    const operatorRole = normalizeOperatorRole(
      readHeaderValue(input.headers, "x-operator-role")
    );

    if (!providedApiKey && !operatorId) {
      return null;
    }

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

    return {
      operatorDbId: null,
      operatorId,
      operatorRole,
      operatorRoles: operatorRole ? [operatorRole] : [],
      operatorSupabaseUserId: null,
      operatorEmail: null,
      authSource: "legacy_api_key",
      environment: this.getOperatorRuntimeEnvironment(),
      sessionCorrelationId: null
    };
  }

  async issueOperatorBearerToken(input: {
    operatorId?: string | null;
    email?: string | null;
    requestId?: string | null;
    requestPath?: string | null;
    userAgent?: string | null;
    origin?: string | null;
    remoteAddress?: string | null;
  }): Promise<{
    token: string;
    operator: {
      operatorId: string;
      email: string;
      role: string;
      roles: string[];
      environment: ReleaseReadinessEnvironment;
    };
  }> {
    if (!this.prismaService) {
      throw new UnauthorizedException(
        "Operator identity service is not configured with Prisma."
      );
    }

    const operatorId = input.operatorId?.trim() || null;
    const email = input.email?.trim().toLowerCase() || null;

    if (!operatorId && !email) {
      throw new UnauthorizedException("operatorId or email is required.");
    }

    const operator = await this.prismaService.operator.findFirst({
      where: {
        status: "active",
        OR: [
          ...(operatorId ? [{ operatorId }] : []),
          ...(email ? [{ email }] : [])
        ]
      },
      include: {
        roleAssignments: {
          where: {
            status: "active",
            revokedAt: null
          },
          orderBy: [{ isPrimary: "desc" }, { grantedAt: "asc" }]
        },
        environmentAccess: {
          where: {
            status: "active",
            revokedAt: null
          },
          orderBy: { grantedAt: "asc" }
        }
      }
    });

    if (!operator) {
      throw new UnauthorizedException("No active operator record matches the request.");
    }

    const environment = this.assertOperatorEnvironmentAccess(operator);
    const roles = this.resolveAssignedRoles(operator);
    const primaryRole =
      roles[0] ??
      normalizeOperatorRole(operator.roleAssignments[0]?.role) ??
      null;

    if (!primaryRole) {
      throw new ForbiddenException(
        `Operator ${operator.operatorId} does not have an active assigned role.`
      );
    }

    const { operatorJwtSecret } = loadOperatorAuthRuntimeConfig();
    const sessionCorrelationId = randomUUID();
    const token = jwt.sign(
      {
        stb_token_type: "operator",
        sub: operator.supabaseUserId ?? operator.operatorId,
        operator_id: operator.operatorId,
        email: operator.email,
        aal: operator.mfaRequired ? "aal2" : "aal1",
        session_id: sessionCorrelationId,
        roles,
        env: environment
      },
      operatorJwtSecret,
      {
        expiresIn: "8h"
      }
    );

    const identity: ResolvedOperatorIdentity = {
      operatorDbId: operator.id,
      operatorId: operator.operatorId,
      operatorRole: primaryRole,
      operatorRoles: roles.length > 0 ? roles : [primaryRole],
      operatorSupabaseUserId: operator.supabaseUserId ?? null,
      operatorEmail: operator.email,
      authSource: "operator_jwt",
      environment,
      sessionCorrelationId
    };

    await this.writeOperatorSessionAudit(
      operator,
      identity,
      {
        sub: operator.supabaseUserId ?? operator.operatorId,
        email: operator.email,
        aal: operator.mfaRequired ? "aal2" : "aal1",
        sessionId: sessionCorrelationId,
        authSource: "operator_jwt"
      },
      {
        headers: {},
        requestId: input.requestId,
        requestPath: input.requestPath,
        userAgent: input.userAgent,
        origin: input.origin,
        remoteAddress: input.remoteAddress
      }
    );

    return {
      token,
      operator: {
        operatorId: operator.operatorId,
        email: operator.email,
        role: primaryRole,
        roles: identity.operatorRoles,
        environment
      }
    };
  }
}
