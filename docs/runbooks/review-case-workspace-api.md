# Review Case Workspace API

## Purpose

This runbook covers the first operator investigation workspace slice for ReviewCase.

This slice lets operators:

- take ownership of a case
- move a case into in_progress
- add investigation notes
- hand a case off to another operator
- inspect one unified workspace with:
  - review case details
  - review case event timeline
  - linked transaction audit events
  - ledger-backed balances
  - recent transaction intent history

This slice does not mutate money state directly.

## Authentication

These endpoints require:

- x-operator-api-key
- x-operator-id

## List review cases with richer filters

Endpoint:

    GET /review-cases/internal?status=open&type=reconciliation_review&reasonCode=settled_amount_mismatch&limit=20

Additional useful filters:

- assignedOperatorId
- email
- supabaseUserId
- customerAccountId
- transactionIntentId

## Start a review case

Endpoint:

    POST /review-cases/internal/:reviewCaseId/start

Example body:

    {
      "note": "Taking ownership of this case."
    }

Expected behavior:

- allowed only when the case is not:
  - resolved
  - dismissed
- moves:
  - status = in_progress
- sets:
  - assignedOperatorId = x-operator-id
  - startedAt if it was not already set
- writes:
  - one ReviewCaseEvent with eventType = started
  - one AuditEvent with action = review_case.started

## Add a review case note

Endpoint:

    POST /review-cases/internal/:reviewCaseId/notes

Example body:

    {
      "note": "Checked the customer balance and tx history. Need second operator review."
    }

Expected behavior:

- allowed only when the case is not:
  - resolved
  - dismissed
- writes:
  - one ReviewCaseEvent with eventType = note_added
  - one AuditEvent with action = review_case.note_added

## Handoff a review case

Endpoint:

    POST /review-cases/internal/:reviewCaseId/handoff

Example body:

    {
      "nextOperatorId": "ops_2",
      "note": "Passing to ops_2 for ledger investigation."
    }

Expected behavior:

- allowed only when the case is not:
  - resolved
  - dismissed
- moves:
  - status = in_progress
- sets:
  - assignedOperatorId = nextOperatorId
- writes:
  - one ReviewCaseEvent with eventType = handed_off
  - one AuditEvent with action = review_case.handed_off

## Get review case workspace

Endpoint:

    GET /review-cases/internal/:reviewCaseId/workspace?recentLimit=20

Expected behavior:

- returns:
  - review case details
  - ordered review case event timeline
  - linked transaction audit timeline when a transaction intent exists
  - ledger-backed balances for the linked customer account
  - recent transaction intents for the linked customer account
- gives operators one place to investigate a case without direct database access

## Resolve and dismiss behavior

Existing endpoints continue to work:

    POST /review-cases/internal/:reviewCaseId/resolve
    POST /review-cases/internal/:reviewCaseId/dismiss

This step extends them so they also write:

- one ReviewCaseEvent
- one AuditEvent

## Success condition

A successful workspace slice should produce:

- durable ownership of manual investigation work
- first-class investigation notes
- explicit operator handoff trail
- one unified review case workspace with the main linked operational context
- no need to investigate cases only through scattered audit events and raw database queries
