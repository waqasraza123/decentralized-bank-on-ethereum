# Stealth Trails Bank

Stealth Trails Bank is a monorepo for a blockchain-backed banking platform.

This repository is not only a website and an API. It is the working product codebase for a system that is moving from prototype banking flows into a production-grade platform with:

- customer identity and account lifecycle
- wallet ownership and projection repair tooling
- transaction intent workflows
- internal operator review paths
- internal worker execution paths
- blockchain transaction tracking
- durable auditability around important state transitions

The repo is being built in controlled stages so the platform can move forward without losing correctness in the areas that matter most for money movement.

## What exists today

The repository already includes real backend foundation for:

- customer, customer account, and wallet projections
- migration, audit, and repair tooling for legacy to new model adoption
- deposit transaction intent request flow
- internal operator approval and denial flow
- operator queueing for approved deposit intents
- worker broadcast and execution failure reporting for deposits
- durable audit trails across those implemented workflow slices

That means the project has moved beyond pure scaffolding. It now contains early but real money-state workflow slices.

## What is still in progress

This is not yet a finished banking product.

The system still needs broader production coverage in areas such as:

- confirmation and settlement slices
- generalized ledger coverage across more money flows
- reconciliation and replay safety
- withdrawal flows
- fuller customer UI replacement
- fuller internal admin console
- broader observability, incident tooling, and release hardening

## Repository layout

| Path | Purpose |
|------|---------|
| `apps/web` | Customer-facing web application |
| `apps/api` | Backend API, workflow orchestration, persistence, and internal operational paths |
| `packages/config` | Shared runtime config loading and validation |
| `packages/db` | Shared Prisma client access |
| `packages/types` | Shared TypeScript contracts and types |
| `docs/` | Architecture, ADRs, runbooks, and operational notes |

## How the system is shaped

At a high level:

1. customers interact with the platform through the web app and API
2. the API owns customer identity, wallet linkage, workflow state, and persistence
3. internal operator paths review sensitive actions
4. internal worker paths move approved actions through execution state
5. audit events provide a durable operational trail
6. later slices extend this into confirmation, settlement, and broader accounting truth

The direction of the repo is intentional:

- workflow correctness first
- durable persistence and auditability next
- UI and operational visibility layered on top
- correctness over speed in money-critical areas

## Current implemented flow coverage

The main implemented product slice today is the early deposit path:

1. customer creates a deposit transaction intent
2. operator reviews and approves or denies it
3. operator queues approved work
4. worker records broadcast
5. worker records execution failure when needed

This is important because it means the repo is no longer only a prototype shell. It already contains real workflow state, internal review, internal execution reporting, and auditability.

## Quick start

### 1. Install dependencies

~~~bash
pnpm install
~~~

### 2. Prepare environment files

Use the existing example env files inside each app or package where present.

At minimum, the API needs working values for:

- `DATABASE_URL`
- `DIRECT_URL`
- `JWT_SECRET`
- `JWT_EXPIRY_SECONDS`
- `PRODUCT_CHAIN_ID`
- `INTERNAL_OPERATOR_API_KEY`
- `INTERNAL_WORKER_API_KEY`

For blockchain-connected flows you will also need:

- `RPC_URL`
- `ETHEREUM_PRIVATE_KEY`

For contract-connected flows where relevant:

- `STAKING_CONTRACT_ADDRESS`

Frontend environment values should be configured from the web app env examples where present and pointed at the local or deployed API.

### 3. Generate Prisma client and run database migrations

~~~bash
pnpm --filter @stealth-trails-bank/api prisma:generate
pnpm --filter @stealth-trails-bank/api prisma:migrate
~~~

### 4. Start local development

~~~bash
pnpm dev
~~~

## Common commands

Run these from the repository root unless noted otherwise.

### Root commands

| Command | Purpose |
|---------|---------|
| `pnpm dev` | Start repo development tasks |
| `pnpm build` | Build workspace packages that define a build script |
| `pnpm test` | Run workspace tests |
| `pnpm lint` | Run lint tasks where defined |
| `pnpm compile` | Run compile tasks where defined |

### Package-scoped examples

~~~bash
pnpm --filter @stealth-trails-bank/web dev
pnpm --filter @stealth-trails-bank/api start:dev
pnpm --filter @stealth-trails-bank/api prisma:generate
pnpm --filter @stealth-trails-bank/api prisma:migrate
~~~

## Documentation map

Use these docs first when working in the repo:

- `docs/architecture/target-system.md`
- `docs/architecture/production-roadmap.md`
- `docs/architecture/data-model-target.md`
- `docs/architecture/schema-transition-plan.md`

Use the runbooks when operating or verifying implemented flows:

- wallet projection and repair runbooks under `docs/runbooks/`
- deposit intent request, operator review, and execution runbooks
- manual review and audit summary runbooks

## Engineering standards for this repo

The project is being developed with a production-grade bias.

That means contributions should aim for:

- small focused modules
- descriptive names
- strong typing
- explicit validation
- durable auditability for important state changes
- safe idempotent workflow behavior
- no hidden magic around money state
- readable code over clever code

For money-moving or state-critical changes, always prefer:

- explicit state transitions
- durable persistence
- audit visibility
- recovery-safe behavior

## Production posture

This repository should be treated as a product codebase, not a demo template.

A change is not production-grade here just because it works locally. It should also be:

- reviewable
- testable
- recoverable
- operationally understandable
- safe to extend later

For that reason, some parts of the repo will look more deliberate than move fast prototypes. That is by design.

## Security note

This repo contains financial workflow logic and blockchain-connected code.

Do not:

- commit secrets
- commit real private keys
- expose internal operator or worker keys
- treat prototype defaults as production-safe settings

Please read `SECURITY.md` before reporting issues or handling sensitive findings.

## Collaboration

Please read these files before opening major changes:

- `CONTRIBUTING.md`
- `CODE_OF_CONDUCT.md`
- `SECURITY.md`

## License

This repository is currently distributed under a proprietary license. See `LICENSE`.

If you later decide to open-source all or part of the repo, the license can be changed intentionally instead of by accident.
