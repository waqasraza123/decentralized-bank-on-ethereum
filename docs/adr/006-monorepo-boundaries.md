# ADR 006: Monorepo Boundaries

- Status: Accepted
- Date: 2026-03-28

## Context

The current monorepo contains:
- `apps/web`
- `apps/api`
- `packages/contracts`

That structure is sufficient for a prototype, but it is not sufficient for the target production system.

The repository needs clearer boundaries so that:
- customer UI
- admin UI
- synchronous API logic
- async blockchain processing
- shared config
- shared types
- DB ownership
- chain integration

do not remain tangled together.

## Decision

The monorepo will be expanded to the following target structure.

### Applications

#### `apps/web`
Customer-facing product UI.

#### `apps/api`
Synchronous HTTP entrypoint for customer and admin APIs.

#### `apps/admin`
Internal operator console.

#### `apps/worker`
Asynchronous processing runtime for:
- queue consumers
- blockchain indexing
- transaction confirmation
- reconciliation jobs
- notifications
- repair tooling support

### Packages

#### `packages/contracts`
Contract source, tests, deployment manifests.

#### `packages/contracts-sdk`
Typed contract integration layer, chain config, addresses, ABI ownership, and shared on-chain adapters.

#### `packages/db`
Prisma schema ownership, migrations, DB access boundaries.

#### `packages/types`
Shared domain and API types.

#### `packages/config`
Typed environment and configuration loading.

#### `packages/security`
Shared security, policy, and audit utilities where reuse is justified.

#### `packages/ui`
Shared UI primitives only if later reuse between web and admin is valuable enough to justify it.

## Boundary Rules

### API boundary
`apps/api` owns synchronous request handling, validation, auth, authorization, and orchestration entrypoints.

### Worker boundary
`apps/worker` owns asynchronous workflows and must not be collapsed back into the request path once introduced.

### Contract integration boundary
Apps should not each own drifting ABI copies and chain logic. Contract integration should converge behind `packages/contracts-sdk`.

### Data boundary
Prisma schema and migration ownership should converge behind `packages/db` instead of remaining app-local forever.

### UI boundary
Customer and admin interfaces must remain separate applications.

### Shared-code rule
Shared packages should be introduced to express real domain reuse, not speculative abstraction.

## Why This Decision

The current repository needs:
- clearer responsibilities
- safer async processing boundaries
- reusable config and type ownership
- a stable location for DB and contract integration concerns

Without this, production hardening would be harder and more error-prone.

## Consequences

### Positive

- repo responsibilities become clearer
- later feature work has better homes
- async processing can grow without distorting request handlers
- admin tooling can evolve independently from customer UX
- contract integration can stop drifting across services

### Negative

- the repo will become structurally larger
- there will be migration work from app-local ownership into shared packages
- some existing imports and scripts will need adjustment later

## Non-Goals

This decision does not:
- require every shared package to be heavily populated immediately
- authorize unnecessary abstractions
- require moving all current code at once

## Implementation Implications

Phase 1 should:
- add the missing apps and packages additively
- keep runtime behavior stable while boundaries are introduced
- move ownership gradually instead of via a risky big-bang rewrite
