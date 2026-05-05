# Neon Database and Auth Cutover

## Purpose

This runbook migrates the canonical Prisma Postgres database for Stealth Trails Bank from Supabase Postgres to Neon Postgres without dropping data, schema, migration history, or runtime secrets.

Chosen posture:
- planned downtime cutover
- schema and data both move
- Neon Postgres becomes the canonical business database
- customer auth remains app-owned through `Customer.passwordHash`, `JWT_SECRET`, and `CustomerAuthSession`
- operator auth moves from Supabase JWT verification to app-issued operator JWTs, with Supabase bearer tokens allowed only as a temporary bridge

## Required inputs

- `SOURCE_DATABASE_URL`: direct/unpooled Supabase Postgres URL
- `SOURCE_SCHEMAS`: comma-separated schemas to dump; defaults to `public`
- `DATABASE_URL`: Neon pooled runtime URL, using the `-pooler` host suffix
- `DIRECT_URL`: Neon direct/unpooled URL
- current `JWT_SECRET`
- current `SUPABASE_JWT_SECRET`, only for the temporary operator-auth bridge
- all existing internal API, worker, Ethereum, email, and governance secrets
- maintenance window for API, worker, cron, and operator write freeze

Do not commit real connection strings or keys. Store them in Vercel/env secret stores and local untracked `.env` files only.

## Repo tooling

```bash
pnpm db:neon:check
pnpm db:neon:dump-source -- /tmp/stealth-trails-bank-neon-source.dump
pnpm db:neon:restore -- /tmp/stealth-trails-bank-neon-source.dump
pnpm db:neon:migrate
pnpm db:neon:compare-counts
pnpm db:neon:compare-all-counts
```

These commands wrap `pg_dump`, `pg_restore`, `psql`, and Prisma migrate deploy. The dump and restore use direct/unpooled connections because pooled connections are not appropriate for PostgreSQL dump/restore operations.

## Preparation

1. Rotate the Neon password if a connection string was shared outside the secret manager.
2. Confirm the Neon project uses a compatible PostgreSQL major version with the Supabase source.
3. Configure untracked local env or shell env:
   - `SOURCE_DATABASE_URL`
   - `SOURCE_SCHEMAS=public` for the app-owned business database
   - `SOURCE_SCHEMAS=public,auth,storage` only if Supabase-owned schemas must be archived/restored too
   - `DATABASE_URL`
   - `DIRECT_URL`
4. Configure runtime secret stores for the cutover target:
   - `DATABASE_URL` = Neon pooled URL
   - `DIRECT_URL` = Neon direct URL
   - keep all non-database secrets unchanged
5. Keep `JWT_SECRET` unchanged so restored customer sessions and token versions remain coherent.
6. Keep `SUPABASE_JWT_SECRET` only until operator app-issued JWTs are verified.
7. Run:

```bash
pnpm db:neon:check
```

## Cutover procedure

1. Enter maintenance mode:
   - stop API customer/operator writes
   - stop workers and schedulers
   - block background mutation jobs
2. Export the selected Supabase schema data:

```bash
pnpm db:neon:dump-source -- /tmp/stealth-trails-bank-neon-source.dump
```

3. Restore into an empty Neon database:

```bash
pnpm db:neon:restore -- /tmp/stealth-trails-bank-neon-source.dump
```

4. Apply any checked-in Prisma migrations not present in the restored database:

```bash
pnpm db:neon:migrate
```

5. Compare row counts:

```bash
pnpm db:neon:compare-counts
pnpm db:neon:compare-all-counts
```

6. Update deployed runtime envs:
   - `DATABASE_URL` to Neon pooled URL
   - `DIRECT_URL` to Neon direct URL
   - leave `JWT_SECRET`, internal API keys, worker keys, Ethereum keys, and email/governance secrets unchanged
7. Start API and worker against Neon.
8. Verify customer login, profile, wallet, transaction history, operator bearer auth, worker heartbeat, and representative read paths.
9. Mint and verify app-issued operator JWTs before removing Supabase operator bearer tokens.
   - Use `POST /auth/internal/operator/session` with a still-valid operator bearer token to mint the caller's replacement token.
   - Use the legacy operator API-key bridge only for controlled emergency bootstrap.

## Operator auth decommission

- Customer auth does not depend on Supabase Auth after the database restore because passwords, sessions, MFA state, and token versions are in Prisma tables.
- Operator bearer auth supports `operator_jwt` tokens signed with `JWT_SECRET` and carrying `stb_token_type=operator`.
- Supabase operator bearer tokens should remain enabled only during the cutover bridge.
- Once app-issued operator JWTs are verified, remove `SUPABASE_JWT_SECRET` from production envs and disable any Supabase operator login flow.

## Acceptance checklist

- `_prisma_migrations` exists and includes the checked-in migration history
- all public table counts match source
- critical financial tables match source counts
- API boots with Neon envs
- worker boots and records heartbeats
- customer login succeeds with existing passwords
- existing customer sessions behave according to `JWT_SECRET`, `authTokenVersion`, and `CustomerAuthSession`
- operator-protected routes accept app-issued operator JWTs
- Supabase source database and dump are retained until acceptance is complete
