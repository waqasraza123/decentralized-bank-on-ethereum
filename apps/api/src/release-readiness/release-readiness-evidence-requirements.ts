import { ReleaseReadinessEvidenceType } from "@prisma/client";
import { externalOnlyReleaseReadinessChecks } from "./release-readiness-checks";

export type ReleaseReadinessEvidenceMetadataField =
  | "releaseIdentifier"
  | "rollbackReleaseIdentifier"
  | "backupReference";

export type ReleaseReadinessEvidencePayloadField =
  | "proofKind"
  | "networkName"
  | "chainId"
  | "contractProductSurface"
  | "signerScope"
  | "contractAddress"
  | "deploymentTxHash"
  | "governanceOwner"
  | "authorizedAnchorer"
  | "abiChecksumSha256"
  | "manifestPath"
  | "manifestCommitSha";

type ReleaseReadinessEvidenceMetadataInput = {
  evidenceType: ReleaseReadinessEvidenceType;
  releaseIdentifier?: string | null;
  rollbackReleaseIdentifier?: string | null;
  backupReference?: string | null;
};

type ReleaseReadinessEvidencePayloadInput = {
  evidenceType: ReleaseReadinessEvidenceType;
  evidencePayload?: unknown;
};

const releaseIdentifierRequiredEvidenceTypes =
  new Set<ReleaseReadinessEvidenceType>(
    externalOnlyReleaseReadinessChecks.map((check) => check.evidenceType)
  );

const rollbackReleaseIdentifierRequiredEvidenceTypes = new Set<
  ReleaseReadinessEvidenceType
>([
  ReleaseReadinessEvidenceType.api_rollback_drill,
  ReleaseReadinessEvidenceType.worker_rollback_drill
]);

const backupReferenceRequiredEvidenceTypes =
  new Set<ReleaseReadinessEvidenceType>([
    ReleaseReadinessEvidenceType.database_restore_drill
  ]);

const metadataFieldLabels: Record<
  ReleaseReadinessEvidenceMetadataField,
  string
> = {
  releaseIdentifier: "release identifier",
  rollbackReleaseIdentifier: "rollback release identifier",
  backupReference: "backup reference"
};

const solvencyAnchorRegistryDeploymentPayloadFields: readonly ReleaseReadinessEvidencePayloadField[] =
  [
    "proofKind",
    "networkName",
    "chainId",
    "contractProductSurface",
    "signerScope",
    "contractAddress",
    "deploymentTxHash",
    "governanceOwner",
    "authorizedAnchorer",
    "abiChecksumSha256",
    "manifestPath",
    "manifestCommitSha"
  ];

const payloadFieldLabels: Record<
  ReleaseReadinessEvidencePayloadField,
  string
> = {
  proofKind: "proof kind",
  networkName: "network name",
  chainId: "chain id",
  contractProductSurface: "contract product surface",
  signerScope: "signer scope",
  contractAddress: "contract address",
  deploymentTxHash: "deployment transaction hash",
  governanceOwner: "governance owner",
  authorizedAnchorer: "authorized anchorer",
  abiChecksumSha256: "ABI SHA-256 checksum",
  manifestPath: "deployment manifest path",
  manifestCommitSha: "manifest commit SHA"
};

const evmAddressPattern = /^0x[a-fA-F0-9]{40}$/;
const evmTransactionHashPattern = /^0x[a-fA-F0-9]{64}$/;
const sha256ChecksumPattern = /^(sha256:)?[a-fA-F0-9]{64}$/;
const gitCommitShaPattern = /^[a-fA-F0-9]{7,40}$/;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && !Array.isArray(value) && typeof value === "object";
}

function hasNonEmptyString(
  payload: Record<string, unknown>,
  field: ReleaseReadinessEvidencePayloadField
): boolean {
  return typeof payload[field] === "string" && payload[field].trim().length > 0;
}

function hasPositiveIntegerLikeChainId(payload: Record<string, unknown>): boolean {
  const value = payload.chainId;

  if (Number.isInteger(value) && Number(value) > 0) {
    return true;
  }

  return typeof value === "string" && /^[1-9][0-9]*$/.test(value.trim());
}

function hasPatternMatch(
  payload: Record<string, unknown>,
  field: ReleaseReadinessEvidencePayloadField,
  pattern: RegExp
): boolean {
  const value = payload[field];

  return typeof value === "string" && pattern.test(value.trim());
}

function hasExactValue(
  payload: Record<string, unknown>,
  field: ReleaseReadinessEvidencePayloadField,
  expectedValue: string
): boolean {
  return payload[field] === expectedValue;
}

