# Withdrawal Intent Operator Review API

## Purpose

This runbook covers the internal operator review and decision slice for withdrawal transaction intents.

This slice lets internal operators:

- list pending withdrawal requests
- approve a pending withdrawal request
- deny a pending withdrawal request

The reservation created at request time stays in place during review.

If an operator denies the request, the reservation is released back to `availableBalance`.

## Internal operator authentication

The internal endpoints require these request headers:

- `x-operator-api-key`
- `x-operator-id`

The API key must match `INTERNAL_OPERATOR_API_KEY`.

The operator id is recorded in `AuditEvent.actorId`.

## List pending withdrawal requests

Endpoint:

    GET /transaction-intents/internal/withdrawal-requests/pending?limit=20

Expected behavior:

- returns pending withdrawal requests only
- filters to:
  - `intentType = withdrawal`
  - `status = requested`
  - `policyDecision = pending`
- sorts oldest first
- default limit is 20
- max limit is 100

## Approve a pending withdrawal request

Endpoint:

    POST /transaction-intents/internal/withdrawal-requests/:intentId/decision

Example body:

    {
      "decision": "approved",
      "note": "Withdrawal request approved."
    }

Expected behavior:

- updates:
  - `status = approved`
  - `policyDecision = approved`
- keeps the existing balance reservation in place
- clears failure fields
- writes an `AuditEvent` with:
  - `actorType = operator`
  - `actorId = x-operator-id`
  - `action = transaction_intent.withdrawal.approved`

## Deny a pending withdrawal request

Endpoint:

    POST /transaction-intents/internal/withdrawal-requests/:intentId/decision

Example body:

    {
      "decision": "denied",
      "denialReason": "Manual review rejected.",
      "note": "Release the reserved funds."
    }

Expected behavior:

- updates:
  - `status = failed`
  - `policyDecision = denied`
- sets:
  - `failureCode = policy_denied`
  - `failureReason = denialReason`
- releases the reserved amount from:
  - `pendingBalance`
  - back to `availableBalance`
- writes an `AuditEvent` with:
  - `actorType = operator`
  - `actorId = x-operator-id`
  - `action = transaction_intent.withdrawal.denied`

## Success condition

A successful operator review path should produce:

- a visible pending queue
- one controlled state transition per intent
- balance reservation preserved on approval
- balance reservation released on denial
- one durable `AuditEvent` for the operator decision
