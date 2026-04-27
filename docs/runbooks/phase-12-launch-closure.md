# Phase 12 Launch Closure

## Purpose

This runbook freezes the remaining launch work into a single governed operator program.

Use it when the repo is already code-verified and the remaining work is no longer feature delivery, but accepted operational proof, human review evidence, and dual-control launch approval.

This runbook does not mark release readiness complete by itself. It exists to make staging-like execution strict, repeatable, and auditable.

## Current truth

Already satisfied from repo-owned work:

- `contract_invariant_suite` can be accepted from repo-owned automation
- `backend_integration_suite` can be accepted from repo-owned automation
- `end_to_end_finance_flows` can be accepted from repo-owned automation, and staging-like reruns can append live smoke through the same verifier
- local dry-run support already exists for `database_restore_drill`, `api_rollback_drill`, and `worker_rollback_drill`

Still externally required:

- `platform_alert_delivery_slo`
- `critical_alert_reescalation`
- `database_restore_drill` in `staging`, `production_like`, or `production`
- `api_rollback_drill` in `staging`, `production_like`, or `production`
- `worker_rollback_drill` in `staging`, `production_like`, or `production`
- `secret_handling_review`
- `role_review`
- `solvency_anchor_registry_deployment`
- final governed launch approval

Important truth:

- local dry-runs are diagnostic support only
- staging-like `end_to_end_finance_flows` reruns require live Playwright smoke configuration to count as accepted operational proof in that environment
- accepted proof for the remaining operational items must come from `staging`, `production_like`, or `production`
- launch approval is blocked until every required proof has current accepted evidence and every checklist attestation is complete

## Required inputs before execution starts

The team must complete a validated manifest before any staging-like execution begins.

Use:

- [`docs/templates/release-launch-closure/environment-manifest.template.json`](/Users/mc/development/blockchain/ethereum/stealth-trails-bank/docs/templates/release-launch-closure/environment-manifest.template.json)
- `pnpm release:launch-closure -- validate --manifest <path>`

Required input classes:

- release identifier
- accepted environment label
- web, admin, API, and restore-validation API base URLs
- live smoke URLs and credentials when rerunning `end_to_end_finance_flows` in `staging`, `production_like`, or `production`
- worker identifier
- requester and approver identities
- requester and approver roles
- operator API key environment variable name
- current release ids and rollback release ids
- backup or snapshot reference
- chain id, network name, and solvency anchor registry deployment transaction
- registry owner, authorized anchorer, ABI checksum, manifest path, and manifest commit SHA
- alert delivery target name and expected degraded health status
- critical alert identifier or dedupe key
- minimum expected re-escalation count
- secret review references
- role review references
- approved role roster reference

Execution must not start if:

- requester and approver are the same person
- the environment is `development` or `ci`
- rollback identifiers are missing
- backup reference is missing
- solvency anchor registry deployment proof fields are missing
- no critical alert identifier or dedupe key is available for re-escalation proof

## Operator program

### Roles

- requester: runs probes, collects evidence, submits the launch approval request
- approver: independently approves or rejects the governed launch request
- secret reviewer: owns the secret-handling review evidence
- access reviewer: owns the operator roster and role review evidence
- contract reviewer: owns the solvency anchor registry deployment proof

The requester and approver must be different identities.

## Execution sequence

Run the remaining accepted proofs in this order:

1. `platform_alert_delivery_slo`
2. `critical_alert_reescalation`
3. `database_restore_drill`
4. `api_rollback_drill`
5. `worker_rollback_drill`
6. `secret_handling_review`
7. `role_review`
8. `solvency_anchor_registry_deployment`
9. final governed launch approval

Why this order:

- alerting proof validates operator visibility before rollback work starts
- restore and rollback drills validate recovery posture before approval is requested
- manual reviews stay late so they reference the final launch candidate and operator roster
- solvency anchor deployment proof stays after role review so the signer inventory and on-chain registry owner are reviewed together
- approval stays last so it snapshots the current evidence set instead of an earlier incomplete state

## Exact staging-like execution flow

### 1. Validate the manifest

```bash
pnpm release:launch-closure -- validate --manifest ./launch-manifest.json
```

