# Withdrawal Intent Request API

## Purpose

This runbook covers the first customer-facing withdrawal request slice.

This slice creates a withdrawal transaction intent and immediately reserves balance.

It moves the requested amount from:

- `availableBalance`
- to `pendingBalance`

It does not yet broadcast a blockchain transaction and it does not settle ledger state.

## Preconditions

- the authenticated user already has:
  - `Customer`
  - `CustomerAccount`
  - one active product-chain `Wallet`
- the requested asset exists as an active `Asset` row for the configured product chain
- the customer has sufficient `CustomerAssetBalance.availableBalance`
- JWT auth is configured and working

## Create a withdrawal request

Endpoint:

    POST /transaction-intents/withdrawal-requests

Example body:

    {
      "idempotencyKey": "withdraw_req_20260401_001",
      "assetSymbol": "USDC",
      "amount": "30",
      "destinationAddress": "0x0000000000000000000000000000000000000abc"
    }

Expected behavior:

- creates a `TransactionIntent` with:
  - `intentType = withdrawal`
  - `status = requested`
  - `policyDecision = pending`
- binds the intent to the authenticated user customer account
- stores the active product-chain wallet as `sourceWallet`
- stores the requested external destination address in `externalAddress`
- moves the requested amount from:
  - `availableBalance`
  - to `pendingBalance`
- writes an `AuditEvent` for the request

If the same idempotency key is retried with the same payload, the existing intent is returned.

If the same idempotency key is reused with a different payload, the request is rejected.

## Failure modes

The request is rejected when:

- no `CustomerAccount` projection exists
- no active product-chain wallet exists
- multiple active product-chain wallets exist
- no active asset exists for the given symbol on the product chain
- the destination address is not a valid EVM address
- the destination address matches the customer product wallet address
- insufficient available balance exists
- the idempotency key is already bound to a different request payload

## Success condition

A successful request path should produce:

- one `TransactionIntent`
- one `AuditEvent`
- one reservation move from available to pending balance
- stable idempotent retries
- a truthful customer balance view while the request is still pending