export function listReleaseReadinessEvidenceMetadataRequirements(
  evidenceType: ReleaseReadinessEvidenceType
): ReleaseReadinessEvidenceMetadataField[] {
  const requirements: ReleaseReadinessEvidenceMetadataField[] = [];

  if (releaseIdentifierRequiredEvidenceTypes.has(evidenceType)) {
    requirements.push("releaseIdentifier");
  }

  if (rollbackReleaseIdentifierRequiredEvidenceTypes.has(evidenceType)) {
    requirements.push("rollbackReleaseIdentifier");
  }

  if (backupReferenceRequiredEvidenceTypes.has(evidenceType)) {
    requirements.push("backupReference");
  }

  return requirements;
}

export function describeReleaseReadinessEvidenceMetadataRequirements(
  evidenceType: ReleaseReadinessEvidenceType
): string[] {
  return listReleaseReadinessEvidenceMetadataRequirements(evidenceType).map(
    (field) => metadataFieldLabels[field]
  );
}

export function validateReleaseReadinessEvidenceMetadata(
  input: ReleaseReadinessEvidenceMetadataInput
): ReleaseReadinessEvidenceMetadataField[] {
  const missingFields: ReleaseReadinessEvidenceMetadataField[] = [];

  for (const field of listReleaseReadinessEvidenceMetadataRequirements(
    input.evidenceType
  )) {
    const value = input[field];

    if (typeof value !== "string" || value.trim().length === 0) {
      missingFields.push(field);
    }
  }

  return missingFields;
}

export function listReleaseReadinessEvidencePayloadRequirements(
  evidenceType: ReleaseReadinessEvidenceType
): readonly ReleaseReadinessEvidencePayloadField[] {
  if (
    evidenceType ===
    ReleaseReadinessEvidenceType.solvency_anchor_registry_deployment
  ) {
    return solvencyAnchorRegistryDeploymentPayloadFields;
  }

  return [];
}

export function describeReleaseReadinessEvidencePayloadRequirements(
  evidenceType: ReleaseReadinessEvidenceType
): string[] {
  return listReleaseReadinessEvidencePayloadRequirements(evidenceType).map(
    (field) => payloadFieldLabels[field]
  );
}

export function validateReleaseReadinessEvidencePayload(
  input: ReleaseReadinessEvidencePayloadInput
): ReleaseReadinessEvidencePayloadField[] {
  const requiredFields = listReleaseReadinessEvidencePayloadRequirements(
    input.evidenceType
  );

  if (requiredFields.length === 0) {
    return [];
  }

  if (!isPlainObject(input.evidencePayload)) {
    return [...requiredFields];
  }

  const payload = input.evidencePayload;
  const missingOrInvalidFields: ReleaseReadinessEvidencePayloadField[] = [];

  for (const field of requiredFields) {
    if (field === "chainId") {
      if (!hasPositiveIntegerLikeChainId(payload)) {
        missingOrInvalidFields.push(field);
      }
      continue;
    }

    if (
      field === "contractAddress" ||
      field === "governanceOwner" ||
      field === "authorizedAnchorer"
    ) {
      if (!hasPatternMatch(payload, field, evmAddressPattern)) {
        missingOrInvalidFields.push(field);
      }
      continue;
    }

    if (
      field === "deploymentTxHash" &&
      !hasPatternMatch(payload, field, evmTransactionHashPattern)
    ) {
      missingOrInvalidFields.push(field);
      continue;
    }

    if (
      field === "abiChecksumSha256" &&
      !hasPatternMatch(payload, field, sha256ChecksumPattern)
    ) {
      missingOrInvalidFields.push(field);
      continue;
    }

    if (
      field === "manifestCommitSha" &&
      !hasPatternMatch(payload, field, gitCommitShaPattern)
    ) {
      missingOrInvalidFields.push(field);
      continue;
    }

    if (
      field === "proofKind" &&
      !hasExactValue(payload, field, "manual_attestation")
    ) {
      missingOrInvalidFields.push(field);
      continue;
    }

    if (
      field === "contractProductSurface" &&
      !hasExactValue(payload, field, "solvency_report_anchor_registry_v1")
    ) {
      missingOrInvalidFields.push(field);
      continue;
    }

    if (
      field === "signerScope" &&
      !hasExactValue(payload, field, "solvency_anchor_execution")
    ) {
      missingOrInvalidFields.push(field);
      continue;
    }

    if (!hasNonEmptyString(payload, field)) {
      missingOrInvalidFields.push(field);
    }
  }

  return missingOrInvalidFields;
}