When solvency anchor registry deployment proof was generated from the governed contract manifest, merge that fragment into the launch manifest before validation:

```bash
pnpm release:launch-closure -- merge-solvency-fragment \
  --manifest ./launch-manifest.json \
  --solvency-fragment ./artifacts/release-launch/solvency-anchor-launch-fragment.json \
  --output ./launch-manifest.merged.json

pnpm release:launch-closure -- validate \
  --manifest ./launch-manifest.json \
  --solvency-fragment ./artifacts/release-launch/solvency-anchor-launch-fragment.json
```

The merge replaces the solvency registry deployment block, updates the `chain` scope, replaces or appends the `solvency_report_anchor_registry_v1` contract entry, and replaces or appends the governed `solvency_anchor_execution` signer while preserving the rest of the manifest. For `production_like` and `production`, validation still requires the fragment to carry RPC-verified `onchainVerification` metadata.

In the admin Launch Readiness workspace, paste the same fragment into `Solvency launch fragment JSON` next to the manifest editor. `Validate manifest` and `Generate pack` send the base manifest plus the fragment to the API, and the API validates/scaffolds the merged manifest.

### 2. Generate the launch-closure pack

```bash
pnpm release:launch-closure -- scaffold \
  --manifest ./launch-manifest.json \
  --solvency-fragment ./artifacts/release-launch/solvency-anchor-launch-fragment.json \
  --output-dir ./artifacts/release-launch/current \
  --force
```

Before distributing or attaching the pack, verify that the generated files still match the artifact manifest:

```bash
pnpm release:launch-closure -- verify-artifact-manifest \
  --pack-dir ./artifacts/release-launch/current
```

The generated pack contains:

- execution plan
- local-versus-accepted truth summary
- approval request body template
- one evidence template per remaining Phase 12 item
- `artifact-manifest.json` with byte lengths and SHA-256 checksums for each generated pack file, excluding `artifact-manifest.json` itself to avoid a recursive checksum, plus the merged `manifest.json` checksum

Preserve the stored pack checksum, merged manifest checksum, `artifact-manifest.json`, and per-file checksums with the launch evidence. The admin Launch Readiness workspace displays the pack checksum, manifest checksum, and generated file count after pack generation.

`verify-artifact-manifest` exits non-zero when a listed file is missing, an unexpected file is present, a byte length or SHA-256 checksum differs, the file count is stale, or the top-level merged manifest checksum no longer matches the listed `manifest.json` entry.

After generating a stored pack through the admin workspace or API, check the persisted payload before requesting approval. The admin Launch Readiness workspace exposes this as `Verify stored pack` beside the bound pack summary, or operators can call the API directly:

```bash
curl -sS \
  'https://staging-api.example.com/release-readiness/internal/launch-closure/packs/<pack-id>/integrity' \
  -H "authorization: Bearer $OPERATOR_ACCESS_TOKEN"
```

The integrity response must report `valid: true`, `artifactChecksumMatches: true`, and an empty `issues` array. A failed response means the stored pack payload, its `artifactManifest`, or the generated file snapshot no longer agree and the pack must not be used for governed approval.

The governed approval endpoints enforce the same check. A launch-closure pack with any stored integrity issue cannot be bound to a new approval request, cannot be used as a rebind target, and cannot pass final dual-control approval.

### 3. Run the staging-like probes

Alert delivery SLO:

```bash
pnpm release:readiness:probe -- \
  --probe platform_alert_delivery_slo \
  --base-url https://staging-api.example.com \
  --access-token "$OPERATOR_ACCESS_TOKEN" \
  --expected-target-name ops-critical \
  --expected-target-health-status critical \
  --environment production_like \
  --release-id launch-2026.04.10.1 \
  --record-evidence
```

Critical alert re-escalation:

```bash
pnpm release:readiness:probe -- \
  --probe critical_alert_reescalation \
  --base-url https://staging-api.example.com \
  --access-token "$OPERATOR_ACCESS_TOKEN" \
  --expected-alert-id alert_123 \
  --expected-min-re-escalations 1 \
  --environment production_like \
  --release-id launch-2026.04.10.1 \
  --record-evidence
```

Database restore:

```bash
pnpm release:readiness:probe -- \
  --probe database_restore_drill \
  --base-url https://restore-api.example.com \
  --access-token "$OPERATOR_ACCESS_TOKEN" \
  --environment production_like \
  --release-id launch-2026.04.10.1 \
  --backup-ref snapshot-2026-04-10T08:00Z \
  --record-evidence
```

API rollback:

```bash
pnpm release:readiness:probe -- \
  --probe api_rollback_drill \
  --base-url https://staging-api.example.com \
  --access-token "$OPERATOR_ACCESS_TOKEN" \
  --environment production_like \
  --release-id launch-2026.04.10.1 \
  --rollback-release-id api-2026.04.09.4 \
  --record-evidence
```

Worker rollback:

```bash
pnpm release:readiness:probe -- \
  --probe worker_rollback_drill \
  --base-url https://staging-api.example.com \
  --access-token "$OPERATOR_ACCESS_TOKEN" \
  --expected-worker-id worker-staging-1 \
  --expected-min-healthy-workers 1 \
  --environment production_like \
  --release-id launch-2026.04.10.1 \
  --rollback-release-id worker-2026.04.09.4 \
  --record-evidence
```

### 4. Record the manual review evidence

Secret handling review:

```bash
pnpm release:readiness:verify -- \
  --proof secret_handling_review \
  --environment production_like \
  --summary "Launch secret handling reviewed for launch-2026.04.10.1." \
  --note "Reference: ticket/SEC-42" \
  --evidence-links ticket/SEC-42 \
  --record-evidence \
  --base-url https://staging-api.example.com \
  --access-token "$OPERATOR_ACCESS_TOKEN"
```

Role review:

```bash
pnpm release:readiness:verify -- \
  --proof role_review \
  --environment production_like \
  --summary "Launch role review completed for launch-2026.04.10.1." \
  --note "References: ticket/GOV-12; roster ticket/GOV-12#launch-roster" \
  --evidence-links ticket/GOV-12,ticket/GOV-12#launch-roster \
  --record-evidence \
  --base-url https://staging-api.example.com \
  --access-token "$OPERATOR_ACCESS_TOKEN"
```

### 5. Record the solvency anchor registry deployment proof

Preflight the active API-side manifest state before writing evidence:

```bash
curl -sS \
  -H "Authorization: Bearer $OPERATOR_ACCESS_TOKEN" \
  "https://staging-api.example.com/release-readiness/internal/solvency-anchor-registry-deployment-proof?environment=production_like&chainId=84532&networkName=base-sepolia&manifestPath=packages/contracts/deployments/base-sepolia.manifest.json&manifestCommitSha=<git-sha>&releaseIdentifier=launch-2026.04.10.1"
```

Proceed only when `ready` is `true`, `blockers` is empty, and `evidenceRequestDraft.recordable` is `true`.

Use the generated `payloads/solvency_anchor_registry_deployment.json` from the launch-closure pack. For `production_like` and `production`, the launch-closure manifest must include `solvencyAnchorRegistryDeployment.onchainVerification`; pack validation checks that it matches the registry contract entry, deployment transaction, governance owner, authorized anchorer, chain id, deployed bytecode observation, RPC host, and deployment block before writing the payload. When the governed custody manifest already contains the final registry deployment metadata, prefer generating the evidence payload directly from that manifest:

```bash
pnpm release:solvency-anchor-proof -- \
  --manifest packages/contracts/deployments/base-sepolia.manifest.json \
  --release-id launch-2026.04.10.1 \
  --manifest-commit <git-sha> \
  --network-name base-sepolia \
  --verify-onchain \
  --rpc-url "$BASE_SEPOLIA_RPC_URL" \
  --launch-closure-fragment-output artifacts/release-launch/solvency-anchor-launch-fragment.json \
  --record-evidence \
  --base-url https://staging-api.example.com \
  --access-token "$OPERATOR_ACCESS_TOKEN"
```

The manifest proof generator now preflights passed recordings against the API governed manifest state before posting. `--verify-onchain` also reads the registry owner, authorized anchorer, deployed bytecode, and deployment receipt from the accepted chain before the proof is recorded. The API requires `onchainVerification` metadata for passed `production_like` and `production` solvency anchor registry deployment evidence. `--launch-closure-fragment-output` writes a launch-manifest patch containing the checked registry deployment fields and on-chain verification object so operators can update the launch-closure manifest before scaffolding the pack. If the operator wants to inspect the API gate without writing evidence, replace `--record-evidence` with `--preflight-only` and keep the same API URL and token.

