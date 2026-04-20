# Retirement Vault Current-State Assessment

This assessment documents the live repo surfaces and patterns that a `Retirement Vault` feature should reuse.

## Evidence Rules

Confirmed repo evidence means the behavior or shape exists in live code or live schema.

Proposed addition means the shape does not yet exist in the live repo and would need implementation.

## 1. Account, Wallet, and Balance Primitives

Confirmed repo evidence:

- `Customer`, `CustomerAccount`, `CustomerAuthSession`, `Wallet`, `Asset`, and `CustomerAssetBalance` are live in `apps/api/prisma/schema.prisma`.
- `CustomerAccount` already owns lifecycle restriction fields such as `status`, `restrictedAt`, `restrictedFromStatus`, `restrictedByOversightIncidentId`, and release metadata in `apps/api/prisma/schema.prisma`.
- `Wallet` already distinguishes `kind`, `custodyType`, and `status`, which matters because vault release must not bypass custody controls.
- `CustomerBalancesService.listMyBalances` returns account-scoped, asset-aware balance projections from `CustomerAssetBalance` in `apps/api/src/customer-balances/customer-balances.service.ts`.

Implication for Retirement Vault:

- the vault should attach to `CustomerAccount`, not to a loose wallet identity
- vault funding and release should be asset-aware
- liquid balances and locked vault balances should stay distinct

## 2. Ledger and Accounting Primitives

Confirmed repo evidence:

- `LedgerAccount`, `LedgerJournal`, and `LedgerPosting` are live in `apps/api/prisma/schema.prisma`.
- current ledger account types already separate customer available liability and pending withdrawal liability with `customer_asset_liability` and `customer_asset_pending_withdrawal_liability` in `apps/api/prisma/schema.prisma`.
- `LedgerService.reserveWithdrawalBalance` moves value from available to pending and writes a `withdrawal_reservation` journal in `apps/api/src/ledger/ledger.service.ts`.
- `LedgerService.releaseWithdrawalReservation` reverses that reservation in `apps/api/src/ledger/ledger.service.ts`.
- `LedgerService.settleConfirmedWithdrawal` clears pending liability into outbound clearing in `apps/api/src/ledger/ledger.service.ts`.
- `LedgerService.settleConfirmedDeposit` credits customer liability from inbound clearing in `apps/api/src/ledger/ledger.service.ts`.

Implication for Retirement Vault:

- the vault should be implemented as another internal liability classification, not as a fake UI-only bucket
- vault funding should use a ledger journal that debits liquid customer liability and credits locked vault liability
- vault release should only restore liquid availability through another explicit journal

## 3. Transaction Intent Primitives

Confirmed repo evidence:

- `TransactionIntent` already exists with `intentType`, `status`, `policyDecision`, idempotency, failure metadata, manual intervention links, and blockchain relations in `apps/api/prisma/schema.prisma`.
- live `TransactionIntentType` already includes `vault_subscription` and `vault_redemption` in `apps/api/prisma/schema.prisma`.
- customer deposit requests create intents with idempotency and optional manual-intervention review cases in `apps/api/src/transaction-intents/transaction-intents.service.ts`.
- customer withdrawal requests create intents, reserve balances immediately, and audit the request in `apps/api/src/transaction-intents/withdrawal-intents.service.ts`.
- withdrawal approvals, execution claiming, broadcast, confirmation, failure handling, and settlement already form a mature stateful flow in `apps/api/src/transaction-intents/withdrawal-intents.service.ts`.
- customer transaction history reads generic `TransactionIntent` rows in `apps/api/src/transaction-intents/transaction-operations.service.ts`.

Confirmed repo gap:

- the web hook and formatter types only accept `deposit` and `withdrawal` intent types today in `apps/web/src/hooks/transactions/useMyTransactionHistory.ts` and `apps/web/src/lib/customer-finance.ts`

Implication for Retirement Vault:

- vault funding and release should use `TransactionIntent` so the feature lands in existing history, audit, idempotency, and operator search paths
- the current generic backend supports this direction better than the current frontend types do

## 4. Review, Approval, and Manual Investigation Patterns

Confirmed repo evidence:

- `ReviewCase` and `ReviewCaseEvent` are live in `apps/api/prisma/schema.prisma`.
- `ReviewCasesService.openOrReuseReviewCase` already opens reusable cases with event and audit emission in `apps/api/src/review-cases/review-cases.service.ts`.
- `ReviewCasesService.getReviewCaseWorkspace` already composes case details, case events, related transaction audits, ledger-backed balances, and recent intents in `apps/api/src/review-cases/review-cases.service.ts`.
- review cases already support `started`, `note_added`, `handed_off`, `manual_resolution_applied`, `resolved`, and `dismissed` event trails.
- manual resolution is intentionally blocked for settled money-truth states in `apps/api/src/review-cases/review-cases.service.ts`.

