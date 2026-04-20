# Retirement Vault Phases

This roadmap breaks the feature into implementation-ready phases ordered to match the current repo architecture.

## Phase 1: Vault Domain and Ledger Foundation

### Goal

Create real product truth for locked retirement balances without implementing early unlock yet.

### Why this phase comes first

The repo’s strongest patterns are schema truth, explicit ledger journals, idempotent workflow records, and audit trails. The vault must exist there before UI polish or operator workflow.

### Exact repo areas likely affected

- `apps/api/prisma/schema.prisma`
- new migration under `apps/api/prisma/migrations/*`
- `apps/api/src/ledger/ledger.service.ts`
- new `apps/api/src/retirement-vault/*`
- `apps/api/src/app.module.ts`
- `apps/api/src/transaction-intents/transaction-operations.service.ts`
- `apps/api/src/customer-account-operations/customer-account-operations.service.ts`

### Backend work

- add `RetirementVault`, `RetirementVaultReleaseRequest`, and `RetirementVaultEvent`
- add nullable `retirementVaultId` on `TransactionIntent`
- implement customer vault snapshot reads
- implement vault creation and funding
- create `vault_subscription` intents and settle them internally
- emit audit events for create and funding

### Frontend work

- none required beyond API contract stubs or temporary internal verification

### Worker and background work

- none in this phase

### Schema and model work

- add vault tables
- add new ledger account and journal enums
- add indexes for `customerAccountId + assetId`, status, and `unlockAt`

### Tests needed

- Prisma migration test coverage where applicable
- ledger service tests for vault funding journals
- service tests for idempotent funding
- API tests for vault snapshot and funding

### Risk points

- duplicating liquid and locked balances inconsistently
- introducing a vault read model that drifts from ledger truth
- over-generalizing into a full vault product platform too early

### Definition of done

- a customer account can have a persisted vault record for an asset
- funding a vault moves balance from liquid to locked through ledger journals
- the API can return a truthful vault snapshot
- transaction history can return `vault_subscription` from the backend

## Phase 2: Customer Visibility and Funding UX

### Goal

Make Retirement Vault highly visible to customers and usable for create/fund/view flows.

### Why this phase comes now

Once product truth exists, the customer UI can expose it safely without inventing behavior in the browser.

### Exact repo areas likely affected

- `apps/web/src/App.tsx`
- new `apps/web/src/pages/Vault.tsx`
- `apps/web/src/pages/Index.tsx`
- `apps/web/src/pages/Wallet.tsx`
- new hooks under `apps/web/src/hooks/retirement-vault/*`
- `apps/web/src/hooks/transactions/useMyTransactionHistory.ts`
- `apps/web/src/lib/customer-finance.ts`
- mobile navigation and screens under `apps/mobile/src/navigation/*` and `apps/mobile/src/screens/*`

### Backend work

- add customer endpoints for create, fund, and get vault state
- extend transaction history projections to include vault intent types

### Frontend work

- add dashboard hero module for Retirement Vault
- add dedicated vault page on web
- add wallet locked-funds summary
- add mobile vault entry point from dashboard and wallet
- update history renderers and intent labels for vault funding and release

### Worker and background work

- none in this phase

### Schema and model work

- no major new tables beyond phase 1

### Tests needed

- web route and page tests
- mobile screen tests
- transaction history type and render tests

### Risk points

- accidentally presenting locked funds as spendable funds
- burying the feature inside wallet details instead of making it visible
- inconsistent wording between web and mobile

### Definition of done

- customers can see their vault balance and rules on web and mobile
- customers can fund the vault from available balance
- vault intents appear in customer history and status views

## Phase 3: Unlock Requests, Review, and Cooldown Execution

### Goal

Implement governed release, including early unlock review and delayed execution.

### Why this phase comes now

The feature is not operationally serious until funds can be released safely. This phase converts the vault from a lockbox into a governed release workflow.

### Exact repo areas likely affected

- `apps/api/src/retirement-vault/*`
- `apps/api/src/review-cases/review-cases.service.ts`
- `apps/api/src/solvency/solvency.service.ts`
- `apps/worker/src/runtime/internal-worker-api-client.ts`
- `apps/worker/src/runtime/worker-orchestrator.ts`
- `apps/web/src/pages/Vault.tsx`
- admin console pages and API client types

### Backend work

