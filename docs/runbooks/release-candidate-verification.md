# Release Candidate Verification

This runbook defines the repo-owned proof commands for the Phase 12 checks that can be verified directly from the codebase or CI.

## Purpose

Use these commands to produce durable proof for:

- `contract_invariant_suite`
- `backend_integration_suite`
- `end_to_end_finance_flows`

These proofs complement, but do not replace, the staging or production-like drill evidence required for alerting, restore, rollback, secret handling, role review, and solvency anchor registry deployment.

For `end_to_end_finance_flows`, the verifier runs in two modes:

- `development` or `ci`: repo-owned integration, replay, and worker coverage only
- `staging`, `production_like`, or `production`: the same repo-owned bundle plus live Playwright smoke against the configured web and admin stacks

## Root command

Run the full automated verifier from the repository root:

```bash
pnpm release:readiness:verify -- --proof all-auto
```

That command runs:

- the contract invariant bundle:
  - `pnpm --filter @stealth-trails-bank/contracts test -- --grep invariant`
- the backend integration bundle:
  - `pnpm --filter @stealth-trails-bank/api test -- --runTestsByPath src/transaction-intents/transaction-intents.integration.spec.ts src/transaction-intents/transaction-intents-operator.integration.spec.ts`
  - `pnpm --filter @stealth-trails-bank/api test -- --runTestsByPath src/ledger-reconciliation/ledger-reconciliation.service.spec.ts src/release-readiness/release-readiness.service.spec.ts`
- the finance proof bundle:
  - `pnpm --filter @stealth-trails-bank/api test -- --runTestsByPath src/transaction-intents/finance-flows.integration.spec.ts`
  - `pnpm --filter @stealth-trails-bank/api test -- --runTestsByPath src/transaction-intents/transaction-intents.replay.spec.ts src/transaction-intents/withdrawal-intents.replay.spec.ts src/transaction-intents/deposit-settlement-reconciliation.review-cases.spec.ts src/transaction-intents/withdrawal-settlement-reconciliation.review-cases.spec.ts`
  - `pnpm --filter @stealth-trails-bank/worker test`
  - when `--environment` is `staging`, `production_like`, or `production` and the live smoke environment is configured:
    - `PLAYWRIGHT_INCLUDE_LIVE_SMOKE=1 pnpm exec playwright test --project live-web-smoke --project live-admin-smoke`

Each automated proof is recorded as a command bundle with per-command status, duration, output tails, and coverage notes so the durable evidence matches the hardened platform surface instead of a single coarse command.

When live smoke is included, the proof payload also records that staging-like live route smoke was required and executed.

## Single-proof examples

### Contract invariants

```bash
pnpm release:readiness:verify -- --proof contract_invariant_suite
```

### Backend integration suite

```bash
pnpm release:readiness:verify -- --proof backend_integration_suite
```

### End-to-end finance flows

```bash
pnpm release:readiness:verify -- --proof end_to_end_finance_flows
```

### Staging-like end-to-end finance flows with live smoke

Required environment variables:

- `PLAYWRIGHT_LIVE_WEB_URL`
- `PLAYWRIGHT_LIVE_WEB_EMAIL`
- `PLAYWRIGHT_LIVE_WEB_PASSWORD`
- `PLAYWRIGHT_LIVE_ADMIN_URL`
- `PLAYWRIGHT_LIVE_ADMIN_API_BASE_URL`
- `PLAYWRIGHT_LIVE_ADMIN_OPERATOR_ID`
- `PLAYWRIGHT_LIVE_ADMIN_API_KEY`

Example:

```bash
export PLAYWRIGHT_LIVE_WEB_URL=https://prodlike-web.example.com
export PLAYWRIGHT_LIVE_WEB_EMAIL=customer.smoke@example.com
export PLAYWRIGHT_LIVE_WEB_PASSWORD='customer-secret'
export PLAYWRIGHT_LIVE_ADMIN_URL=https://prodlike-admin.example.com
export PLAYWRIGHT_LIVE_ADMIN_API_BASE_URL=https://prodlike-api.example.com
export PLAYWRIGHT_LIVE_ADMIN_OPERATOR_ID=ops_stage_1
export PLAYWRIGHT_LIVE_ADMIN_API_KEY='operator-secret'

pnpm release:readiness:verify -- \
  --proof end_to_end_finance_flows \
  --environment production_like
```

