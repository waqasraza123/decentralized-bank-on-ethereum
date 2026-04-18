import { ethers } from "ethers";
import {
  buildSha256Checksum,
  stableStringify
} from "../solvency/solvency-proof";

export type GovernedExecutionPackagePayload = {
  version: number;
  requestId: string;
  environment: string;
  chainId: number;
  executionType: string;
  targetType: string;
  targetId: string;
  loanAgreementId: string | null;
  stakingPoolGovernanceRequestId: string | null;
  contractAddress: string | null;
  contractMethod: string;
  walletAddress: string | null;
  asset: {
    id: string;
    symbol: string;
    displayName: string;
    decimals: number;
    chainId: number;
  } | null;
  loanAgreement: {
    id: string;
    status: string;
    contractLoanId: string | null;
    contractAddress: string | null;
  } | null;
  stakingPoolGovernanceRequest: {
    id: string;
    status: string;
    rewardRate: number;
    stakingPoolId: number | null;
  } | null;
  executionPayload: unknown;
  requestedByActorType: string;
  requestedByActorId: string;
  requestedByActorRole: string | null;
  requestedAt: string;
};

export function buildSignedGovernedExecutionPackage(
  payload: GovernedExecutionPackagePayload,
  signerPrivateKey: string
): {
  canonicalPayloadText: string;
  executionPackageHash: string;
  executionPackageChecksumSha256: string;
  executionPackageSignature: string;
  executionPackageSignerAddress: string;
  executionPackageSignatureAlgorithm: string;
} {
  const canonicalPayloadText = stableStringify(payload);
  const executionPackageHash = ethers.utils.keccak256(
    ethers.utils.toUtf8Bytes(canonicalPayloadText)
  );
  const executionPackageChecksumSha256 = buildSha256Checksum(canonicalPayloadText);
  const signer = new ethers.Wallet(signerPrivateKey);
  const executionPackageSignature = ethers.utils.joinSignature(
    signer._signingKey().signDigest(executionPackageHash)
  );

  return {
    canonicalPayloadText,
    executionPackageHash,
    executionPackageChecksumSha256,
    executionPackageSignature,
    executionPackageSignerAddress: signer.address,
    executionPackageSignatureAlgorithm: "ethereum-secp256k1-keccak256-v1"
  };
}
