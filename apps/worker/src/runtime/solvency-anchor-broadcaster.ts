import {
  createJsonRpcProvider,
  createSolvencyReportAnchorRegistryContract,
  hashSolvencyAnchorText
} from "@stealth-trails-bank/contracts-sdk";
import { ethers } from "ethers";
import type { WorkerRuntime } from "./worker-runtime";
import type {
  SolvencyReportAnchorBroadcaster,
  SolvencyReportAnchorBroadcastResult,
  SolvencyReportAnchorProjection
} from "./worker-types";

function readAnchorPayloadString(
  anchor: SolvencyReportAnchorProjection,
  key: "reportId" | "snapshotId"
): string {
  const payload = anchor.anchorPayload;

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error(`Solvency report anchor ${anchor.id} has invalid payload.`);
  }

  const value = (payload as Record<string, unknown>)[key];

  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(
      `Solvency report anchor ${anchor.id} payload is missing ${key}.`
    );
  }

  return value.trim();
}

function normalizeBytes32(value: string, label: string): string {
  if (!/^0x[a-fA-F0-9]{64}$/.test(value)) {
    throw new Error(`${label} must be a 32-byte hex value.`);
  }

  return value.toLowerCase();
}

function describeBroadcastError(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  if (typeof error === "string" && error.trim()) {
    return error;
  }

  return "Unknown solvency anchor broadcast error.";
}

export function createSolvencyReportAnchorBroadcaster(
  runtime: WorkerRuntime
): SolvencyReportAnchorBroadcaster | null {
  if (
    !runtime.solvencyAnchorContractAddress ||
    !runtime.solvencyAnchorSignerPrivateKey
  ) {
    return null;
  }

  if (runtime.executionMode !== "managed") {
    throw new Error(
      "Solvency report anchor broadcasting requires WORKER_EXECUTION_MODE=managed."
    );
  }

  if (!runtime.rpcUrl) {
    throw new Error("RPC_URL is required for solvency report anchor broadcasting.");
  }

  const contractAddress = runtime.solvencyAnchorContractAddress;
  const provider = createJsonRpcProvider(runtime.rpcUrl);
  const signer = new ethers.Wallet(
    runtime.solvencyAnchorSignerPrivateKey,
    provider
  );
  const contract = createSolvencyReportAnchorRegistryContract(
    contractAddress,
    signer
  );

  return {
    signerAddress: signer.address,
    contractAddress,
    async broadcast(
      anchor: SolvencyReportAnchorProjection
    ): Promise<SolvencyReportAnchorBroadcastResult> {
      const anchorPayloadHash = normalizeBytes32(
        anchor.anchorPayloadHash,
        "anchorPayloadHash"
      );
      const reportIdHash = hashSolvencyAnchorText(
        readAnchorPayloadString(anchor, "reportId")
      );
      const snapshotIdHash = hashSolvencyAnchorText(
        readAnchorPayloadString(anchor, "snapshotId")
      );

      try {
        const response = await contract.anchorSolvencyReport(
          anchorPayloadHash,
          reportIdHash,
          snapshotIdHash,
          anchor.chainId
        );

        return {
          txHash: response.hash,
          fromAddress: signer.address,
          toAddress: contractAddress
        };
      } catch (error) {
        throw new Error(describeBroadcastError(error));
      }
    }
  };
}