## Recording automated proof

When an operator wants to persist the result into release-readiness evidence:

```bash
pnpm release:readiness:verify -- \
  --proof all-auto \
  --environment ci \
  --release-id api-2026.04.08.1 \
  --record-evidence \
  --base-url http://localhost:9101 \
  --access-token "$OPERATOR_ACCESS_TOKEN"
```

## Recording manual review evidence

Secret handling review:

```bash
pnpm release:readiness:verify -- \
  --proof secret_handling_review \
  --environment production_like \
  --summary "Launch secret rotation reviewed and approved." \
  --note "Rotation ticket SEC-42 attached." \
  --evidence-links docs/security/secret-handling-review.md,ticket/SEC-42 \
  --record-evidence \
  --base-url http://localhost:9101 \
  --access-token "$OPERATOR_ACCESS_TOKEN"
```

Role review:

```bash
pnpm release:readiness:verify -- \
  --proof role_review \
  --environment production_like \
  --summary "Launch operator roster and role mappings reviewed." \
  --note "Approved roster stored in access-governance ticket GOV-12." \
  --evidence-links docs/security/role-review.md,ticket/GOV-12 \
  --record-evidence \
  --base-url http://localhost:9101 \
  --access-token "$OPERATOR_ACCESS_TOKEN"
```

Solvency anchor registry deployment:

Prefer generating the payload from the governed custody manifest first:

```bash
pnpm release:solvency-anchor-proof -- \
  --manifest packages/contracts/deployments/base-sepolia.manifest.json \
  --release-id launch-2026.04.10.1 \
  --manifest-commit <git-sha> \
  --network-name base-sepolia \
  --output artifacts/release-launch/solvency-anchor-registry-evidence.json
```

To persist the generated proof immediately, add `--record-evidence --base-url <operator-api-url> --access-token "$OPERATOR_ACCESS_TOKEN"`. You can also use the verifier directly when the payload must be supplied inline:

```bash
pnpm release:readiness:verify -- \
  --proof solvency_anchor_registry_deployment \
  --environment production_like \
  --release-id launch-2026.04.10.1 \
  --summary "Solvency anchor registry deployment verified for launch." \
  --evidence-links docs/runbooks/solvency-anchor-registry-deployment-proof.md,https://sepolia.etherscan.io/tx/<deployment-tx> \
  --evidence-payload-json '{"proofKind":"manual_attestation","networkName":"sepolia","chainId":11155111,"contractProductSurface":"solvency_report_anchor_registry_v1","signerScope":"solvency_anchor_execution","contractAddress":"0x0000000000000000000000000000000000000000","deploymentTxHash":"0x0000000000000000000000000000000000000000000000000000000000000000","governanceOwner":"0x0000000000000000000000000000000000000000","authorizedAnchorer":"0x0000000000000000000000000000000000000000","abiChecksumSha256":"0000000000000000000000000000000000000000000000000000000000000000","manifestPath":"packages/contracts/deployments/staging.manifest.json","manifestCommitSha":"0000000"}' \
  --record-evidence \
  --base-url http://localhost:9101 \
  --access-token "$OPERATOR_ACCESS_TOKEN"
```

## Output

The verifier prints structured JSON. Automated proofs include:

- executed command bundle
- per-command labels and coverage
- per-command exit code
- aggregate duration
- per-command stdout tail
- per-command stderr tail

That payload is suitable for durable evidence storage and later launch approval review.

## Launch rule

This verifier closes only the code-level and attestation-backed proof categories. Phase 12 is still not complete until the staging or production-like drills are also run and recorded through the release-readiness workflow.
