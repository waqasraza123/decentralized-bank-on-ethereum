# Supabase Database Cutover

## Purpose

This runbook migrates the canonical Prisma database for Stealth Trails Bank from the current localhost PostgreSQL instance to the existing Supabase project's Postgres database.

Chosen posture for this repo:
- schema and data both move
- Supabase remains the auth provider
- Supabase Postgres becomes the canonical business database
- planned downtime cutover
- one shared Supabase database is used by all environments, including local development

## Required inputs

- Supabase pooled/runtime Postgres URL
- Supabase direct Postgres URL
- Supabase JWT secret
- current local source database URL
- maintenance window for API and worker write freeze

Expected environment contract:
- `DATABASE_URL` = Supabase pooled/runtime URL
- `DIRECT_URL` = Supabase direct Postgres URL
- `SUPABASE_JWT_SECRET` = JWT secret from the same Supabase project
- `SOURCE_DATABASE_URL` = current local PostgreSQL source URL

`SOURCE_DATABASE_URL` may be omitted if `apps/api/.env` still points at the current local database.

## Repo tooling

The repo now includes executable cutover helpers:

```bash
pnpm db:supabase:check
pnpm db:supabase:migrate
pnpm db:supabase:dump-local -- /tmp/stealth-trails-bank-supabase-data.sql
pnpm db:supabase:import -- /tmp/stealth-trails-bank-supabase-data.sql
pnpm db:supabase:compare-counts
```

These commands are wrappers around:
- Prisma migrate deploy
- `pg_dump` for the local data export
- `psql` for import and validation

## Preparation

1. Update `apps/api/.env` with the Supabase values:
   - `DATABASE_URL`
   - `DIRECT_URL`
   - `SUPABASE_JWT_SECRET`
2. Keep `SOURCE_DATABASE_URL` pointed at the current local PostgreSQL source.
3. Update runtime secret stores with the same Supabase values:
   - Vercel API project
   - worker project
   - any CI or scheduled job that runs Prisma or API code
4. Run:

```bash
pnpm db:supabase:check
```

This must confirm:
- source host is localhost
- runtime host is Supabase
- direct host is Supabase

## Cutover procedure

1. Enter maintenance mode:
   - stop customer/operator write traffic
   - stop workers that may create or mutate financial records
2. Export current local data:

```bash
pnpm db:supabase:dump-local -- /tmp/stealth-trails-bank-supabase-data.sql
```

3. Apply the full checked-in Prisma migration history to Supabase:

```bash
pnpm db:supabase:migrate
```

4. Import the local data dump into Supabase:

```bash
pnpm db:supabase:import -- /tmp/stealth-trails-bank-supabase-data.sql
```

5. Compare critical table counts:

```bash
pnpm db:supabase:compare-counts
```

The comparison covers:
- `Customer`
- `CustomerAccount`
- `CustomerAuthSession`
- `Wallet`
- `TransactionIntent`
- `LedgerJournal`
- `ReviewCase`
- `OversightIncident`
- `AuditEvent`
- `CustomerMfaRecoveryRequest`

6. Start the API and worker against Supabase-backed env values.
7. Verify:
   - API boots cleanly
   - worker boots cleanly
   - `/auth/login` no longer returns `FUNCTION_INVOCATION_FAILED`
   - web-origin CORS preflight succeeds
   - customer profile/wallet/history reads work

## Operational notes

- Do not run `prisma migrate dev` against the shared Supabase database.
- Do not use localhost Postgres for normal runtime after cutover.
- Keep the local SQL dump and the source database intact until the Supabase cutover is accepted.
- If Vercel or worker runtime still crashes after cutover, verify that `DATABASE_URL` and `DIRECT_URL` were actually set in the deployed environment, not only in `apps/api/.env`.

## Acceptance checklist

- `_prisma_migrations` in Supabase reflects the full checked-in migration history
- critical-table row counts match source
- API login works against the Supabase-backed runtime
- worker health resumes
- Vercel API project secrets are updated away from localhost values
- the local `apps/api/.env` no longer points at `localhost:5432`
