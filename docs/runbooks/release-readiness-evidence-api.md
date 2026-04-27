# Release Readiness Evidence API

This runbook covers the durable Phase 12 evidence workflow for proving release readiness from both repo-owned verification suites and staging or production-like operational drills.

## Purpose

Use this API to record immutable proof for the current required checks:

- delivery-target SLO alerting
- critical alert re-escalation cadence
- database restore drill
- API rollback drill
- worker rollback drill
- contract invariant suite
- backend integration suite
- end-to-end finance flows
- solvency anchor registry deployment
- secret handling review
- role review

The goal is to replace ad hoc screenshots and scattered notes with a durable operator-visible evidence trail.

## Endpoints

- `GET /release-readiness/internal/summary`
- `GET /release-readiness/internal/evidence`
- `GET /release-readiness/internal/evidence/:evidenceId`
- `GET /release-readiness/internal/solvency-anchor-registry-deployment-proof`
- `POST /release-readiness/internal/evidence`
- `GET /release-readiness/internal/approvals`
- `GET /release-readiness/internal/approvals/:approvalId`
- `POST /release-readiness/internal/approvals`
- `POST /release-readiness/internal/approvals/:approvalId/approve`
- `POST /release-readiness/internal/approvals/:approvalId/reject`

Required operator authentication:

- `Authorization: Bearer <operator-session-token>`

## Evidence payload

Required fields for `POST /release-readiness/internal/evidence`:

- `evidenceType`
- `environment`
- `status`
- `summary`

Optional fields:

- `releaseIdentifier`
- `rollbackReleaseIdentifier`
- `backupReference`
- `note`
- `evidenceLinks`
- `evidencePayload`
- `startedAt`
- `completedAt`
- `observedAt`

Field requirements by evidence type:

- external-only launch proofs require `releaseIdentifier`
- `database_restore_drill` also requires `backupReference`
- `api_rollback_drill` and `worker_rollback_drill` also require `rollbackReleaseIdentifier`
- `solvency_anchor_registry_deployment` also requires structured `evidencePayload` fields for chain id, registry address, deployment transaction, owner, authorized anchorer, ABI checksum, manifest path, and manifest commit SHA

For `solvency_anchor_registry_deployment`, the API also verifies the payload against active governed manifest records before it writes evidence:

- registry deployment fields must match `ContractDeploymentManifest`
- authorized anchorer must match an active `GovernedSignerInventory` row for `solvency_anchor_execution`
- governance owner must match the active `GovernanceAuthorityManifest` governance safe

Operators can preflight those same governed manifest bindings before recording evidence:

```bash
curl -sS \
  -H "Authorization: Bearer $INTERNAL_OPERATOR_API_KEY" \
  "https://prodlike-api.example.com/release-readiness/internal/solvency-anchor-registry-deployment-proof?environment=production_like&chainId=84532&networkName=base-sepolia&manifestPath=packages/contracts/deployments/base-sepolia.manifest.json&manifestCommitSha=<git-sha>&releaseIdentifier=launch-2026.04.10.1"
```

The response includes:

- `ready`: `true` only when the active registry deployment manifest is non-legacy, contains deployment proof fields, and matches active governance and signer inventory
- `blockers`: operator-actionable reasons that would prevent accepted evidence from being recorded
- `requiredOperatorInputs`: missing request inputs that are not stored in the database, such as the launch release identifier and manifest commit SHA
- `registryContract`, `governedSigner`, and `governanceAuthority`: the exact active records the evidence write gate will compare against
- `governedSigner.keyReferenceSha256`: a fingerprint of the signer key reference; the raw key reference is not returned by this endpoint
- `evidenceRequestDraft`: a `POST /release-readiness/internal/evidence` body draft; `recordable` becomes `true` only when the database bindings are ready and all operator inputs were supplied

## Evidence types

