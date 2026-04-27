import { ReleaseReadinessEvidenceType } from "@prisma/client";
import {
  describeReleaseReadinessEvidencePayloadRequirements,
  describeReleaseReadinessEvidenceMetadataRequirements,
  listReleaseReadinessEvidenceMetadataRequirements,
  validateReleaseReadinessEvidenceMetadata,
  validateReleaseReadinessEvidencePayload
} from "./release-readiness-evidence-requirements";

describe("release-readiness-evidence-requirements", () => {
  it("requires launch candidate metadata for external-only proofs", () => {
    expect(
      listReleaseReadinessEvidenceMetadataRequirements(
        ReleaseReadinessEvidenceType.secret_handling_review
      )
    ).toEqual(["releaseIdentifier"]);
    expect(
      describeReleaseReadinessEvidenceMetadataRequirements(
        ReleaseReadinessEvidenceType.secret_handling_review
      )
    ).toEqual(["release identifier"]);
  });

  it("requires rollback metadata for rollback drill evidence", () => {
    expect(
      listReleaseReadinessEvidenceMetadataRequirements(
        ReleaseReadinessEvidenceType.api_rollback_drill
      )
    ).toEqual(["releaseIdentifier", "rollbackReleaseIdentifier"]);
  });

  it("requires backup metadata for restore drill evidence", () => {
    expect(
      listReleaseReadinessEvidenceMetadataRequirements(
        ReleaseReadinessEvidenceType.database_restore_drill
      )
    ).toEqual(["releaseIdentifier", "backupReference"]);
  });

  it("allows repo-owned automated proofs without release metadata", () => {
    expect(
      listReleaseReadinessEvidenceMetadataRequirements(
        ReleaseReadinessEvidenceType.backend_integration_suite
      )
    ).toEqual([]);
    expect(
      validateReleaseReadinessEvidenceMetadata({
        evidenceType: ReleaseReadinessEvidenceType.backend_integration_suite
      })
    ).toEqual([]);
  });

  it("reports each missing required field", () => {
    expect(
      validateReleaseReadinessEvidenceMetadata({
        evidenceType: ReleaseReadinessEvidenceType.worker_rollback_drill,
        releaseIdentifier: "launch-2026.04.14.1"
      })
    ).toEqual(["rollbackReleaseIdentifier"]);
  });

  it("requires structured solvency anchor registry deployment payload", () => {
    expect(
      describeReleaseReadinessEvidencePayloadRequirements(
        ReleaseReadinessEvidenceType.solvency_anchor_registry_deployment
      )
    ).toContain("deployment transaction hash");
    expect(
      validateReleaseReadinessEvidencePayload({
        evidenceType:
          ReleaseReadinessEvidenceType.solvency_anchor_registry_deployment,
        evidencePayload: {
          proofKind: "manual_attestation",
          networkName: "sepolia",
          chainId: 11155111,
          contractProductSurface: "solvency_report_anchor_registry_v1",
          signerScope: "solvency_anchor_execution",
          contractAddress: "0x1111111111111111111111111111111111111111",
          deploymentTxHash:
            "0x2222222222222222222222222222222222222222222222222222222222222222",
          governanceOwner: "0x3333333333333333333333333333333333333333",
          authorizedAnchorer: "0x4444444444444444444444444444444444444444",
          abiChecksumSha256:
            "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          manifestPath: "packages/contracts/deployments/staging.manifest.json",
          manifestCommitSha: "abc1234"
        }
      })
    ).toEqual([]);
  });
});