Implication for Retirement Vault:

- early unlock should open a dedicated review case instead of inventing a new review stack
- vault release review should inherit the same operator ownership, notes, handoff, and audit model
- the feature should never allow a review-only action to mutate money state without explicit release execution

## 5. Restriction, Hold, and Incident Patterns

Confirmed repo evidence:

- `OversightIncident`, `OversightIncidentEvent`, and `CustomerAccountRestriction` are live in `apps/api/prisma/schema.prisma`.
- `OversightIncidentsService.applyAccountRestriction` already creates a restriction record, moves the account to `restricted`, opens a linked release review case, and writes incident and audit events in `apps/api/src/oversight-incidents/oversight-incidents.service.ts`.
- `AccountRestrictionReleaseReviewService.requestAccountRelease` and `decideAccountRelease` already separate request from decision, require pending review state, and restore account status only after approval in `apps/api/src/review-cases/account-restriction-release-review.service.ts`.

Implication for Retirement Vault:

- vault-specific incident locking should reuse this pattern instead of inventing custom emergency toggles
- if an unlock request becomes suspicious, the platform already knows how to freeze the containing account or vault-adjacent workflow
- rule changes and early unlocks should copy the existing request/approve separation used for account restriction release

## 6. Solvency, Pause, and Policy Controls

Confirmed repo evidence:

- `SolvencySnapshot`, `SolvencyAssetSnapshot`, `SolvencyLiabilityLeaf`, `SolvencyPolicyState`, and `SolvencyPolicyResumeRequest` are live in `apps/api/prisma/schema.prisma`.
- `SolvencyService.generateSnapshot` already computes liabilities, reserve evidence, reconciliation posture, and signed reports in `apps/api/src/solvency/solvency.service.ts`.
- `SolvencyService.assertWithdrawalApprovalAllowed` and `assertManagedWithdrawalExecutionAllowed` already block downstream withdrawal actions when policy is paused in `apps/api/src/solvency/solvency.service.ts`.
- paused solvency policy already opens a manual-intervention review case automatically in `apps/api/src/solvency/solvency.service.ts`.

Implication for Retirement Vault:

- vault release must respect solvency posture because it increases liquid customer liability
- vault locked balances should count toward liability proofs and solvency snapshots
- the vault should not invent a second pause system when solvency policy already exists

## 7. Treasury and Governed Execution Controls

Confirmed repo evidence:

- `GovernedExecutionOverrideRequest` and `GovernedTreasuryExecutionRequest` are live in `apps/api/prisma/schema.prisma`.
- governed overrides already require request and approval separation and prevent self-approval in `apps/api/src/governed-execution/governed-execution.service.ts`.
- managed withdrawal execution already checks governed execution posture before worker execution in `apps/api/src/transaction-intents/withdrawal-intents.service.ts`.
- reserve wallet posture is exposed through treasury and governed execution workspaces in `apps/api/src/treasury/treasury.service.ts` and `apps/api/src/governed-execution/governed-execution.service.ts`.

Implication for Retirement Vault:

- the vault does not need a new treasury authority plane for normal internal lock and release
- any future externalized vault treasury action should use governed execution, not ad hoc server writes
- early unlock should stay on the product-control side unless a later phase adds an on-chain vault contract

## 8. Reconciliation, Repair, and Audit Patterns

Confirmed repo evidence:

- `LedgerReconciliationMismatch` and `LedgerReconciliationScanRun` are live in `apps/api/prisma/schema.prisma`.
- reconciliation already supports mismatch detection, replay approvals, repair actions, and review case linkage in `apps/api/src/ledger-reconciliation/ledger-reconciliation.service.ts`.
- `AuditEvent` is generic and already searchable across actor, action, target, customer, and date in `apps/api/src/audit-events/audit-events.service.ts`.
- `CustomerAccountOperationsService` already builds unified customer timelines from intents, review cases, incidents, and restrictions in `apps/api/src/customer-account-operations/customer-account-operations.service.ts`.

Implication for Retirement Vault:

- every vault mutation should emit `AuditEvent`
- vault events should appear in the customer account operations timeline
- vault balance drift should plug into reconciliation rather than being debugged manually

## 9. Worker and Background Orchestration

Confirmed repo evidence:

- `WorkerOrchestrator.runOnce` already polls queued deposit and withdrawal work, confirmation work, governed execution dispatch, loan work, and alert re-escalation in `apps/worker/src/runtime/worker-orchestrator.ts`.
- the worker already uses internal authenticated API calls for each stage through `apps/worker/src/runtime/internal-worker-api-client.ts`.
- worker heartbeats and health are persisted in `WorkerRuntimeHeartbeat` in `apps/api/prisma/schema.prisma`.

