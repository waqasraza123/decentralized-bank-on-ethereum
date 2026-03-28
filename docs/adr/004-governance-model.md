# ADR 004: Governance Model

- Status: Accepted
- Date: 2026-03-28

## Context

The current repository direction still assumes prototype-style privileged control, which is not appropriate for a production financial platform.

The platform needs a governance model for:
- contract ownership
- treasury control
- emergency pause capability
- deployment ownership handoff
- separation of operational roles

If this remains undefined, later implementation work will hardcode unsafe assumptions into:
- contracts
- deployment scripts
- backend services
- admin tooling

## Decision

Version 1 will use a separated governance model with explicit privileged roles.

### Core principle
No critical production control may rely solely on one raw application key.

### Governance boundaries

#### Treasury and contract ownership
Treasury authority and critical contract ownership must sit behind multisig control.

#### Application runtime
Application runtime may execute narrowly scoped operational actions, but it must not be treated as the final authority for treasury or governance.

#### Emergency controls
Emergency pause capability must exist, but it must be clearly separated from broader treasury and governance powers.

#### Role separation
The governance model must separate at least:
- deploy authority
- treasury authority
- operational execution authority
- emergency pause authority
- upgrade authority if upgradeability is introduced
- audit and review visibility

#### Ownership handoff
Production deployments must include a documented ownership handoff from deploy-time authority to the approved governance owner.

## Why This Decision

This platform needs:
- safer privileged control
- auditable governance boundaries
- operational separation
- a deployment model that does not freeze unsafe ownership assumptions into production

## Consequences

### Positive

- privileged powers become explicit
- backend implementation can be designed around narrow authority rather than hidden superuser behavior
- contract and treasury operations become easier to reason about
- admin tooling can reflect real operational roles

### Negative

- deployment and operations become more deliberate
- some actions that are easy in a prototype require formal ownership and review design
- operational runbooks become necessary earlier

## Non-Goals

This decision does not:
- force a specific multisig implementation detail in this phase
- finalize upgradeability
- define exact signer composition yet
- replace the need for later incident runbooks

## Implementation Implications

Later phases must:
- remove assumptions that the API owns final privileged authority
- design deployment scripts and manifests around ownership transfer
- add emergency control handling
- reflect role separation in admin APIs and operational tooling