Alternatively, record the proof through the verifier when the payload must be supplied inline:

```bash
pnpm release:readiness:verify -- \
  --proof solvency_anchor_registry_deployment \
  --environment production_like \
  --release-id launch-2026.04.10.1 \
  --summary "Solvency anchor registry deployment verified for launch-2026.04.10.1." \
  --evidence-links docs/runbooks/solvency-anchor-registry-deployment-proof.md,https://sepolia.etherscan.io/tx/<deployment-tx> \
  --evidence-payload-json '{"proofKind":"manual_attestation","networkName":"sepolia","chainId":11155111,"contractProductSurface":"solvency_report_anchor_registry_v1","signerScope":"solvency_anchor_execution","contractAddress":"0x0000000000000000000000000000000000000000","deploymentTxHash":"0x0000000000000000000000000000000000000000000000000000000000000000","governanceOwner":"0x0000000000000000000000000000000000000000","authorizedAnchorer":"0x0000000000000000000000000000000000000000","abiChecksumSha256":"0000000000000000000000000000000000000000000000000000000000000000","manifestPath":"packages/contracts/deployments/staging.manifest.json","manifestCommitSha":"0000000"}' \
  --record-evidence \
  --base-url https://staging-api.example.com \
  --access-token "$OPERATOR_ACCESS_TOKEN"
```

### 6. Review the release-readiness summary

Confirm that every required proof now shows a latest accepted `passed` record:

```bash
curl -sS \
  -H "authorization: Bearer $OPERATOR_ACCESS_TOKEN" \
  https://staging-api.example.com/release-readiness/internal/summary
```

### 7. Submit the governed launch request

Populate the generated `approval-request.template.json` truthfully, then submit:

```bash
curl -sS -X POST \
  'https://staging-api.example.com/release-readiness/internal/approvals' \
  -H 'authorization: Bearer '"$OPERATOR_ACCESS_TOKEN" \
  -H 'content-type: application/json' \
  --data @approval-request.template.json
```

The request fails closed if the referenced pack fails stored integrity verification or belongs to a different release identifier or environment.

### 7. Complete dual-control approval

The separate approver must review the generated approval record and then approve or reject it through the governed approval endpoints defined in [`docs/runbooks/release-launch-approval.md`](/Users/mc/development/blockchain/ethereum/stealth-trails-bank/docs/runbooks/release-launch-approval.md).

Final approval rechecks the approval-bound launch-closure pack. Approval is blocked if the pack is missing, if its id, release identifier, environment, version, or checksum no longer match the approval snapshot, or if its stored integrity result is no longer valid.

After approval, export `GET /release-readiness/internal/approvals/<approval-id>/decision-receipt` and archive the returned `receiptChecksumSha256` with the launch evidence. The receipt binds the final decision, approval snapshot, pack integrity result, lineage state, and release-readiness audit trail under one checksum. Treat a receipt with `launchReady: false` or non-empty `blockers` as not launch-ready.

## Pass and fail criteria

### `platform_alert_delivery_slo`

Pass:

- expected target shows degraded health at the expected severity
- durable operations alert evidence exists
- the probe records accepted evidence with `passed`

Fail:

- target health does not degrade as expected
- no matching operations alert exists
- probe output is failed or evidence recording is rejected

### `critical_alert_reescalation`

Pass:

- the selected critical alert shows at least the expected re-escalation count
- the probe records accepted evidence with `passed`

Fail:

- no qualifying overdue critical alert exists
- re-escalation count stays below the required threshold
- evidence recording is rejected

### `database_restore_drill`

Pass:

- restored API boots against the restored backup
- required reads succeed after restore
- the probe records accepted evidence with `passed`

Fail:

- schema drift or missing-table failures appear
- required operator reads fail
- evidence recording is rejected

### `api_rollback_drill`

Pass:

- prior API artifact deploys against the current schema
- auth and internal monitoring reads remain available
- the probe records accepted evidence with `passed`

