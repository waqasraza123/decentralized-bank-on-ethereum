# Retirement Vault Feature Spec

This document defines the proposed `Retirement Vault` feature in a way that fits the current Stealth Trails Bank architecture.

## Product Definition

`Retirement Vault` is a customer-controlled, rule-based lockbox for long-term funds inside the existing product.

It is not a regulated retirement account product.

It is an internal protected balance state with governed release.

Core behavior:

- a customer creates a vault for a supported asset inside their existing account
- funding the vault moves liquid balance into a locked vault balance
- locked vault funds are not withdrawable through the normal wallet withdrawal flow
- release returns funds back to the customer’s liquid balance only when vault rules are satisfied
- early unlock is intentionally high-friction, delayed, reviewable, and auditable
- rule weakening is intentionally restricted

## Feature Goals

- make long-term protection visible and emotionally strong in the product
- prevent casual self-sabotage by keeping locked funds outside normal available balance
- reuse the platform’s existing operational strengths: audit, review, holds, solvency, reconciliation, worker execution, and operator console workflows
- keep customer trust language bold and serious without making unsupported regulatory claims

## Non-Goals

- no IRA, 401(k), pension, or regulated tax treatment claims
- no age-based unlock logic in phase 1 because the live repo has no DOB/KYC age model
- no beneficiary or trusted-contact release in phase 1 because the live repo has no customer contact model
- no on-chain vault contract requirement in phase 1
- no product-wide rebrand away from the current bank and governed-custody posture

## Confirmed Repo Constraints

- live balances are currently modeled as `availableBalance` and `pendingBalance` in `CustomerAssetBalance`, so locked vault funds should not be stuffed into the same liquid read model without a clear distinction
- transaction history backend can already emit generic `TransactionIntent` records, but the current web/mobile frontend types only understand `deposit` and `withdrawal`
- the current repo already has request/review/approve separation for sensitive release decisions
- the current repo already blocks sensitive flows through solvency and governed execution checks

## Proposed Domain Model

Confirmed repo evidence:

- no live vault table exists yet
- live transaction intent types already reserve `vault_subscription` and `vault_redemption`

Proposed addition:

### `RetirementVault`

One active vault per `customerAccountId + assetId`.

Recommended fields:

- `id`
- `customerAccountId`
- `assetId`
- `status`
- `releaseState`
- `protectionMode`
- `strictMode`
- `lockRuleType`
- `lockEstablishedAt`
- `unlockAt`
- `minimumLockDurationDays`
- `earlyUnlockAllowed`
- `earlyUnlockCooldownDays`
- `earlyUnlockReviewRequired`
- `ruleChangePolicy`
- `lockedBalance`
- `pendingReleaseBalance`
- `lastFundedAt`
- `lastReleaseRequestedAt`
- `lastReleasedAt`
- `createdAt`
- `updatedAt`

Recommended uniqueness:

- unique active vault per `customerAccountId + assetId`

### `RetirementVaultReleaseRequest`

Tracks each normal or early release attempt.

Recommended fields:

- `id`
- `retirementVaultId`
- `requestType`
- `status`
- `requestedAmount`
- `reasonCode`
- `customerNote`
- `evidencePayload`
- `requestedByActorType`
- `requestedByActorId`
- `requestedAt`
- `eligibilitySnapshot`
- `reviewCaseId`
- `oversightIncidentId`
- `cooldownStartsAt`
- `cooldownEndsAt`
- `approvedByOperatorId`
- `approvedByOperatorRole`
- `approvedAt`
- `rejectedByOperatorId`
- `rejectedByOperatorRole`
- `rejectedAt`
- `rejectionReason`
- `executedByWorkerId`
- `executedAt`
- `cancelledAt`
- `expiredAt`
- `idempotencyKey`
- `createdAt`
- `updatedAt`

### `RetirementVaultEvent`

Mirrors the repo’s existing event-table pattern used by `ReviewCaseEvent` and `OversightIncidentEvent`.

Recommended fields:

- `id`
- `retirementVaultId`
- `actorType`
- `actorId`
- `eventType`
- `note`
- `metadata`
- `createdAt`

### `TransactionIntent` extension

Recommended addition:

- nullable `retirementVaultId`

Why:

- reuse existing history, search, idempotency, and audit patterns for `vault_subscription` and `vault_redemption`

## Rules Model

Keep the first production rules model narrow.

### Phase 1 rule set

- `lockRuleType`
  - `fixed_date`
  - `minimum_duration`
- `unlockAt`
  - computed at creation time
- `minimumLockDurationDays`
- `strictMode`
  - default `true`
- `earlyUnlockAllowed`
  - default `true`
- `earlyUnlockCooldownDays`
  - default longer in strict mode
- `earlyUnlockReviewRequired`
  - default `true`
- `ruleChangePolicy`
  - phase 1 default: `extend_only`

### Explicitly deferred rule types

- age-based eligibility
  - deferred because no live age or DOB data model exists
- beneficiary release
  - deferred because no live contact model exists
- trusted-contact dual approval
  - deferred for the same reason

### Early unlock categories

Use a narrow enum-like reason code list in phase 2:

- `hardship`
- `medical`
- `family_emergency`
- `legal_order`
- `operator_exception`

Evidence should be text-and-metadata only in the first release because the repo does not currently have a customer-uploaded binary evidence system.

## State Model

Use two fields, not one overloaded enum. This matches current repo patterns such as restriction `status` plus release decision status.

### Proposed `RetirementVault.status`

- `funding_pending`
- `active`
- `released`
- `restricted`
- `incident_locked`
- `cancelled`

### Proposed `RetirementVault.releaseState`

- `locked`
- `unlock_eligible`
- `unlock_requested`
- `review_pending`
- `cooldown_active`
- `approved_for_release`
- `rejected`

### Proposed `RetirementVaultReleaseRequest.status`

- `requested`
- `review_pending`
- `cooldown_active`
- `approved`
- `rejected`
- `executed`
- `cancelled`
- `expired`

### Main transitions

Funding:

- `funding_pending` + `locked`
- funding settles
- `active` + `locked`

Normal release:

- rules satisfied
- vault becomes `active` + `unlock_eligible`
- customer requests release
- release request enters `requested`
- if review is not required, move directly to `cooldown_active`
- after cooldown, worker executes release
- vault remains `active` if partial balance remains, otherwise `released`

Early release:

- customer requests before `unlockAt`
- request enters `review_pending`
- review case opens
- operator approves or rejects
- approved request enters `cooldown_active`
- worker executes only after cooldown and final policy checks

Incident path:

- vault can move to `incident_locked`
- related release requests are blocked or cancelled
- account-level restriction may also be applied through existing hold governance if needed

## Money Model

The vault should not behave like a normal wallet or generic balance bucket.

Recommended accounting rule:

- liquid customer balance remains in existing `CustomerAssetBalance.availableBalance`
- vault funding moves value out of liquid liability and into locked vault liability
- vault release moves value back into liquid available balance only after governed release
- normal chain withdrawal then remains a separate second step

This is the cleanest way to guarantee that normal withdrawals cannot bypass the vault.

## Proposed Ledger Extensions

Recommended new `LedgerAccountType` values:

- `customer_retirement_vault_locked_liability`
- `customer_retirement_vault_pending_release_liability`

Recommended new `LedgerJournalType` values:

- `retirement_vault_funding`
- `retirement_vault_release_request`
- `retirement_vault_release_reversal`
- `retirement_vault_release_settlement`

Recommended ledger behavior:

- funding:
  - debit `customer_asset_liability`
  - credit `customer_retirement_vault_locked_liability`
- approved release entering cooldown:
  - debit `customer_retirement_vault_locked_liability`
  - credit `customer_retirement_vault_pending_release_liability`
- rejected or cancelled release:
  - debit `customer_retirement_vault_pending_release_liability`
  - credit `customer_retirement_vault_locked_liability`
