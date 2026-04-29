# Contributing to Stealth Trails Bank

Thanks for contributing.

This repository is an active product codebase for a financial platform, so the standard for changes is higher than a typical side project. The goal is not only to make things work, but to make them safe to operate, review, and extend.

## Before you start

Please read:

- `README.md`
- `CODE_OF_CONDUCT.md`
- `SECURITY.md`
- relevant architecture docs under `docs/architecture/`
- relevant runbooks under `docs/runbooks/`
- for Phase 12 work, check `docs/runbooks/release-readiness-evidence-api.md`

If your change touches a specific flow, read the runbook for that flow first.

## What good contributions look like here

We prefer changes that are:

- small but meaningful
- clearly scoped
- typed and validated
- easy to review
- operationally understandable
- safe to extend later

We do not want changes that:

- mix unrelated concerns
- hide behavior in large multi-purpose files
- introduce silent side effects
- bypass validation for convenience
- weaken auditability around state changes
- make money state harder to reason about

## Development principles

When contributing, aim for:

- descriptive and consistent naming
- small focused functions and modules
- reusable code where it helps clarity
- explicit assumptions
- strong error handling
- production-grade behavior from the start
- no hardcoded secrets or environment-sensitive hacks

For financial or workflow state changes, prefer:

- explicit state transitions
- idempotent behavior where appropriate
- durable persistence
- audit visibility
- recovery-safe logic

## Branching

Use short, descriptive branch names.

Examples:

- `feat/deposit-execution-slice`
- `fix/wallet-projection-audit-summary`
- `docs/repo-governance-docs`

## Commit messages

Commit messages should be:

- short
- specific
- scoped to one meaningful unit of work

Examples:

- `add deposit intent execution slice`
- `add wallet projection audit summary`
- `upgrade repo docs and governance files`

## Pull request expectations

A pull request should explain:

- what changed
- why it changed
- what assumptions were made
- how it was verified
- what follow-up work remains, if any

Good PRs are easier to review and merge when they avoid hidden context.

## Database and Prisma changes

If your change touches schema or persistence:

- update the Prisma schema carefully
- generate Prisma client changes
- run migrations locally
- verify read and write paths
- verify that existing flows still behave correctly

For important state changes, include tests or clear verification steps.

## API changes

If your change adds or changes API behavior:

- validate request payloads
- keep response shapes consistent
- handle failure states explicitly
- update or add a runbook when the flow matters operationally

## Tests

Run the most relevant tests for your change.

Typical examples:

~~~bash
pnpm --filter @stealth-trails-bank/api build
pnpm --filter @stealth-trails-bank/api test
~~~

If your change is bounded, run at least the focused tests around that area.

## Local development guard

Root development startup is guarded too:

~~~bash
pnpm dev
~~~

That command now runs a repo-owned preflight before Turbo starts. The preflight blocks startup if:

- the worker points at the wrong local API base URL
- the API database has pending checked-in Prisma migrations

If the database is behind, apply migrations first:

~~~bash
pnpm --filter @stealth-trails-bank/api prisma:deploy
~~~

## Push workflow

This repo includes a versioned pre-push hook, but it is non-blocking. Normal `git push` is allowed.

Enable it once per clone:

~~~bash
pnpm setup:hooks
~~~

If you want to validate before pushing, use the explicit wrapper command:

~~~bash
pnpm push --validate-before-push
~~~

That command runs the repo push verification and then pushes only if it passes.

For compatibility, `pnpm safe-push` remains available and does the same thing.

~~~bash
pnpm safe-push
~~~

## Phase 12 drill execution

When you need to validate staged release proof, use the repo-owned drill runner instead of assembling manual curl sequences:

~~~bash
pnpm release:readiness:probe -- --help
~~~

That command can validate a specific drill profile and optionally record the result directly into release-readiness evidence.

For repo-owned verification suites and manual launch attestations, use:

~~~bash
pnpm release:readiness:verify -- --help
~~~

That command runs the automated contract, backend integration, and end-to-end finance proofs, and it can also record manual secret-handling or role-review evidence through the same release-readiness workflow.

For solvency anchor registry launch proof, generate the structured evidence payload from the governed deployment manifest:

~~~bash
pnpm release:solvency-anchor-proof -- --help
~~~

The generator refuses placeholder deployment metadata and checks that `solvency_report_anchor_registry_v1` is owned by the manifest governance safe and authorized for the manifest `solvency_anchor_execution` signer. Add `--record-evidence --base-url <operator-api-url> --access-token "$OPERATOR_ACCESS_TOKEN"` when the generated proof should be persisted immediately.

## Documentation

Update docs when you change:

- architecture assumptions
- Phase 12 release-readiness evidence or governed launch approval expectations
- workflow behavior
- operational procedures
- onboarding or setup steps
- repo standards

At minimum, update the runbook for any new operational flow.

## Security and sensitive issues

Do not open public issues or casual PR discussion for security-sensitive findings.

Follow the instructions in `SECURITY.md`.

## Questions and collaboration

If a change is large or architectural, align the direction first before spreading work across many files.

The best collaboration here is usually:

- clarify scope
- land one clean vertical slice
- verify it properly
- then move to the next slice

That keeps the repo moving without losing control.
