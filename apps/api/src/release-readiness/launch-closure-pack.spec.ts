import {
  mkdtempSync,
  readFileSync,
  rmSync
} from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  previewLaunchClosurePack,
  renderPhase12CompletionChecklist,
  renderLaunchClosureValidationSummary,
  scaffoldLaunchClosurePack,
  validateLaunchClosureManifest,
  type LaunchClosureDynamicStatusInput,
  type LaunchClosureManifest
} from "./launch-closure-pack";

function buildManifest(): LaunchClosureManifest {
  return {
    releaseIdentifier: "launch-2026.04.10.1",
    environment: "production_like",
    baseUrls: {
      web: "https://prodlike-web.example.com",
      admin: "https://prodlike-admin.example.com",
      api: "https://prodlike-api.example.com",
      restoreApi: "https://restore-api.example.com"
    },
    worker: {
      identifier: "worker-prodlike-1"
    },
    operator: {
      requesterId: "ops_requester_1",
      requesterRole: "operations_admin",
      approverId: "ops_approver_1",
      approverRole: "compliance_lead",
      apiKeyEnvironmentVariable: "INTERNAL_OPERATOR_API_KEY"
    },
    artifacts: {
      apiReleaseId: "api-2026.04.10.1",
      workerReleaseId: "worker-2026.04.10.1",
      approvalRollbackReleaseId: "launch-rollback-2026.04.09.4",
      apiRollbackReleaseId: "api-2026.04.09.4",
      workerRollbackReleaseId: "worker-2026.04.09.4",
      backupReference: "snapshot-2026-04-10T08:00Z"
    },
    chain: {
      networkName: "sepolia",
      chainId: 11155111
    },
    solvencyAnchorRegistryDeployment: {
      deploymentTxHash:
        "0x1111111111111111111111111111111111111111111111111111111111111111",
      governanceOwner: "0x1111111111111111111111111111111111111111",
      authorizedAnchorer: "0x2222222222222222222222222222222222222222",
      manifestPath: "packages/contracts/deployments/staging.manifest.json",
      manifestCommitSha: "abc1234",
      blockExplorerUrl:
        "https://sepolia.etherscan.io/tx/0x1111111111111111111111111111111111111111111111111111111111111111"
    },
    alerting: {
      expectedTargetName: "ops-critical",
      expectedTargetHealthStatus: "critical",
      expectedMinReEscalations: 1,
      expectedAlertDedupeKey: "worker:degraded:worker-prodlike-1"
    },
    governance: {
      secretReviewReference: "ticket/SEC-42",
      roleReviewReference: "ticket/GOV-12",
      roleReviewRosterReference: "ticket/GOV-12#launch-roster"
    },
    governedCustody: {
      governanceSafeAddress: "0x3333333333333333333333333333333333333333",
      treasurySafeAddress: "0x4444444444444444444444444444444444444444",
      emergencySafeAddress: "0x5555555555555555555555555555555555555555",
      signerInventory: [
        {
          scope: "deposit_execution",
          keyReference: "kms://launch/deposit",
          signerAddress: "0x6666666666666666666666666666666666666666"
        },
        {
          scope: "withdrawal_execution",
          keyReference: "kms://launch/withdrawal",
          signerAddress: "0x7777777777777777777777777777777777777777"
        },
        {
          scope: "solvency_anchor_execution",
          keyReference: "kms://launch/solvency-anchor",
          signerAddress: "0x2222222222222222222222222222222222222222"
        },
        {
          scope: "incident_package_release",
          keyReference: "safe://launch/incident-release",
          signerAddress: "0x8888888888888888888888888888888888888888"
        },
        {
          scope: "governance_admin",
          keyReference: "safe://launch/governance-admin",
          signerAddress: "0x9999999999999999999999999999999999999999"
        }
      ]
    },
    contracts: [
      {
        productSurface: "staking_v1",
        version: "1.0.0",
        address: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        abiChecksumSha256:
          "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
      },
      {
        productSurface: "loan_book_v1",
        version: "1.0.0",
        address: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        abiChecksumSha256:
          "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
      },
      {
        productSurface: "solvency_report_anchor_registry_v1",
        version: "1.0.0",
        address: "0xcccccccccccccccccccccccccccccccccccccccc",
        abiChecksumSha256:
          "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc"
      }
    ],
    notes: {
      launchSummary: "Production-like launch candidate ready for final governed review.",
      requestNote: "All accepted evidence must be current before approval.",
      residualRiskNote: "No accepted residual risks remain open at request time."
    }
  };
}

