# Customer Account and Wallet Projection Repair Runbook

## Purpose

This runbook repairs the next safest wallet migration gap after wallet-only repair.

The command only repairs rows where:
- legacy `User.ethereumAddress` exists
- `Customer` already exists
- `CustomerAccount` does not exist yet
- the product-chain wallet projection can be safely created or attached

It does not create missing `Customer` rows, and it does not auto-resolve conflicts or mismatches.

## Script

From `apps/api`:

    pnpm run repair:customer-account-wallet-projections

Dry-run mode is the default.

## Supported options

### Dry-run all rows

    pnpm run repair:customer-account-wallet-projections

### Apply safe repairs

    pnpm run repair:customer-account-wallet-projections --apply

### Dry-run one user

    pnpm run repair:customer-account-wallet-projections --email=user@example.com

### Apply one user

    pnpm run repair:customer-account-wallet-projections --email=user@example.com --apply

### Dry-run limited batch

    pnpm run repair:customer-account-wallet-projections --limit=100

### Apply limited batch

    pnpm run repair:customer-account-wallet-projections --limit=100 --apply

## Output shape

The script prints JSON with:
- `summary`
- `plannedActions`
- `conflicts`

## Action meanings

- `already_projected`
  - customer account and wallet projection are already in place

- `repair_account_and_wallet`
  - customer exists, customer account is missing, and account-plus-wallet repair can proceed safely

- `missing_wallet_address`
  - customer exists but legacy user has no usable wallet address, so this command intentionally does nothing

- `missing_customer_projection`
  - customer does not exist yet, so this command intentionally does nothing

- `customer_account_exists`
  - customer account already exists, so this command intentionally does nothing and the wallet-only repair flow should be used instead

- `conflict`
  - existing data prevents safe automatic repair and requires manual review

## Repair methods

- `create_wallet`
  - create a new product-chain wallet projection after creating the customer account

- `attach_existing_wallet`
  - create the customer account and then attach an existing unlinked wallet row to it

## Recommended rollout

1. Run wallet coverage audit in summary mode
2. Run this repair command in dry-run mode
3. Review `repair_account_and_wallet` and `conflict` rows
4. Apply a small limited batch
5. Re-run the wallet coverage audit
6. Re-run wallet-only repair if needed for rows that now have customer accounts but still need wallet attachment

## Safety boundary

This command intentionally leaves these cases untouched:
- missing customer projection
- missing wallet address
- wallet already linked to another account
- multiple product-chain wallets for an account
- wallet and legacy address mismatch
- rows where customer account already exists

Those should be handled in later dedicated repair flows or manual review.
