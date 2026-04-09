# Staking Pool Governance API

## Purpose

This runbook covers the governed internal workflow for staking pool creation.

Pool creation is no longer a one-step privileged write. It now requires:

- a durable governance request
- approval by a different operator
- explicit execution after approval

That gives the staking control plane a basic separation-of-duties boundary and
durable retry state for failed contract writes.

## Internal authentication

Required headers:

- `x-operator-api-key`
- `x-operator-id`
- `x-operator-role`

Runtime policy:

- `STAKING_POOL_GOVERNANCE_REQUEST_ALLOWED_OPERATOR_ROLES`
- `STAKING_POOL_GOVERNANCE_APPROVER_ALLOWED_OPERATOR_ROLES`
- `STAKING_POOL_GOVERNANCE_EXECUTOR_ALLOWED_OPERATOR_ROLES`

The older `STAKING_GOVERNANCE_ALLOWED_OPERATOR_ROLES` variable is still accepted
as a fallback for request-role defaults.

## Endpoints

- `GET /staking/internal/pool-governance-requests`
- `GET /staking/internal/pool-governance-requests/:requestId`
- `POST /staking/internal/pool-governance-requests`
- `POST /staking/internal/pool-governance-requests/:requestId/approve`
- `POST /staking/internal/pool-governance-requests/:requestId/reject`
- `POST /staking/internal/pool-governance-requests/:requestId/execute`

Compatibility note:

- `POST /staking/create-pool` now creates a governance request only
- it no longer performs the contract write directly

## Requesting pool creation

Endpoint:

```text
POST /staking/internal/pool-governance-requests
```

Example body:

```json
{
  "rewardRate": 12,
  "requestNote": "Treasury-approved new base-yield pool."
}
```

Expected behavior:

- rejects callers whose operator role is not allowed to request governance changes
- creates a durable `StakingPoolGovernanceRequest` in `pending_approval`
- writes `AuditEvent.action = staking.pool_creation.requested`

## Approving or rejecting

Approval endpoint:

```text
POST /staking/internal/pool-governance-requests/:requestId/approve
```

Rejection endpoint:

```text
POST /staking/internal/pool-governance-requests/:requestId/reject
```

Approval behavior:

- only `pending_approval` requests can be approved
- requester self-approval is blocked
- writes `AuditEvent.action = staking.pool_creation.approved`

Rejection behavior:

- only `pending_approval` requests can be rejected
- writes `AuditEvent.action = staking.pool_creation.rejected`

## Executing an approved request

Endpoint:

```text
POST /staking/internal/pool-governance-requests/:requestId/execute
```

Example body:

```json
{
  "executionNote": "Executed through treasury signer after approval."
}
```

Expected behavior:

- only `approved` or prior `execution_failed` requests can execute
- creates or reuses the linked local `StakingPool`
- sets `blockchainPoolId` to the local pool identifier before contract submission
- submits the contract write through the configured staking write wallet
- records the resulting transaction hash when available
- writes:
  - `AuditEvent.action = staking.pool.executed` or `staking.pool.execution_failed`
  - `AuditEvent.action = staking.pool_creation.executed` or `staking.pool_creation.execution_failed`

Failure behavior:

- failed execution moves the request to `execution_failed`
- the linked local pool id is preserved for retry
- a later execute call can retry the same approved request instead of creating a new pool id

## Production note

This is materially stronger than the previous single-key role gate, but it is
still application-layer governance. It does not replace contract-level multisig
ownership, signer custody hardening, or full treasury handoff.
