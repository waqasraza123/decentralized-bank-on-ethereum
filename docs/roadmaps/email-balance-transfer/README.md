# Email Balance Transfer

This roadmap captures the internal email-to-email balance transfer feature for Stealth Trails Bank.

## Scope

- existing active STB customers can send supported internal balances to other existing active STB customers by email
- the transfer is an internal ledger movement, not a blockchain withdrawal
- sender protections are enforced server-side:
  - active sender account
  - active recipient account
  - trusted current session
  - fresh MFA step-up
  - email backup MFA enrolled through the existing money-movement gate
- recipient preview reveals masked identity only
- per-asset thresholds decide whether the transfer:
  - settles immediately, or
  - reserves funds immediately and enters operator review

## Delivered v1

- customer API under `apps/api/src/balance-transfers`
- operator approval API for pending internal transfers
- review-case creation and audit coverage for threshold-reviewed transfers
- new ledger reservation, release, and settlement journals for internal transfers
- customer web and mobile wallet flows for email-based internal transfer
- transaction history support for sent and received internal transfers
- mandatory transfer notification delivery hooks for sender and recipient
- admin queue entry for pending internal transfer approvals

## Hardening status

- targeted hardening coverage now exists for internal transfer ledger transitions, recipient-facing transaction history projection, and the web internal transfer card
- full end-to-end verification across customer web, mobile, admin queue, and notification delivery is intentionally postponed to a follow-up verification pass

## Source docs

- [feature-spec.md](./feature-spec.md)
- [phases.md](./phases.md)
