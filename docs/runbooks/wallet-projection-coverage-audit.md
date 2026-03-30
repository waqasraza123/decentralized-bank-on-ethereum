# Wallet Projection Coverage Audit Runbook

## Purpose

This runbook measures how many legacy user profiles still depend on legacy `User.ethereumAddress` instead of the new `Wallet` projection for the configured product chain.

The audit is read-only.

## Preconditions

- `Customer`, `CustomerAccount`, and `Wallet` exist in the live Prisma schema
- database runtime variables are configured
- `PRODUCT_CHAIN_ID` is set when a non-default product chain should be audited
- the API package already includes the wallet backfill and wallet-first read migration work

## Script

From `apps/api`:

    pnpm run audit:wallet-projection-coverage

## Supported options

### Summary only

    pnpm run audit:wallet-projection-coverage --summary-only

### Actionable rows only

    pnpm run audit:wallet-projection-coverage --only-actionable

### One user by email

    pnpm run audit:wallet-projection-coverage --email=user@example.com

### Limited batch

    pnpm run audit:wallet-projection-coverage --limit=100

### Limited actionable batch summary

    pnpm run audit:wallet-projection-coverage --limit=100 --only-actionable --summary-only

## Output shape

The script prints JSON with:
- `summary`
- `details`

## Status meanings

- `wallet_projected`
  - profile is ready to resolve from the new `Wallet` projection

- `wallet_legacy_mismatch`
  - both values exist but `Wallet.address` differs from legacy `User.ethereumAddress`

- `create_wallet_only`
  - customer and customer account exist, but the wallet projection is missing

- `create_account_and_wallet`
  - customer exists, but customer account and wallet projection are missing

- `create_customer_account_and_wallet`
  - no customer projection exists yet, but legacy address exists

- `missing_address`
  - there is no usable wallet projection and no usable legacy address

- `conflict`
  - data inconsistency requires manual review

## Suggested action meanings

- `none`
- `backfill_wallet`
- `backfill_account_and_wallet`
- `backfill_customer_account_and_wallet`
- `manual_review`
- `repair_legacy_data`

## Recommended rollout

1. Run the audit in summary-only mode
2. Review actionable counts
3. Run the audit with `--only-actionable`
4. Run wallet backfill or manual repairs based on the returned statuses
5. Re-run the audit after backfill
6. Only reduce legacy fallback after actionable legacy-dependent profiles are understood

## Success condition

The legacy-dependent population should trend toward zero, and only intentional manual-review cases should remain before removing or tightening legacy fallback.
