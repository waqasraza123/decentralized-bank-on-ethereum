# ADR 002: Custody Model

- Status: Accepted
- Date: 2026-03-28

## Context

The prototype currently relies on a server-side private key model for important blockchain operations.

That is not a production-safe custody or treasury model for a professional financial platform.

The platform needs a custody model that supports:
- customer operations
- policy enforcement
- treasury separation
- auditability
- operational safety
- future smart-account compatibility

## Decision

Version 1 will use a hybrid platform-mediated custody model.

This means:
- customer product actions are mediated by the platform backend and policy layer
- customer business balances are represented in the platform ledger
- customer blockchain activity is not modeled as direct unmanaged self-custody by default
- treasury and privileged operational control must be separated from normal application runtime
- the platform must not rely on one raw application private key as the root custody authority

Custody boundaries for version 1:

### Customer layer
The platform owns the business workflow for:
- account activation
- deposit recognition
- withdrawal initiation
- withdrawal review and release
- product subscription and redemption state

### Operational execution layer
A limited operational signing path may exist for narrowly scoped automated actions, but it must not be treated as the ultimate authority for treasury or contract governance.

### Treasury and governance layer
Treasury and high-risk contract control must sit behind multisig-controlled ownership and explicit operational procedures.

### Future compatibility
The product should be designed so customer-facing wallet architecture can evolve toward stronger smart-account compatibility without redefining the rest of the platform.

## Why This Decision

Version 1 needs:
- practical operational control
- policy enforcement for withdrawals and sensitive actions
- an auditable platform balance model
- separation between application runtime and treasury authority

A pure self-custody model would not align well with the current product direction, admin needs, or planned operational controls.

A pure single-key custodial runtime model is not acceptable.

A hybrid platform-mediated model is the safest practical transition path for this repository.

## Consequences

### Positive

- product flows can be policy-gated
- customer balances can be managed through a ledger model
- treasury control can be separated from application runtime
- admin review and incident handling become possible
- future smart-account evolution remains possible

### Negative

- custody responsibilities become an explicit platform concern
- more operational and compliance obligations are created
- withdrawal and treasury workflows require stronger controls from the beginning

## Non-Goals

This decision does not:
- finalize every wallet vendor or signer implementation
- authorize loose secret handling
- imply that a single hot wallet is acceptable as the final treasury model
- require immediate full smart-account rollout in the first code phase

## Implementation Implications

Later phases must:
- define hot, warm, and reserve fund boundaries
- remove the implicit assumption that one app key controls everything
- add withdrawal policy checks
- add operator review capabilities
- keep customer balance state ledger-backed rather than key-backed
