import axios from "axios";
import { loadWebRuntimeConfig } from "@stealth-trails-bank/config/web";
import { useUserStore } from "@/stores/userStore";
import { readApiErrorMessage, type ApiResponse } from "@/lib/api";

const webRuntimeConfig = loadWebRuntimeConfig(
  import.meta.env as Record<string, string | boolean | undefined>
);

export type SolvencyReportSummary = {
  id: string;
  snapshotId: string;
  environment: string;
  chainId: number;
  reportVersion: number;
  reportHash: string;
  reportChecksumSha256: string;
  canonicalPayload: Record<string, unknown> | null;
  canonicalPayloadText: string;
  signature: string;
  signatureAlgorithm: string;
  signerAddress: string;
  publishedAt: string;
};

export type SolvencyWorkspaceSummarySnapshot = {
  id: string;
  environment: string;
  status: string;
  evidenceFreshness: string;
  generatedAt: string;
  completedAt: string | null;
  totalLiabilityAmount: string;
  totalObservedReserveAmount: string;
  totalUsableReserveAmount: string;
  totalEncumberedReserveAmount: string;
  totalReserveDeltaAmount: string;
  assetCount: number;
  issueCount: number;
  policyActionsTriggered: boolean;
  failureCode: string | null;
  failureMessage: string | null;
  report: SolvencyReportSummary | null;
};

export type PublicSolvencyReportEntry = {
  report: SolvencyReportSummary;
  snapshot: SolvencyWorkspaceSummarySnapshot;
};

export type PublicSolvencyReportListResult = {
  generatedAt: string;
  limit: number;
  reports: PublicSolvencyReportEntry[];
};

export type CustomerLiabilityProofResult = {
  report: SolvencyReportSummary;
  snapshot: SolvencyWorkspaceSummarySnapshot;
  customerAccountId: string;
  proofs: Array<{
    asset: {
      id: string;
      symbol: string;
      displayName: string;
      decimals: number;
      chainId: number;
      assetType: string;
    };
    leafIndex: number;
    leafHash: string;
    rootHash: string;
    proof: string[];
    payload: {
      version: number;
      snapshotId: string;
      assetId: string;
      assetSymbol: string;
      customerAccountId: string;
      leafIndex: number;
      availableLiabilityAmount: string;
      reservedLiabilityAmount: string;
      vaultLiabilityAmount: string;
      pendingVaultReleaseAmount: string;
      pendingCreditAmount: string;
      totalLiabilityAmount: string;
    };
  }>;
};

export type PublicSolvencyProofBundle = {
  bundleVersion: number;
  bundleType: "public_solvency_report";
  generatedAt: string;
  artifactName: string;
  bundleChecksumSha256: string;
  verification: {
    reportHashAlgorithm: string;
    reportChecksumAlgorithm: string;
    signatureAlgorithm: string;
    instructions: string[];
  };
  report: SolvencyReportSummary;
  snapshot: SolvencyWorkspaceSummarySnapshot;
  signedPayload: {
    canonicalPayload: Record<string, unknown> | null;
    canonicalPayloadText: string;
    reportHash: string;
    reportChecksumSha256: string;
    signature: string;
    signerAddress: string;
    signatureAlgorithm: string;
  };
  assetRoots: Array<{
    assetId: string;
    symbol: string;
    displayName: string;
    chainId: number;
    liabilityMerkleRoot: string | null;
    liabilityLeafCount: number;
    liabilitySetChecksumSha256: string | null;
    totalLiabilityAmount: string;
    usableReserveAmount: string;
    reserveDeltaAmount: string;
  }>;
};

export type CustomerSolvencyProofBundle = Omit<
  PublicSolvencyProofBundle,
  "bundleType"
> & {
  bundleType: "customer_liability_proof";
  customerAccountId: string;
  customerProofs: CustomerLiabilityProofResult["proofs"];
};

export async function listPublicSolvencyReports(
  limit = 10
): Promise<PublicSolvencyReportListResult> {
  const response = await axios.get<ApiResponse<PublicSolvencyReportListResult>>(
    `${webRuntimeConfig.serverUrl}/solvency/public/reports`,
    {
      params: {
        limit
      }
    }
  );

  if (response.data.status !== "success" || !response.data.data) {
    throw new Error(
      response.data.message || "Failed to load public solvency reports."
    );
  }

  return response.data.data;
}

export async function getLatestCustomerLiabilityProof(
  snapshotId?: string
): Promise<CustomerLiabilityProofResult> {
  const token = useUserStore.getState().token;

  if (!token) {
    throw new Error("Auth token is required.");
  }

  try {
    const response = await axios.get<ApiResponse<CustomerLiabilityProofResult>>(
      `${webRuntimeConfig.serverUrl}/solvency/me/liability-proof`,
      {
        headers: {
          Authorization: `Bearer ${token}`
        },
        params: snapshotId
          ? {
              snapshotId
            }
          : undefined
      }
    );

    if (response.data.status !== "success" || !response.data.data) {
      throw new Error(
        response.data.message || "Failed to load customer liability proof."
      );
    }

    return response.data.data;
  } catch (error) {
    throw new Error(
      readApiErrorMessage(error, "Failed to load customer liability proof.")
    );
  }
}

export async function getPublicSolvencyProofBundle(
  snapshotId?: string
): Promise<PublicSolvencyProofBundle> {
  const endpoint = snapshotId
    ? `/solvency/public/reports/${snapshotId}/bundle`
    : "/solvency/public/reports/latest/bundle";
  const response = await axios.get<ApiResponse<PublicSolvencyProofBundle>>(
    `${webRuntimeConfig.serverUrl}${endpoint}`
  );

  if (response.data.status !== "success" || !response.data.data) {
    throw new Error(
      response.data.message || "Failed to load public solvency proof bundle."
    );
  }

  return response.data.data;
}

export async function getCustomerSolvencyProofBundle(
  snapshotId?: string
): Promise<CustomerSolvencyProofBundle> {
  const token = useUserStore.getState().token;

  if (!token) {
    throw new Error("Auth token is required.");
  }

  try {
    const response = await axios.get<ApiResponse<CustomerSolvencyProofBundle>>(
      `${webRuntimeConfig.serverUrl}/solvency/me/liability-proof/bundle`,
      {
        headers: {
          Authorization: `Bearer ${token}`
        },
        params: snapshotId
          ? {
              snapshotId
            }
          : undefined
      }
    );

    if (response.data.status !== "success" || !response.data.data) {
      throw new Error(
        response.data.message || "Failed to load customer solvency proof bundle."
      );
    }

    return response.data.data;
  } catch (error) {
    throw new Error(
      readApiErrorMessage(error, "Failed to load customer solvency proof bundle.")
    );
  }
}
