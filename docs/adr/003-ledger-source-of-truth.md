# ADR 003: Ledger Source of Truth

- Status: Accepted
- Date: 2026-03-28

## Context

The current repository has product tables for pools, deposits, and withdrawals, but it does not have a formal accounting core.

Without a clear source-of-truth model, the platform risks:
- ambiguous balances
- inconsistent read models
- hard-to-repair failures
- unclear reconciliation boundaries
- unsafe customer-facing balance presentation

The platform must distinguish between:
- authentication truth
- business truth
- blockchain settlement truth
- user-facing balance truth

## Decision

Version 1 will use the following truth model:

### Authentication truth
Supabase remains the authentication provider unless explicitly superseded later.

### Business truth
The platform database owns customer account state and business workflow state.

### Settlement truth
Confirmed blockchain state remains the settlement truth for on-chain value movement.

### Balance truth
A platform-managed double-entry ledger becomes the balance source of truth for:
- customer balances
- reserved balances
- pending balances
- product balances
- treasury-facing accounting views

Customer-facing balances must be derived from the ledger and its approved read models.

The application must not treat scattered domain tables, raw contract reads, or mocked UI state as the primary balance source of truth.

## Why This Decision

A financial product needs:
- reconstructable balance history
- repairable mismatches
- controlled pending and reserved states
- reconciliation between chain and business state

A ledger-based balance model provides those capabilities.

## Consequences

### Positive

- balance derivation becomes explicit
- reconciliation becomes possible
- finance-related UI can present truthful state
- operator repair flows can be built safely
- treasury accounting becomes auditable

### Negative

- more schema and service complexity is required
- customer-facing balances may reflect product states that are not visible from one raw chain call
- asynchronous settlement and reconciliation flows become first-class concerns

## Non-Goals

This decision does not:
- define the exact ledger schema yet
- define exact journal account names yet
- replace blockchain settlement truth
- authorize silent ledger overrides without audit trails

## Implementation Implications

Later phases must:
- add journal tables
- add balance materialization
- add reconciliation jobs
- add mismatch reporting
- ensure that product screens read from approved read models instead of ad hoc joins or mocks