- executed release:
  - debit `customer_retirement_vault_pending_release_liability`
  - credit `customer_asset_liability`

Read-model effect:

- `CustomerAssetBalance.availableBalance` only changes on funding and final release
- vault-specific `lockedBalance` and `pendingReleaseBalance` live on `RetirementVault`

## Backend Shape

Recommended new API module:

- `apps/api/src/retirement-vault`

Recommended slices:

- `retirement-vault.controller.ts`
  - customer create/fund/view/request-release endpoints
- `retirement-vault.internal.controller.ts`
  - operator list/review actions
- `retirement-vault.worker.controller.ts`
  - due cooldown execution
- `retirement-vault.service.ts`
  - core orchestration
- `dto/*`
  - explicit request validation

Recommended integrations:

- extend `LedgerService` for vault journals
- call `ReviewCasesService.openOrReuseReviewCase` for early unlock review
- call `SolvencyService.assertWithdrawalApprovalAllowed` before approval of a release that would restore liquid balance
- optionally call `OversightIncidentsService.applyAccountRestriction` if an unlock request becomes suspicious
- emit `AuditEvent` for every funding, request, review, cooldown, rejection, execution, and rule update event

## Worker Planning

Recommended worker responsibility:

- list approved vault release requests whose cooldown has expired
- execute release settlement idempotently
- retry safely
- mark failures and open manual-intervention review cases when release execution cannot complete cleanly

Why the worker should own this:

- the repo already uses the worker for delayed and stateful money workflows
- cooldown expiry is operational state, not a browser concern

## Reconciliation and Solvency Fit

Recommended behavior:

- treat locked vault balance as customer liability, but not as liquid available balance
- include vault locked and pending-release balances in solvency liability computation
- extend customer-balance reconciliation to compare liquid plus vault projections against ledger liability totals
- include vault identifiers in mismatch metadata rather than adding a separate reconciliation stack first

## Customer UI Plan

The vault must be highly visible.

### Web

Recommended placements:

- add a large `Retirement Vault` hero card on the dashboard above or beside the current trust-heavy hero
- add a dedicated `/vault` page
- add a locked-funds summary strip on `/wallet`
- add vault funding and release history in `/transactions`

Recommended customer-visible states:

- `Locked until <date>`
- `Protection mode active`
- `Unlock eligible`
- `Unlock review pending`
- `Cooldown active`
- `Approved for release`
- `Incident locked`

Recommended visual treatment:

- darker, more protective shell than normal wallet cards
- language centered on protection, governed release, future lock, and safeguarded funds
- timeline treatment for release requests, not a simple success toast

### Mobile

Recommended placements:

- add a prominent dashboard feature card
- add a wallet surface for locked funds and transfer into vault
- add a dedicated vault screen in the signed-in stack without replacing the existing tabs on the first pass

## Admin and Operator UI Plan

Recommended admin page:

- `apps/admin/src/pages/VaultsPage.tsx`

Recommended surfaces:

- vault overview
- pending unlock requests
- cooldown queue
- release decisions
- restricted and incident-locked vaults
- audit trail and linked review case visibility
- link-outs to account timeline, solvency posture, and treasury posture

Why a dedicated page is justified:

- the feature is supposed to be highly visible
- unlock governance is too important to bury only inside generic queues

## Copy and Product Language

Use:

- `Retirement Vault`
- `Protected vault`
- `Locked funds`
- `Governed release`
- `Pending unlock`
- `Cooldown`
- `Review-required unlock`
- `Protection mode`
- `Future lock`
- `Safeguarded long-term funds`

Avoid:

- regulated retirement-plan labels
- tax-advantaged language
- casual savings language
- gamified or gimmicky copy

## Rule Change Governance

Phase 1 recommendation:

- allow only rule-tightening changes from the customer side
- allow extending the unlock date or increasing cooldown, after MFA/session checks
- do not allow customer-side rule weakening
- any future rule weakening should use a dedicated operator-reviewed request flow in a later phase

This keeps the first release narrow and honest while still meeting the requirement that rule changes be restricted.
