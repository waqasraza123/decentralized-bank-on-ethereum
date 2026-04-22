# Delivery Phases

## Phase 1

- extend Prisma schema for internal transfer intents, review cases, and ledger account types
- add runtime config for per-asset transfer review thresholds
- add notification runtime config for transfer emails

## Phase 2

- implement customer preview and create APIs
- implement internal operator pending list and decision APIs
- add ledger reservation, release, and settlement support
- open and resolve review cases for threshold-reviewed transfers

## Phase 3

- update transaction history and operations projections so recipients see inbound transfers
- add sender and recipient notification delivery hooks
- extend admin queue coverage for pending transfer approval

## Phase 4

- ship web wallet internal transfer UX
- ship mobile wallet internal transfer UX
- distinguish internal transfer copy from external withdrawal copy

## Follow-ups

- optional customer cancellation before operator decision
- dedicated end-to-end verification pass across web, mobile, admin approval, and notification delivery is postponed
- richer notification templates and delivery observability dashboards
- more explicit admin review workspace integration with linked transfer cases
- beneficiary or trusted-contact release expansion if internal transfer policy later broadens