- add release request creation
- classify request as normal unlock or early unlock
- enforce unlock eligibility and early unlock policy
- open review cases for early unlock or strict-mode release
- move approved requests into cooldown state
- settle `vault_redemption` intents on execution

### Frontend work

- add customer unlock request flow
- show explicit warnings for early unlock
- show cooldown timeline and release status

### Worker and background work

- list due vault release requests
- execute approved releases after cooldown
- mark failures idempotently

### Schema and model work

- finalize `RetirementVaultReleaseRequest`
- add any missing status fields or indexes for cooldown lookup

### Tests needed

- service tests for eligibility, approval, rejection, cooldown, and execution
- worker tests for due release processing
- UI tests for unlock request and cooldown states

### Risk points

- releasing funds before cooldown expiry
- allowing release during paused solvency posture
- mixing customer request state with operator decision state

### Definition of done

- normal unlock and early unlock both create governed release requests
- early unlock opens a review case
- approved release waits through cooldown and then executes through the worker
- liquid balance only returns after release settlement

## Phase 4: Admin Console, Restrictions, and Incident Safety

### Goal

Give operators first-class visibility and control over vault workflows, restrictions, and incident response.

### Why this phase comes now

Once release exists, operators need a visible control plane. The repo already treats sensitive flows as operational systems, not hidden jobs.

### Exact repo areas likely affected

- `apps/admin/src/App.tsx`
- new `apps/admin/src/pages/VaultsPage.tsx`
- `apps/admin/src/lib/api.ts`
- `apps/api/src/retirement-vault/*`
- `apps/api/src/oversight-incidents/oversight-incidents.service.ts`
- `apps/api/src/customer-account-operations/customer-account-operations.service.ts`

### Backend work

- add operator vault overview endpoints
- add pending unlock request listing and decision endpoints
- add incident-lock and restriction hooks
- add timeline and audit aggregation for vault events

### Frontend work

- add dedicated admin `Vaults` page
- add pending release queue, cooldown list, and incident-locked vault views
- link to review case and account timeline context

### Worker and background work

- add blocking behavior for incident-locked or restricted vaults

### Schema and model work

- only additive metadata if needed for operator reporting

### Tests needed

- admin page tests
- controller tests for operator decisions
- incident-lock integration tests

### Risk points

- operators not seeing enough context to decide unlock requests safely
- incident state failing to block queued release execution

### Definition of done

- operators can review, approve, reject, and monitor vault releases from the admin console
- incident locks prevent release execution
- vault activity appears in customer-account operational timelines

## Phase 5: Reconciliation, Solvency, and Rule Governance Hardening

### Goal

Fully integrate the vault into platform controls and tighten post-launch governance.

### Why this phase comes last

This phase deepens platform hardening after the core customer and operator loops already exist.

### Exact repo areas likely affected

- `apps/api/src/solvency/solvency.service.ts`
- `apps/api/src/ledger-reconciliation/ledger-reconciliation.service.ts`
- `apps/api/src/operations-monitoring/*`
- optional future rule-governance slices in `apps/api/src/retirement-vault/*`
- reporting surfaces in `apps/admin`

### Backend work

- include vault locked and pending-release liabilities in solvency calculations
- extend reconciliation mismatch generation for vault drift
- add alerts for stuck cooldowns, failed release execution, and vault drift
- optionally add dedicated rule-change request governance if product needs rule weakening later

### Frontend work

- add admin reporting and health indicators
- add customer trust-center or vault-explainer references if needed

### Worker and background work

- add stale workflow sweeps and alerting for blocked releases

### Schema and model work

- only additive hardening fields as required by operational evidence

### Tests needed

- solvency and reconciliation regression tests
- alert routing tests
- workflow timeout tests

### Risk points

- vault liabilities excluded from solvency proofs
- stale release requests silently aging without alerts
- overbuilding rule-governance before actual product need

### Definition of done

- vault balances are included in solvency and reconciliation posture
- stuck or inconsistent vault workflows generate operator-visible signals
- any future rule weakening path has explicit governance instead of silent mutation

## Recommended First Implementation Phase

The best first real implementation phase is `Phase 1: Vault Domain and Ledger Foundation`.

Why:

- it creates the money truth and state truth first
- it reuses the repo’s strongest existing patterns
- it avoids speculative UI work
- it keeps the first commit narrow enough to test thoroughly
