import axios, { type AxiosInstance } from "axios";
import { buildGovernedExecutionDispatchHeaders } from "@stealth-trails-bank/security";
import type { WorkerRuntime } from "./worker-runtime";
import type { GovernedExecutionRequestProjection } from "./worker-types";

type GovernedExecutorDispatchEnvelope = {
  accepted?: boolean;
  backendReference?: string | null;
  message?: string;
};

export class GovernedExecutorDispatchError extends Error {
  readonly httpStatus: number | null;
  readonly backendReference: string | null;

  constructor(args: {
    message: string;
    httpStatus?: number | null;
    backendReference?: string | null;
    cause?: unknown;
  }) {
    super(args.message, { cause: args.cause });
    this.name = "GovernedExecutorDispatchError";
    this.httpStatus = args.httpStatus ?? null;
    this.backendReference = args.backendReference ?? null;
  }
}

export type GovernedExecutorDispatchClient = ReturnType<
  typeof createGovernedExecutorDispatchClient
>;

export function createGovernedExecutorDispatchClient(runtime: WorkerRuntime) {
  if (
    !runtime.governedExecutorDispatchBaseUrl ||
    !runtime.governedExecutorDispatchApiKey
  ) {
    return null;
  }

  const httpClient: AxiosInstance = axios.create({
    baseURL: runtime.governedExecutorDispatchBaseUrl,
    timeout: runtime.governedExecutorDispatchTimeoutMs,
    headers: buildGovernedExecutionDispatchHeaders({
      apiKey: runtime.governedExecutorDispatchApiKey,
      workerId: runtime.workerId
    })
  });

  return {
    async deliverExecutionRequest(args: {
      request: GovernedExecutionRequestProjection;
      dispatchReference: string;
      dispatchNote?: string | null;
    }): Promise<{
      backendReference: string | null;
      httpStatus: number | null;
    }> {
      try {
        const response = await httpClient.post<GovernedExecutorDispatchEnvelope>(
          "/governed-execution/dispatches",
          {
            version: 1,
            requestId: args.request.id,
            environment: args.request.environment,
            chainId: args.request.chainId,
            executionType: args.request.executionType,
            targetType: args.request.targetType,
            targetId: args.request.targetId,
            dispatchReference: args.dispatchReference,
            dispatchNote: args.dispatchNote ?? null,
            contractAddress: args.request.contractAddress,
            contractMethod: args.request.contractMethod,
            walletAddress: args.request.walletAddress,
            executionPayload: args.request.executionPayload,
            canonicalExecutionPayloadText:
              args.request.canonicalExecutionPayloadText,
            executionPackageHash: args.request.executionPackageHash,
            executionPackageChecksumSha256:
              args.request.executionPackageChecksumSha256,
            executionPackageSignature: args.request.executionPackageSignature,
            executionPackageSignatureAlgorithm:
              args.request.executionPackageSignatureAlgorithm,
            executionPackageSignerAddress:
              args.request.executionPackageSignerAddress,
            expectedExecutionCalldataHash:
              args.request.expectedExecutionCalldataHash,
            expectedExecutionMethodSelector:
              args.request.expectedExecutionMethodSelector
          }
        );

        const accepted = response.data?.accepted ?? true;
        if (!accepted) {
          throw new GovernedExecutorDispatchError({
            message:
              response.data?.message ??
              "Governed executor backend rejected the dispatch package.",
            httpStatus: response.status,
            backendReference: response.data?.backendReference ?? null
          });
        }

        return {
          backendReference: response.data?.backendReference ?? null,
          httpStatus: response.status
        };
      } catch (error) {
        if (axios.isAxiosError(error)) {
          throw new GovernedExecutorDispatchError({
            message:
              error.response?.data?.message ??
              error.message ??
              "Governed executor dispatch failed.",
            httpStatus: error.response?.status ?? null,
            backendReference: error.response?.data?.backendReference ?? null,
            cause: error
          });
        }

        if (error instanceof GovernedExecutorDispatchError) {
          throw error;
        }

        throw new GovernedExecutorDispatchError({
          message: error instanceof Error ? error.message : "Governed executor dispatch failed.",
          cause: error
        });
      }
    }
  };
}
