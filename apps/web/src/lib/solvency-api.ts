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
  anchors?: SolvencyReportAnchorSummary[];
};

export type SolvencyReportAnchorSummary = {
  id: string;
  reportId: string;
  environment: string;
  chainId: number;
  status: string;
  anchorPayload: unknown;
  anchorPayloadText: string;
  anchorPayloadHash: string;
  anchorPayloadChecksumSha256: string;
  anchorNote: string | null;
  requestedByOperatorId: string;
  requestedByOperatorRole: string | null;
  requestedAt: string;
  submittedByOperatorId: string | null;
  submittedByOperatorRole: string | null;
  submittedAt: string | null;
  txHash: string | null;
  contractAddress: string | null;
  blockNumber: number | null;
  logIndex: number | null;
  confirmedByOperatorId: string | null;
  confirmedByOperatorRole: string | null;
  confirmedAt: string | null;
  failedByOperatorId: string | null;
  failedByOperatorRole: string | null;
  failureReason: string | null;
  failedAt: string | null;
  createdAt: string;
  updatedAt: string;
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

export type PublicReserveAttestationPackage = {
  packageVersion: number;
  packageType: "public_reserve_attestation";
  generatedAt: string;
  artifactName: string;
  packageChecksumSha256: string;
  verification: {
    attestationHashAlgorithm: string;
    attestationChecksumAlgorithm: string;
    signatureAlgorithm: string;
    instructions: string[];
  };
  report: SolvencyReportSummary;
  snapshot: SolvencyWorkspaceSummarySnapshot;
  signedAttestation: {
    canonicalPayload: Record<string, unknown>;
    canonicalPayloadText: string;
    attestationHash: string;
    attestationChecksumSha256: string;
    signature: string;
    signerAddress: string;
    signatureAlgorithm: string;
  };
  assetSummaries: Array<{
    assetId: string;
    symbol: string;
    displayName: string;
    chainId: number;
    evidenceFreshness: string;
    observedReserveAmount: string;
    usableReserveAmount: string;
    encumberedReserveAmount: string;
    excludedReserveAmount: string;
    reserveDeltaAmount: string;
    reserveRatioBps: number | null;
  }>;
  reserveEvidence: Array<{
    id: string;
    assetId: string;
    walletId: string | null;
    reserveSourceType: string;
    walletAddress: string | null;
    walletKind: string | null;
    custodyType: string | null;
    evidenceFreshness: string;
    observedBalanceAmount: string | null;
    usableBalanceAmount: string | null;
    encumberedBalanceAmount: string | null;
    excludedBalanceAmount: string | null;
    observedAt: string | null;
    staleAfterSeconds: number;
    readErrorCode: string | null;
    readErrorMessage: string | null;
    metadata: Record<string, unknown> | null;
    createdAt: string;
    asset: {
      id: string;
      symbol: string;
      displayName: string;
      decimals: number;
      chainId: number;
      assetType: string;
    };
  }>;
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

export async function getPublicReserveAttestationPackage(
  snapshotId?: string
): Promise<PublicReserveAttestationPackage> {
  const endpoint = snapshotId
    ? `/solvency/public/reports/${snapshotId}/reserve-attestation`
    : "/solvency/public/reports/latest/reserve-attestation";
  const response = await axios.get<ApiResponse<PublicReserveAttestationPackage>>(
    `${webRuntimeConfig.serverUrl}${endpoint}`
  );

  if (response.data.status !== "success" || !response.data.data) {
    throw new Error(
      response.data.message || "Failed to load public reserve attestation."
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