function buildStatusSnapshot(): LaunchClosureDynamicStatusInput {
  return {
    generatedAt: "2026-04-10T12:00:00.000Z",
    releaseIdentifier: "launch-2026.04.10.1",
    environment: "production_like",
    overallStatus: "blocked",
    maximumEvidenceAgeHours: 72,
    externalChecks: [
      {
        evidenceType: "platform_alert_delivery_slo",
        status: "passed",
        acceptedEnvironments: ["staging", "production_like", "production"],
        latestEvidenceObservedAt: "2026-04-10T11:00:00.000Z",
        latestEvidenceEnvironment: "production_like"
      },
      {
        evidenceType: "critical_alert_reescalation",
        status: "pending",
        acceptedEnvironments: ["staging", "production_like", "production"]
      }
    ],
    latestApproval: {
      status: "pending_approval",
      summary: "Production-like launch candidate ready for final governed review.",
      requestNote: "All accepted evidence must be current before approval.",
      residualRiskNote: "No accepted residual risks remain open at request time.",
      rollbackReleaseIdentifier: "launch-rollback-2026.04.09.4",
      checklist: {
        securityConfigurationComplete: true,
        accessAndGovernanceComplete: true,
        dataAndRecoveryComplete: false,
        platformHealthComplete: true,
        functionalProofComplete: false,
        contractAndChainProofComplete: true,
        finalSignoffComplete: false,
        unresolvedRisksAccepted: false
      },
      gateOverallStatus: "blocked",
      missingEvidenceTypes: ["critical_alert_reescalation"],
      failedEvidenceTypes: [],
      staleEvidenceTypes: [],
      openBlockers: ["Awaiting critical alert re-escalation proof"]
    }
  };
}

