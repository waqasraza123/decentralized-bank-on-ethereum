# Retirement Vault Roadmap

This roadmap defines a code-grounded implementation plan for a new `Retirement Vault` feature inside the existing Stealth Trails Bank product.

It is intentionally anchored in the live repo, not a speculative product brief. Every recommendation in this folder starts from current code and current operational patterns.

## Why This Feature Fits

`Retirement Vault` fits the repo because the product already behaves like a governed custody system rather than a simple wallet:

- customer balances are account-scoped and ledger-backed in `apps/api/prisma/schema.prisma`
- withdrawals already reserve funds, require operator approval, and settle through worker and ledger flows in `apps/api/src/transaction-intents/withdrawal-intents.service.ts` and `apps/api/src/ledger/ledger.service.ts`
- review queues, hold governance, oversight incidents, and account release decisions already exist in `apps/api/src/review-cases/*` and `apps/api/src/oversight-incidents/*`
- treasury execution already uses governed overrides and dispatch controls in `apps/api/src/governed-execution/governed-execution.service.ts`
- solvency policy can already pause approvals and managed execution in `apps/api/src/solvency/solvency.service.ts`
- customer and operator UIs already emphasize trust, visibility, state clarity, and operational seriousness in `apps/web`, `apps/mobile`, and `apps/admin`

The live schema also already reserves transaction intent types for `vault_subscription` and `vault_redemption` in `apps/api/prisma/schema.prisma`, and earlier architecture docs already mention vaults in `docs/architecture/target-system.md`, `docs/architecture/data-model-target.md`, and `docs/architecture/proposed-phase-2-schema.md`.

## Repo Evidence Summary

Confirmed current repo evidence:

- Account primitives: `Customer`, `CustomerAccount`, `Wallet`, `Asset`, `CustomerAssetBalance`
- Money movement primitives: `TransactionIntent`, `BlockchainTransaction`, `LedgerAccount`, `LedgerJournal`, `LedgerPosting`
- Review and release controls: `ReviewCase`, `ReviewCaseEvent`, `CustomerAccountRestriction`, `CustomerAccountRestrictionReleaseDecisionStatus`
- Incident and pause controls: `OversightIncident`, `SolvencyPolicyState`, `GovernedExecutionOverrideRequest`
- Worker orchestration: `apps/worker/src/runtime/worker-orchestrator.ts`
- Operator surfaces: queues, accounts, reconciliation, treasury, governed execution, alerts, audit
- Customer surfaces: dashboard, wallet, transactions, yield, trust/proof, mobile equivalents

Confirmed gaps:

- no generalized `VaultProduct` platform model exists yet; the live build is still specifically `RetirementVault`
- DOB/KYC age and trusted-contact profile foundation now exist, but vault age-based unlock, beneficiary release, and trusted-contact dual-approval flows are still deferred
- release evidence is still text-and-metadata only; there is no customer-uploaded binary evidence pipeline yet
- no on-chain vault contract or external custody rail is in scope for the live implementation

## Recommended Product Shape

Phase this as a locked internal balance system, not a new external custody rail:

- funding moves money from liquid customer liability into a locked vault liability
- release moves money back from locked vault liability into normal available balance
- standard withdrawals continue to work only from available balance, so vault funds cannot bypass protection
- early unlock uses existing repo patterns: review case, audit trail, cooldown, operator separation, optional account restriction, and worker execution

## Recommended First Real Build Step

Start with Phase 1 from [phases.md](./phases.md): add the vault domain model and ledger foundation without exposing early unlock yet.

That first build step should:

- add `RetirementVault` and `RetirementVaultReleaseRequest` schema tables
- extend `TransactionIntent` with a nullable vault link and reuse `vault_subscription` and `vault_redemption`
- extend `LedgerService` with internal lock and release journal methods
- expose a read-only customer vault snapshot endpoint

This is the narrowest step that creates real product truth without forcing UI or operator workflow decisions too early.

## Files

- [Current State Assessment](./current-state-assessment.md)
- [Feature Spec](./feature-spec.md)
- [Phases](./phases.md)
