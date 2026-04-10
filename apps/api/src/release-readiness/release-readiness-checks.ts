import {
  ReleaseReadinessEnvironment,
  ReleaseReadinessEvidenceType
} from "@prisma/client";

export type RequiredReleaseReadinessCheck = {
  evidenceType: ReleaseReadinessEvidenceType;
  label: string;
  description: string;
  runbookPath: string;
  acceptedEnvironments: ReleaseReadinessEnvironment[];
};

export const requiredReleaseReadinessChecks: RequiredReleaseReadinessCheck[] = [
  {
    evidenceType: ReleaseReadinessEvidenceType.platform_alert_delivery_slo,
    label: "Delivery Target SLO Alerting",
    description:
      "Prove sustained delivery-target degradation opens durable operations alerts from staging or production-like traffic.",
    runbookPath: "docs/runbooks/platform-alert-delivery-targets.md",
    acceptedEnvironments: [
      ReleaseReadinessEnvironment.staging,
      ReleaseReadinessEnvironment.production_like,
      ReleaseReadinessEnvironment.production
    ]
  },
  {
    evidenceType: ReleaseReadinessEvidenceType.critical_alert_reescalation,
    label: "Critical Alert Re-escalation Cadence",
    description:
      "Prove overdue critical alerts are re-escalated on the expected timer and leave durable evidence.",
    runbookPath: "docs/runbooks/platform-alert-delivery-targets.md",
    acceptedEnvironments: [
      ReleaseReadinessEnvironment.staging,
      ReleaseReadinessEnvironment.production_like,
      ReleaseReadinessEnvironment.production
    ]
  },
  {
    evidenceType: ReleaseReadinessEvidenceType.database_restore_drill,
    label: "Database Restore Drill",
    description:
      "Prove the latest production-like backup restores cleanly and the API reads core domains without schema drift.",
    runbookPath: "docs/runbooks/restore-and-rollback-drills.md",
    acceptedEnvironments: [
      ReleaseReadinessEnvironment.staging,
      ReleaseReadinessEnvironment.production_like,
      ReleaseReadinessEnvironment.production
    ]
  },
  {
    evidenceType: ReleaseReadinessEvidenceType.api_rollback_drill,
    label: "API Rollback Drill",
    description:
      "Prove the prior known-good API artifact can be restored against the current schema without runtime migration surprises.",
    runbookPath: "docs/runbooks/restore-and-rollback-drills.md",
    acceptedEnvironments: [
      ReleaseReadinessEnvironment.staging,
      ReleaseReadinessEnvironment.production_like,
      ReleaseReadinessEnvironment.production
    ]
  },
  {
    evidenceType: ReleaseReadinessEvidenceType.worker_rollback_drill,
    label: "Worker Rollback Drill",
    description:
      "Prove the prior worker artifact resumes heartbeat and queue processing safely without duplicate execution.",
    runbookPath: "docs/runbooks/restore-and-rollback-drills.md",
    acceptedEnvironments: [
      ReleaseReadinessEnvironment.staging,
      ReleaseReadinessEnvironment.production_like,
      ReleaseReadinessEnvironment.production
    ]
  },
  {
    evidenceType: ReleaseReadinessEvidenceType.contract_invariant_suite,
    label: "Contract Invariant Suite",
    description:
      "Prove contract accounting, reserve conservation, and safety invariants hold for the release artifact.",
    runbookPath: "docs/runbooks/release-candidate-verification.md",
    acceptedEnvironments: [
      ReleaseReadinessEnvironment.development,
      ReleaseReadinessEnvironment.ci,
      ReleaseReadinessEnvironment.staging,
      ReleaseReadinessEnvironment.production_like,
      ReleaseReadinessEnvironment.production
    ]
  },
  {
    evidenceType: ReleaseReadinessEvidenceType.backend_integration_suite,
    label: "Backend Integration Suite",
    description:
      "Prove guarded operator and worker API boundaries still hold across backend integration coverage.",
    runbookPath: "docs/runbooks/release-candidate-verification.md",
    acceptedEnvironments: [
      ReleaseReadinessEnvironment.development,
      ReleaseReadinessEnvironment.ci,
      ReleaseReadinessEnvironment.staging,
      ReleaseReadinessEnvironment.production_like,
      ReleaseReadinessEnvironment.production
    ]
  },
  {
    evidenceType: ReleaseReadinessEvidenceType.end_to_end_finance_flows,
    label: "End-to-End Finance Flows",
    description:
      "Prove customer, operator, worker, and ledger flows still complete end to end for deposit and withdrawal lifecycles.",
    runbookPath: "docs/runbooks/release-candidate-verification.md",
    acceptedEnvironments: [
      ReleaseReadinessEnvironment.development,
      ReleaseReadinessEnvironment.ci,
      ReleaseReadinessEnvironment.staging,
      ReleaseReadinessEnvironment.production_like,
      ReleaseReadinessEnvironment.production
    ]
  },
  {
    evidenceType: ReleaseReadinessEvidenceType.secret_handling_review,
    label: "Secret Handling Review",
    description:
      "Record the reviewed launch secret posture, rotation evidence, and residual secret-management exceptions.",
    runbookPath: "docs/security/secret-handling-review.md",
    acceptedEnvironments: [
      ReleaseReadinessEnvironment.staging,
      ReleaseReadinessEnvironment.production_like,
      ReleaseReadinessEnvironment.production
    ]
  },
  {
    evidenceType: ReleaseReadinessEvidenceType.role_review,
    label: "Role Review",
    description:
      "Record the approved operator roster, role mappings, and any scoped exceptions for launch.",
    runbookPath: "docs/security/role-review.md",
    acceptedEnvironments: [
      ReleaseReadinessEnvironment.staging,
      ReleaseReadinessEnvironment.production_like,
      ReleaseReadinessEnvironment.production
    ]
  }
];

export const releaseReadinessChecklistSections = [
  {
    key: "securityConfigurationComplete",
    label: "Security configuration"
  },
  {
    key: "accessAndGovernanceComplete",
    label: "Access and governance"
  },
  {
    key: "dataAndRecoveryComplete",
    label: "Data and recovery"
  },
  {
    key: "platformHealthComplete",
    label: "Platform health"
  },
  {
    key: "functionalProofComplete",
    label: "Functional proof"
  },
  {
    key: "contractAndChainProofComplete",
    label: "Contract and chain proof"
  },
  {
    key: "finalSignoffComplete",
    label: "Final sign-off"
  },
  {
    key: "unresolvedRisksAccepted",
    label: "Residual risks accepted"
  }
] as const;

export const externalOnlyReleaseReadinessChecks =
  requiredReleaseReadinessChecks.filter(
    (check) =>
      !check.acceptedEnvironments.includes(
        ReleaseReadinessEnvironment.development
      ) &&
      !check.acceptedEnvironments.includes(ReleaseReadinessEnvironment.ci)
  );
