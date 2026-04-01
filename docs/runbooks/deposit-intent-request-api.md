# Deposit Intent Request API

## Purpose

This runbook covers the first customer-facing TransactionIntent request slice.

This slice creates a deposit request record only.

It does not broadcast a blockchain transaction and it does not settle ledger state yet.

## Preconditions

- the authenticated user already has:
  - Customer
  - CustomerAccount
  - one active product-chain Wallet
- the requested asset exists as an active Asset row for the configured product chain
- JWT auth is configured and working

## Create a deposit request

Endpoint:

~~~text
POST /transaction-intents/deposit-requests
~~~

Example body:

~~~json
{
  "idempotencyKey": "deposit_req_20260401_001",
  "assetSymbol": "ETH",
  "amount": "1.25"
}
~~~

Expected behavior:

- creates a TransactionIntent with:
  - intentType = deposit
  - status = requested
  - policyDecision = pending
- binds the intent to the authenticated user customer account
- uses the active product-chain wallet as destinationWallet
- writes an AuditEvent for the request

If the same idempotency key is retried with the same payload, the existing intent is returned.

If the same idempotency key is reused with a different payload, the request is rejected.

## List recent transaction intents

Endpoint:

~~~text
GET /transaction-intents/me?limit=20
~~~

Expected behavior:

- returns recent intents for the authenticated user customer account
- sorts newest first
- default limit is 20
- max limit is 100

## Failure modes

The request is rejected when:

- no CustomerAccount projection exists
- no active product-chain wallet exists
- multiple active product-chain wallets exist
- no active asset exists for the given symbol on the product chain
- the idempotency key is already bound to a different request payload

## Success condition

A successful request path should produce:

- one TransactionIntent
- one AuditEvent
- a stable response for idempotent retries
- visibility through GET /transaction-intents/me
