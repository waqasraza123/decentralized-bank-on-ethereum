import { UnauthorizedException } from "@nestjs/common";
import { InternalOperatorApiKeyGuard } from "./internal-operator-api-key.guard";

function createExecutionContext(headers: Record<string, string | undefined>) {
  const request = {
    headers
  };

  const context = {
    switchToHttp: () => ({
      getRequest: () => request
    })
  };

  return {
    context,
    request
  };
}

describe("InternalOperatorApiKeyGuard", () => {
  it("accepts a resolved bearer-backed operator identity", async () => {
    const guard = new InternalOperatorApiKeyGuard({
      resolveFromBearerToken: async () => ({
        operatorDbId: "operator_db_1",
        operatorId: "ops_1",
        operatorRole: "operations_admin",
        operatorRoles: ["operations_admin", "risk_manager"],
        operatorSupabaseUserId: "supabase-operator-1",
        operatorEmail: "ops@example.com",
        authSource: "supabase_jwt",
        environment: "development",
        sessionCorrelationId: "session_1"
      }),
      resolveFromLegacyApiKey: () => null
    } as never);
    const { context, request } = createExecutionContext({
      authorization: "Bearer test-token"
    });

    await expect(guard.canActivate(context as never)).resolves.toBe(true);
    expect(request).toEqual({
      headers: {
        authorization: "Bearer test-token"
      },
      internalOperator: {
        operatorDbId: "operator_db_1",
        operatorEmail: "ops@example.com",
        operatorId: "ops_1",
        operatorRole: "operations_admin",
        operatorRoles: ["operations_admin", "risk_manager"],
        operatorSupabaseUserId: "supabase-operator-1",
        authSource: "supabase_jwt",
        environment: "development",
        sessionCorrelationId: "session_1"
      }
    });
  });

  it("falls back to a legacy operator api key identity when enabled", async () => {
    const guard = new InternalOperatorApiKeyGuard({
      resolveFromBearerToken: async () => null,
      resolveFromLegacyApiKey: () => ({
        operatorDbId: null,
        operatorId: "ops_legacy",
        operatorRole: "risk_manager",
        operatorRoles: ["risk_manager"],
        operatorSupabaseUserId: null,
        operatorEmail: null,
        authSource: "legacy_api_key",
        environment: "development",
        sessionCorrelationId: null
      })
    } as never);
    const { context } = createExecutionContext({
      "x-operator-api-key": "test-operator-key",
      "x-operator-id": "ops_legacy",
      "x-operator-role": "risk_manager"
    });

    await expect(guard.canActivate(context as never)).resolves.toBe(true);
  });

  it("rejects requests with no resolved operator identity", async () => {
    const guard = new InternalOperatorApiKeyGuard({
      resolveFromBearerToken: async () => null,
      resolveFromLegacyApiKey: () => null
    } as never);
    const { context } = createExecutionContext({});

    await expect(guard.canActivate(context as never)).rejects.toThrow(
      UnauthorizedException
    );
  });
});
