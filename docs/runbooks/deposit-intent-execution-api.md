# Deposit Intent Execution API

## Purpose

This runbook covers the first post-approval execution slice for deposit transaction intents.

This slice lets the system move from approved review state into worker-owned execution state.

It covers:

- operator queueing
- worker queued fetch
- worker broadcast recording
- worker execution failure recording

It does not yet cover:

- on-chain confirmation ingestion
- settlement
- ledger posting

## Internal authentication

Operator endpoints require:

- x-operator-api-key
- x-operator-id

Worker endpoints require:

- x-worker-api-key
- x-worker-id

The configured runtime secrets are:

- INTERNAL_OPERATOR_API_KEY
- INTERNAL_WORKER_API_KEY

## List approved deposit intents ready for queueing

Endpoint:

~~~text
GET /transaction-intents/internal/deposit-requests/approved?limit=20
~~~

Expected behavior:

- returns deposit intents with:
  - status = approved
  - policyDecision = approved
- sorts oldest first
- default limit is 20
- max limit is 100

## Queue an approved deposit intent

Endpoint:

~~~text
POST /transaction-intents/internal/deposit-requests/:intentId/queue
~~~

Example body:

~~~json
{
  "note": "Hand off to worker execution."
}
~~~

Expected behavior:

- moves:
  - status = queued
- keeps:
  - policyDecision = approved
- writes:
  - AuditEvent.action = transaction_intent.deposit.queued

## List queued deposit intents for worker pickup

Endpoint:

~~~text
GET /transaction-intents/internal/worker/deposit-requests/queued?limit=20
~~~

Expected behavior:

- returns deposit intents with:
  - status = queued
  - policyDecision = approved
- sorts oldest first
- includes latest blockchain transaction if one exists

## Record a worker broadcast

Endpoint:

~~~text
POST /transaction-intents/internal/worker/deposit-requests/:intentId/broadcast
~~~

Example body:

~~~json
{
  "txHash": "0x1111111111111111111111111111111111111111111111111111111111111111",
  "fromAddress": "0x0000000000000000000000000000000000000def",
  "toAddress": "0x0000000000000000000000000000000000000abc"
}
~~~

Expected behavior:

- allowed only when:
  - status = queued
  - policyDecision = approved
- creates or updates a BlockchainTransaction
- moves:
  - status = broadcast
- writes:
  - AuditEvent.action = transaction_intent.deposit.broadcast

## Record a worker execution failure

Endpoint:

~~~text
POST /transaction-intents/internal/worker/deposit-requests/:intentId/fail
~~~

Example body:

~~~json
{
  "failureCode": "broadcast_failed",
  "failureReason": "RPC submission failed.",
  "txHash": "0x1111111111111111111111111111111111111111111111111111111111111111"
}
~~~

Expected behavior:

- allowed only when:
  - status = queued or status = broadcast
  - policyDecision = approved
- creates or updates a BlockchainTransaction with failed state
- moves:
  - status = failed
- sets:
  - failureCode
  - failureReason
- writes:
  - AuditEvent.action = transaction_intent.deposit.execution_failed

## Success condition

A successful execution slice should produce:

- approved intents ready for queueing
- queued intents visible to workers
- broadcast events tied to BlockchainTransaction
- execution failures tied to BlockchainTransaction
- durable AuditEvent records for queue, broadcast, and failure
