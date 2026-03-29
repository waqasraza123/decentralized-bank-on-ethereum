# Customer Account Backfill

## Purpose

This runbook covers the controlled backfill from legacy `User` records into the new `Customer` and `CustomerAccount` model.

The backfill exists so historical users can be projected into the new model before any public read path switch happens.

## Safety Rules

- run a dry run first
- do not use apply mode until the dry run output is reviewed
- treat conflicts as manual follow up items
- do not modify the script to force merge conflicting records without an explicit migration decision
- the script is designed to be idempotent and safe to re run

## Script Location

- `apps/api/src/scripts/backfill-customer-accounts.ts`

## Supported Modes

### Dry run

Default mode.
No writes occur.

### Apply

Use `--apply`.
Writes missing `Customer` and `CustomerAccount` records.

## Supported Filters

### Limit

Use `--limit=<positive integer>` to process a small batch.

### Email

Use `--email=<email>` to process one legacy user by email.

## Commands

Run a dry run for a small batch:

    pnpm --filter @stealth-trails-bank/api backfill:customer-accounts -- --limit=10

Run a dry run for one legacy user:

    pnpm --filter @stealth-trails-bank/api backfill:customer-accounts -- --email=test-user@example.com

Apply the backfill for one legacy user:

    pnpm --filter @stealth-trails-bank/api backfill:customer-accounts -- --apply --email=test-user@example.com

Apply the backfill for a limited batch:

    pnpm --filter @stealth-trails-bank/api backfill:customer-accounts -- --apply --limit=50

## Outcomes

The script classifies each legacy user into one of these actions:

- `already_projected`
- `create_customer_and_account`
- `create_account_only`
- `conflict`

## Conflict Handling

A conflict is reported when:

- different customer rows are found by `supabaseUserId` and email
- an existing customer email does not match the legacy user email
- an existing customer `supabaseUserId` does not match the legacy user `supabaseUserId`

Conflicts are skipped and surfaced in the output.
Conflicts should be resolved manually before re running in apply mode.

## Expected Status Initialization

New backfilled `CustomerAccount` rows are initialized with:

- `registered`

That is the safest current default because lifecycle migration from the legacy model has not been formally defined yet.

## Preconditions

Before running the backfill:

- API environment variables must be available
- the Prisma client must be generated
- the development database must already include the new schema additions

## Post Run Review

After any apply run:

- review summary counts
- review any conflicts
- verify a sample of newly created `Customer` and `CustomerAccount` records
- do not switch public reads yet unless the backfill coverage is satisfactory