Implication for Retirement Vault:

- cooldown expiry and approved release execution belong in the worker, not in a browser client or manual operator action
- the vault can use the same polling and idempotent internal-controller pattern as other async flows

## 10. Customer-Facing Surfaces

Confirmed repo evidence:

- web routes currently expose `/`, `/transactions`, `/wallet`, `/yield`, `/profile`, `/trust/solvency`, and `/proofs/me` in `apps/web/src/App.tsx`
- the web dashboard already has a large hero, operational freshness messaging, trust-language blocks, and activity cards in `apps/web/src/pages/Index.tsx`
- the web wallet page already distinguishes available vs pending balances and places deposit and withdrawal controls prominently in `apps/web/src/pages/Wallet.tsx`
- mobile tabs currently expose `Dashboard`, `Wallet`, `Yield`, `Transactions`, and `Profile` in `apps/mobile/src/navigation/AppNavigator.tsx`
- the mobile dashboard already has a bold hero plus primary action cards in `apps/mobile/src/screens/DashboardScreen.tsx`
- the mobile wallet screen already uses MFA and session-security checks before withdrawal in `apps/mobile/src/screens/WalletScreen.tsx`

Implication for Retirement Vault:

- the feature can be made highly visible without redesigning the product shell
- the strongest placements are the dashboard hero, wallet summary, transaction history, and a dedicated vault screen
- mobile can surface the vault immediately from the dashboard and wallet without disrupting the existing tab bar on day one

## 11. Admin and Operator Surfaces

Confirmed repo evidence:

- the admin console already has first-class routes for `Queues`, `Accounts & Reviews`, `Governed Execution`, `Solvency`, `Reconciliation`, `Treasury`, `Alerts & Incidents`, and `Audit Trail` in `apps/admin/src/App.tsx`
- `QueuesPage` already manages review cases, manual resolutions, and account release decisions in `apps/admin/src/pages/QueuesPage.tsx`
- `AccountsPage` already manages oversight incidents and account holds in `apps/admin/src/pages/AccountsPage.tsx`
- `ReconciliationPage`, `TreasuryPage`, and `GovernedExecutionPage` already give operators stateful operational workspaces

Implication for Retirement Vault:

- the admin console already has the right design language and query/mutation patterns for a vault review page
- phase 1 can reuse existing queues and accounts pages indirectly, but the feature is visible enough to justify a dedicated `Vaults` page once unlock workflows exist

## 12. Existing Vault Direction in Repo History

Confirmed repo evidence:

- `docs/architecture/target-system.md` already describes vaults as a target customer surface and domain area
- `docs/architecture/data-model-target.md` already describes vault products and vault subscription/redemption intent types
- `docs/architecture/proposed-phase-2-schema.md` includes a planned `VaultProduct` and planned `vault_subscription` and `vault_redemption` intent types

Confirmed repo gap:

- those vault product documents are planning artifacts, not live implementation
- the live Prisma schema currently has the intent enum values but not a live vault table

Implication for Retirement Vault:

- this feature extends an existing repo direction
- the implementation should stay narrow and account-centric instead of trying to ship the older generic vault-product planning document wholesale

## Direct Reuse vs Extension

Direct reuse:

- `TransactionIntent` idempotency, audit, and history patterns
- `LedgerService` journal/posting structure
- `ReviewCasesService` workspace and case lifecycle
- `AccountRestrictionReleaseReviewService` request/approve release pattern
- `OversightIncidentsService` restriction and incident lock pattern
- `SolvencyService` pause checks and liability reporting
- worker polling and internal API orchestration
- admin console workspace primitives and query/mutation structure

Requires extension:

- new vault domain tables
- new ledger account and journal types for locked funds
- transaction history frontend types beyond `deposit` and `withdrawal`
- customer vault snapshot and dedicated vault UI
- admin vault overview and release queue
- worker slice for cooldown expiry and release execution
- reconciliation and customer timeline support for vault-specific events

## Recommended Architectural Fit

The best fit is a new `apps/api/src/retirement-vault` domain module that:

- stores vault rule and release workflow state in new vault tables
- reuses `TransactionIntent` for `vault_subscription` and `vault_redemption`
- extends `LedgerService` for liquid-to-locked and locked-to-liquid transfers
- opens `ReviewCase` records for early unlock and high-risk release actions
- uses `OversightIncident` and `CustomerAccountRestriction` only when vault release becomes suspicious or unsafe
- uses the worker for cooldown expiry and release execution

That shape stays inside the current repo’s strongest patterns instead of introducing a parallel product architecture.
