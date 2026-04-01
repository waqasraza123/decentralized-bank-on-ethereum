import { UnauthorizedException } from "@nestjs/common";
import { InternalWorkerApiKeyGuard } from "./internal-worker-api-key.guard";

jest.mock("@stealth-trails-bank/config/api", () => ({
  loadInternalWorkerRuntimeConfig: () => ({
    internalWorkerApiKey: "test-worker-key"
  })
}));

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

describe("InternalWorkerApiKeyGuard", () => {
  it("accepts a valid worker api key and worker id", () => {
    const guard = new InternalWorkerApiKeyGuard();
    const { context, request } = createExecutionContext({
      "x-worker-api-key": "test-worker-key",
      "x-worker-id": "worker_1"
    });

    expect(guard.canActivate(context as never)).toBe(true);
    expect(request).toEqual({
      headers: {
        "x-worker-api-key": "test-worker-key",
        "x-worker-id": "worker_1"
      },
      internalWorker: {
        workerId: "worker_1"
      }
    });
  });

  it("rejects a missing worker api key", () => {
    const guard = new InternalWorkerApiKeyGuard();
    const { context } = createExecutionContext({
      "x-worker-id": "worker_1"
    });

    expect(() => guard.canActivate(context as never)).toThrow(
      UnauthorizedException
    );
  });

  it("rejects an invalid worker api key", () => {
    const guard = new InternalWorkerApiKeyGuard();
    const { context } = createExecutionContext({
      "x-worker-api-key": "wrong-key",
      "x-worker-id": "worker_1"
    });

    expect(() => guard.canActivate(context as never)).toThrow(
      UnauthorizedException
    );
  });

  it("rejects a missing worker id", () => {
    const guard = new InternalWorkerApiKeyGuard();
    const { context } = createExecutionContext({
      "x-worker-api-key": "test-worker-key"
    });

    expect(() => guard.canActivate(context as never)).toThrow(
      UnauthorizedException
    );
  });
});