Fail:

- runtime migration assumptions or incompatibilities appear
- required operator reads fail
- evidence recording is rejected

### `worker_rollback_drill`

Pass:

- worker heartbeat resumes within the expected stale window
- queue processing is safe and no duplicate execution is observed
- the probe records accepted evidence with `passed`

Fail:

- heartbeat does not resume
- queue safety is uncertain or duplicate effects are observed
- evidence recording is rejected

### `secret_handling_review`

Pass:

- secret inventory, rotation, and environment isolation are reviewed against the launch environment
- evidence links point to real review artifacts
- the manual attestation is recorded as accepted evidence

Fail:

- review is incomplete
- launch secrets remain unverified
- evidence links are missing or not durable

### `role_review`

Pass:

- launch roster is explicitly reviewed
- role mappings are approved
- evidence links point to the reviewed roster and approval references

Fail:

- roster is incomplete
- role assignments are not approved
- approval identity separation is unclear

### `solvency_anchor_registry_deployment`

Pass:

- registry address and ABI checksum match the accepted deployment manifest
- deployment transaction and manifest commit SHA are durable and reviewable
- registry governance owner is the expected governance owner
- registry authorized anchorer matches the governed `solvency_anchor_execution` signer
- production-like or production payloads include on-chain verification metadata copied from the accepted RPC observation

Fail:

- registry address, deployment transaction, or ABI checksum is missing
- owner or authorized anchorer cannot be read from the accepted chain
- authorized anchorer does not match the governed signer inventory
- production-like or production launch-closure manifest omits `solvencyAnchorRegistryDeployment.onchainVerification`
- evidence is recorded without the required structured payload fields

### final governed launch approval

Pass:

- all required proofs have latest accepted `passed` evidence
- evidence is fresh enough for approval policy
- rollback drill evidence is bound to the same rollback release identifier recorded on the approval request
- checklist attestations are complete
- open blockers are empty
- a separate approver identity approves the request

Fail:

- any required proof is missing, failed, or stale
- rollback drill evidence points at a different rollback target than the governed request
- any checklist section is incomplete
- requester and approver are the same identity
- blockers remain open

## Evidence artifacts to collect

Collect and preserve:

- generated probe or verifier JSON output
- links to tickets, dashboards, screenshots, and logs
- approval request JSON used for submission
- approval id and final approval or rejection record
- timestamps for start, observation, completion, and submission
- operator identities and roles used at each step

Use the committed templates in [`docs/templates/release-launch-closure`](/Users/mc/development/blockchain/ethereum/stealth-trails-bank/docs/templates/release-launch-closure) or the generated evidence files inside the scaffolded pack.

## Abort guidance

Abort the launch-closure run if:

- the manifest fails validation
- the environment cannot produce accepted evidence
- the probe returns failed status for any required step
- the rollback drill reveals unsafe runtime behavior
- the requester cannot identify a separate approver

If a probe fails:

1. stop progressing to later steps
2. keep the failure evidence
3. open a blocker with owner and remediation path
4. rerun only after the blocking condition is understood and remediated

## Related references

- [`docs/runbooks/release-readiness-evidence-api.md`](/Users/mc/development/blockchain/ethereum/stealth-trails-bank/docs/runbooks/release-readiness-evidence-api.md)
- [`docs/runbooks/platform-alert-delivery-targets.md`](/Users/mc/development/blockchain/ethereum/stealth-trails-bank/docs/runbooks/platform-alert-delivery-targets.md)
- [`docs/runbooks/restore-and-rollback-drills.md`](/Users/mc/development/blockchain/ethereum/stealth-trails-bank/docs/runbooks/restore-and-rollback-drills.md)
- [`docs/runbooks/release-launch-approval.md`](/Users/mc/development/blockchain/ethereum/stealth-trails-bank/docs/runbooks/release-launch-approval.md)
- [`docs/security/secret-handling-review.md`](/Users/mc/development/blockchain/ethereum/stealth-trails-bank/docs/security/secret-handling-review.md)
- [`docs/security/role-review.md`](/Users/mc/development/blockchain/ethereum/stealth-trails-bank/docs/security/role-review.md)
