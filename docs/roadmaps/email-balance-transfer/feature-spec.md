# Feature Spec

## Summary

Add a customer feature that lets one existing Stealth Trails Bank customer send supported internal balances to another existing customer by email address.

This feature is an internal ledger transfer and does not create a blockchain withdrawal. It reuses the existing money-movement security model and adds explicit server-side enforcement for:

- active sender account
- active recipient account
- trusted current session
- fresh MFA step-up
- email backup MFA enrolled

## Product behavior

### Customer flow

1. pick an asset
2. enter recipient email
3. verify the masked recipient preview
4. enter amount
5. review the threshold outcome notice
6. submit the transfer

### Recipient eligibility

- recipient must already exist on STB
- recipient account must be `active`
- self-transfer by email or by customer account is rejected
- nonexistent or ineligible recipients return a generic unavailable preview

### Threshold policy

- thresholds are configured per asset through `INTERNAL_BALANCE_TRANSFER_REVIEW_THRESHOLDS_JSON`
- if an asset threshold is missing, the transfer defaults to operator review
- below threshold:
  - transfer settles immediately
  - sender available balance decreases
  - recipient available balance increases
- above threshold:
  - sender available balance decreases immediately
  - sender pending balance increases immediately
  - operator review case opens
  - approval settles the transfer
  - denial releases the reservation back to sender available balance

## Data model

### Transaction intents

`TransactionIntentType.internal_balance_transfer` is the workflow spine.

`TransactionIntent` now stores:

- `recipientCustomerAccountId`
- `recipientEmailSnapshot`
- `recipientMaskedEmail`
- `recipientMaskedDisplay`

### Review cases

Threshold-reviewed transfers open `ReviewCaseType.internal_balance_transfer_review`.

### Ledger

The ledger adds:

- `customer_asset_pending_internal_transfer_liability`
- `internal_balance_transfer_reservation`
- `internal_balance_transfer_reservation_release`
- `internal_balance_transfer_settlement`

`CustomerAssetBalance.pendingBalance` now covers both pending withdrawals and pending reviewed internal transfers.

## API surface

### Customer

- `POST /balance-transfers/me/recipient-preview`
- `POST /balance-transfers/me`

### Operator

- `GET /balance-transfers/internal/pending`
- `POST /balance-transfers/internal/:intentId/decision`

## Customer UX

### Web and mobile

- internal transfer is presented as a distinct action from withdrawal
- recipient preview is masked
- threshold messaging distinguishes immediate settlement from operator review
- security gating preserves trusted-session and fresh-step-up language
- history shows sent and received internal transfers as first-class records

## Notifications

Mandatory transfer notifications are emitted for sender and recipient on:

- transfer creation
- review-required state
- settlement
- denial

## Admin UX

The admin queue includes a dedicated pending internal transfer list with:

- sender identity
- masked recipient identity
- amount and asset
- linked review case
- approve or deny action
