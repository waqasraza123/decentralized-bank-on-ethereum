# Withdrawal Intent Execution API

## Purpose

This runbook covers the first post-approval execution slice for withdrawal transaction intents.

This slice lets the system move from approved review state into worker-owned execution state.

It covers:

- operator queueing
- worker queued fetch
- worker broadcast recording
- worker execution failure recording

The reserved balance remains pending through queueing and broadcast.

If worker execution fails, the reservation is released back to `availableBalance`.

## Internal authentication

Operator endpoints require:

- `x-operator-api-key`
- `x-operator-id`
- `x-operator-role` for mutation endpoints

Worker endpoints require:

- `x-worker-api-key`
- `x-worker-id`

Sensitive operator role policy is runtime-configured:

- `TRANSACTION_INTENT_DECISION_ALLOWED_OPERATOR_ROLES` governs approval and denial
- `CUSTODY_OPERATION_ALLOWED_OPERATOR_ROLES` governs queueing and manual custody fallback

## List approved withdrawal intents ready for queueing

Endpoint:

    GET /transaction-intents/internal/withdrawal-requests/approved?limit=20

Expected behavior:

- returns withdrawal intents with:
  - `status = approved`
  - `policyDecision = approved`
- sorts oldest first

## Queue an approved withdrawal intent

Endpoint:

    POST /transaction-intents/internal/withdrawal-requests/:intentId/queue

Example body:

    {
      "note": "Hand off to worker execution."
    }

Expected behavior:

- moves:
  - `status = queued`
- keeps:
  - `policyDecision = approved`
- keeps the balance reservation in place
- writes:
  - `AuditEvent.action = transaction_intent.withdrawal.queued`

## List queued withdrawal intents for worker pickup

Endpoint:

    GET /transaction-intents/internal/worker/withdrawal-requests/queued?limit=20

Expected behavior:

- returns withdrawal intents with:
  - `status = queued`
  - `policyDecision = approved`
- sorts oldest first

## Record a worker broadcast

Endpoint:

    POST /transaction-intents/internal/worker/withdrawal-requests/:intentId/broadcast

Example body:

    {
      "txHash": "0x1111111111111111111111111111111111111111111111111111111111111111"
    }

Expected behavior:

- allowed only when:
  - `status = queued`
  - `policyDecision = approved`
- creates or updates a `BlockchainTransaction`
- records the source wallet as `fromAddress`
- records the stored `externalAddress` as `toAddress`
- moves:
  - `status = broadcast`
- writes:
  - `AuditEvent.action = transaction_intent.withdrawal.broadcast`

## Record a worker execution failure

Endpoint:

    POST /transaction-intents/internal/worker/withdrawal-requests/:intentId/fail

Example body:

    {
      "failureCode": "broadcast_failed",
      "failureReason": "RPC submission failed.",
      "txHash": "0x1111111111111111111111111111111111111111111111111111111111111111"
    }

Expected behavior:

- allowed only when:
  - `status = queued` or `status = broadcast`
  - `policyDecision = approved`
- creates or updates a `BlockchainTransaction` with failed state
- moves:
  - `status = failed`
- releases the reserved balance from:
  - `pendingBalance`
  - back to `availableBalance`
- writes:
  - `AuditEvent.action = transaction_intent.withdrawal.execution_failed`

## Success condition

A successful execution slice should produce:

- approved intents ready for queueing
- queued intents visible to workers
- broadcast events tied to `BlockchainTransaction`
- execution failures tied to `BlockchainTransaction`
- reservation release on execution failure
- durable `AuditEvent` records for queue, broadcast, and failure