describe("launch-closure-pack", () => {
  it("validates dual-control and alert identifiers", () => {
    const manifest = buildManifest();
    manifest.operator.approverId = manifest.operator.requesterId;
    delete manifest.alerting.expectedAlertDedupeKey;

    const result = validateLaunchClosureManifest(manifest);

    expect(result.errors).toContain(
      "operator.requesterId and operator.approverId must be different for dual-control approval."
    );
    expect(result.errors).toContain(
      "Provide either alerting.expectedAlertId or alerting.expectedAlertDedupeKey for critical re-escalation proof."
    );
  });

  it("scaffolds a launch-closure pack with execution and approval artifacts", () => {
    const manifest = buildManifest();
    const repoRoot = mkdtempSync(path.join(os.tmpdir(), "launch-closure-repo-"));
    const outputDir = path.join(repoRoot, "pack");

    try {
      const result = scaffoldLaunchClosurePack({
        manifest,
        repoRoot,
        outputDir,
        statusSnapshot: buildStatusSnapshot()
      });

      expect(result.files).toContain(path.join(outputDir, "execution-plan.md"));
      expect(result.files).toContain(
        path.join(outputDir, "approval-request.template.json")
      );
      expect(result.files).toContain(path.join(outputDir, "operator-actions.md"));
      expect(result.files).toContain(
        path.join(outputDir, "payloads", "critical_alert_reescalation.json")
      );
      expect(result.files).toContain(
        path.join(outputDir, "current-status-summary.md")
      );
      expect(result.files).toContain(
        path.join(outputDir, "phase-12-completion-checklist.md")
      );

      const executionPlan = readFileSync(
        path.join(outputDir, "execution-plan.md"),
        "utf8"
      );
      const approvalRequest = readFileSync(
        path.join(outputDir, "approval-request.template.json"),
        "utf8"
      );
      const validationSummary = renderLaunchClosureValidationSummary(manifest);
      const currentStatus = readFileSync(
        path.join(outputDir, "current-status-summary.md"),
        "utf8"
      );
      const completionChecklist = readFileSync(
        path.join(outputDir, "phase-12-completion-checklist.md"),
        "utf8"
      );
      const operatorActions = readFileSync(
        path.join(outputDir, "operator-actions.md"),
        "utf8"
      );
      const criticalAlertPayload = readFileSync(
        path.join(outputDir, "payloads", "critical_alert_reescalation.json"),
        "utf8"
      );

      expect(executionPlan).toContain("pnpm release:readiness:probe --");
      expect(executionPlan).toContain("--probe worker_rollback_drill");
      expect(executionPlan).toContain("--release-id launch-2026.04.10.1");
      expect(executionPlan).toContain("pnpm release:readiness:verify --");
      expect(executionPlan).toContain("curl -sS -X POST");
      expect(approvalRequest).toContain('"releaseIdentifier": "launch-2026.04.10.1"');
      expect(approvalRequest).toContain('"securityConfigurationComplete": true');
      expect(approvalRequest).toContain(
        '"openBlockers": [\n    "Awaiting critical alert re-escalation proof"\n  ]'
      );
      expect(currentStatus).toContain("Current Launch-Closure Status Snapshot");
      expect(currentStatus).toContain("critical_alert_reescalation");
      expect(completionChecklist).toContain("Phase 12 Completion Checklist");
      expect(completionChecklist).toContain(
        "Part B — Accepted Staging-Like Operational Proof"
      );
      expect(operatorActions).toContain("Operator Actions");
      expect(operatorActions).toContain("payloads/critical_alert_reescalation.json");
      expect(criticalAlertPayload).toContain('"evidenceType": "critical_alert_reescalation"');
      expect(criticalAlertPayload).toContain('"environment": "production_like"');
      expect(validationSummary).toContain(
        "database_restore_drill: accepted only in staging, production_like, production"
      );
    } finally {
      rmSync(repoRoot, {
        force: true,
        recursive: true
      });
    }
  });

  it("previews launch-closure artifacts without writing files", () => {
    const manifest = buildManifest();

    const result = previewLaunchClosurePack(manifest, buildStatusSnapshot());

    expect(result.outputSubpath).toBe(
      path.join("artifacts", "release-launch", "launch-2026.04.10.1-production_like")
    );
    expect(result.files).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          relativePath: "README.md"
        }),
        expect.objectContaining({
          relativePath: "manifest.json",
          content: expect.stringContaining('"releaseIdentifier": "launch-2026.04.10.1"')
        }),
        expect.objectContaining({
          relativePath: "execution-plan.md",
          content: expect.stringContaining("pnpm release:readiness:probe --")
        }),
        expect.objectContaining({
          relativePath: "phase-12-completion-checklist.md",
          content: expect.stringContaining("Part A — Repo-Owned And Locally Verifiable")
        }),
        expect.objectContaining({
          relativePath: "operator-actions.md",
          content: expect.stringContaining("payloads/platform_alert_delivery_slo.json")
        }),
        expect.objectContaining({
          relativePath: path.join("payloads", "platform_alert_delivery_slo.json"),
          content: expect.stringContaining('"evidenceType": "platform_alert_delivery_slo"')
        }),
        expect.objectContaining({
          relativePath: "current-status-summary.md",
          content: expect.stringContaining("Approval posture")
        }),
        expect.objectContaining({
          relativePath: path.join(
            "evidence",
            "08-solvency-anchor-registry-deployment.md"
          ),
          content: expect.stringContaining("solvency report anchor registry")
        }),
        expect.objectContaining({
          relativePath: path.join("evidence", "09-final-governed-launch-approval.md"),
          content: expect.stringContaining("dual-control launch approval")
        })
      ])
    );
  });

  it("renders a scoped phase 12 completion checklist", () => {
    const checklist = renderPhase12CompletionChecklist({
      manifest: buildManifest(),
      statusSnapshot: buildStatusSnapshot()
    });

    expect(checklist).toContain("# Phase 12 Completion Checklist");
    expect(checklist).toContain("Release identifier: `launch-2026.04.10.1`");
    expect(checklist).toContain("Part C — Governed Launch Approval");
    expect(checklist).toContain("critical_alert_reescalation");
    expect(checklist).toContain("Adjacent Follow-On Hardening");
  });
});