- `platform_alert_delivery_slo`
- `critical_alert_reescalation`
- `database_restore_drill`
- `api_rollback_drill`
- `worker_rollback_drill`
- `contract_invariant_suite`
- `backend_integration_suite`
- `end_to_end_finance_flows`
- `solvency_anchor_registry_deployment`
- `secret_handling_review`
- `role_review`

## Environment values

- `development`
- `ci`
- `staging`
- `production_like`
- `production`

## Example

```json
{
  "evidenceType": "database_restore_drill",
  "environment": "production_like",
  "status": "passed",
  "releaseIdentifier": "launch-2026.04.08.1",
  "backupReference": "snapshot-2026-04-08T09:00Z",
  "summary": "Restored the latest production-like backup and verified auth, review, reconciliation, operations status, and incident package reads.",
  "note": "No missing-table or schema-drift issues were observed.",
  "evidenceLinks": [
    "https://evidence.example.com/restore-drill/2026-04-08"
  ],
  "evidencePayload": {
    "validatedEndpoints": [
      "/auth/login",
      "/operations/internal/status",
      "/ledger/internal/reconciliation/runs"
    ],
    "postDrillAlerts": {
      "unexpectedCriticalCount": 0
    }
  }
}
```

## Summary behavior

`GET /release-readiness/internal/summary` derives the current checkpoint from the latest accepted evidence for each required proof. When `releaseIdentifier` is supplied, the summary is scoped to that launch candidate so one release cannot inherit another release's proof.

- `healthy`: every required proof has a latest `passed` record
- `warning`: one or more proofs are still missing accepted evidence
- `critical`: the latest evidence for at least one required proof is `failed`

`GET /release-readiness/internal/evidence` also accepts an optional `releaseIdentifier` filter. That filter is an exact launch-candidate match, so `launch-2026.04.13.1` does not inherit evidence from similarly prefixed identifiers such as `launch-2026.04.13.10`.

## Launch rule

No launch posture is approved until the required proofs have accepted evidence in this workflow, the launch checklist attestations are complete, and the candidate has been approved through the governed launch-approval workflow.

## CLI helper

For staging or production-like drills, prefer the repo-owned probe runner:

```bash
pnpm release:readiness:probe -- --help
```

The command validates the relevant operator endpoints for a chosen evidence type, prints structured JSON proof, and can persist that result through `POST /release-readiness/internal/evidence` when `--record-evidence` is supplied.

For repo-owned verification suites and manual review attestations, use:

```bash
pnpm release:readiness:verify -- --help
```

That command runs the automated Phase 12 proof suites, supports manual secret or role review attestations, prints structured JSON proof, and can persist each result through the same evidence API.

For solvency anchor registry deployment evidence, generate the structured payload from the governed deployment manifest before recording it:

```bash
pnpm release:solvency-anchor-proof -- --help
```

That command refuses placeholder deployment metadata and emits a `POST /release-readiness/internal/evidence` payload for `solvency_anchor_registry_deployment`. With `--record-evidence --base-url <operator-api-url> --access-token "$OPERATOR_ACCESS_TOKEN"`, it records the generated proof directly through the same evidence API.

## Launch-closure pack

For the remaining staging-like Phase 12 work, prefer the repo-owned launch-closure helper:

```bash
pnpm release:launch-closure -- status
pnpm release:launch-closure -- validate --manifest ./launch-manifest.json
pnpm release:launch-closure -- scaffold --manifest ./launch-manifest.json --output-dir ./artifacts/release-launch/current --force
```

That helper does not close evidence gates. It validates required inputs, generates a strict execution pack, and preserves the distinction between:

- repo-owned proofs already satisfiable from development or ci
- local dry-run support that is still not accepted launch proof
- external-only accepted proofs that require `staging`, `production_like`, or `production`

See [`docs/runbooks/phase-12-launch-closure.md`](/Users/mc/development/blockchain/ethereum/stealth-trails-bank/docs/runbooks/phase-12-launch-closure.md).
