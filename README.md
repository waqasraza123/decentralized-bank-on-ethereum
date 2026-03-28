# Stealth Trails Bank

Monorepo for a DeFi-style banking experience: a **Vite + React** web app, a **NestJS** API with **Prisma** (PostgreSQL) and **Supabase**, and **Solidity** staking contracts built with **Hardhat**. The stack is orchestrated with **pnpm** workspaces and **Turborepo**.

## Repository layout

| Path | Package | Role |
|------|---------|------|
| `apps/web` | `@stealth-trails-bank/web` | SPA (React, shadcn/Radix, Tailwind, React Router) |
| `apps/api` | `@stealth-trails-bank/api` | REST API (NestJS, Prisma, ethers v5 for chain calls) |
| `packages/contracts` | `@stealth-trails-bank/contracts` | Smart contracts (Hardhat, OpenZeppelin, ethers v6) |

Hardhat and contract tooling live **only** under `packages/contracts`. The API does not bundle Hardhat.

## Prerequisites

- **Node.js** (LTS recommended)
- **pnpm** `9.x` (see root `package.json` → `packageManager`)
- **PostgreSQL** reachable via `DATABASE_URL` (Prisma)
- Optional for full flows: **local Ethereum node** (e.g. `pnpm --filter @stealth-trails-bank/contracts start-node`) and a deployed staking contract address

## Quick start

```bash
pnpm install
```

### Environment variables

**Web** — copy `apps/web/.env.example` to `apps/web/.env.local`:

| Variable | Purpose |
|----------|---------|
| `VITE_SERVER_URL` | Nest API base URL (default dev: `http://localhost:9001`) |
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon (public) key |

**API** — copy `apps/api/.env.example` to `apps/api/.env`:

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string (Prisma) |
| `DIRECT_URL` | Direct DB URL (e.g. for migrations behind a pooler) |
| `SUPABASE_URL` | Supabase URL (server) |
| `SUPABASE_ANON_KEY` | Supabase anon key |
| `RPC_URL` | JSON-RPC endpoint (e.g. local Hardhat `http://127.0.0.1:8545`) |
| `STAKING_CONTRACT_ADDRESS` | Deployed staking contract |
| `ETHEREUM_PRIVATE_KEY` | Wallet used for server-side transactions (keep secret; never commit) |

`EthereumService` (event indexing) and `StakingService` both expect **`RPC_URL`** and **`STAKING_CONTRACT_ADDRESS`** where applicable.

### Database (API)

From the repo root (after `pnpm install`):

```bash
pnpm --filter @stealth-trails-bank/api run prisma:generate
pnpm --filter @stealth-trails-bank/api run prisma:migrate
```

## Scripts (root)

Run from the repository root:

| Command | Description |
|---------|-------------|
| `pnpm dev` | Turborepo `dev` (web Vite + API Nest watch; packages without `dev` are skipped) |
| `pnpm build` | Build all packages that define `build` |
| `pnpm lint` | Lint (currently defined on the web app) |
| `pnpm test` | Tests (contracts package runs Hardhat tests) |
| `pnpm compile` | `turbo run compile` (Hardhat compile for contracts) |

### Ports (default dev)

- **Web:** `8080` (Vite — see `apps/web/vite.config.ts`)
- **API:** `9001` (see `apps/api/src/main.ts`)

### Package-scoped commands

Examples:

```bash
pnpm --filter @stealth-trails-bank/web dev
pnpm --filter @stealth-trails-bank/api start:dev
pnpm --filter @stealth-trails-bank/contracts compile
pnpm --filter @stealth-trails-bank/contracts test
pnpm --filter @stealth-trails-bank/contracts start-node
```

## Architecture (high level)

1. **Browser** talks to **Nest** over HTTP (`VITE_SERVER_URL`) for auth, user, staking, pools, deposits, etc.
2. **Browser** also uses **Supabase** directly where the client is configured (`VITE_SUPABASE_*`).
3. **API** persists domain data in **PostgreSQL** via **Prisma** and uses **Supabase** for some auth/user flows.
4. **API** interacts with the chain via **ethers v5** (JSON-RPC + contract ABI in `apps/api/src/abis/`).
5. **Contracts** are compiled and tested in `packages/contracts`; ABIs in the API should stay in sync when the contract interface changes.

## Important implementation notes

- **Two ethers major versions:** `apps/api` uses **ethers v5**; `packages/contracts` uses **ethers v6**. They are intentionally isolated—do not hoist a single `ethers` version until the API is migrated.
- **ABI source of truth:** The API ships `staking.abi.json` locally. After contract changes, regenerate or copy artifacts and update that file (or introduce a shared package later).
- **Deploy script:** `packages/contracts` defines `deploy` as `hardhat run scripts/deploy.js`; ensure that script exists or adjust the command before relying on it.
- **CORS:** The API enables `origin: '*'` in development-style setup; tighten for production.
- **Secrets:** Never commit `.env` or `.env.local`. The anon key is public by design but still belongs in env files, not hardcoded in source.

## Tech summary

- **Web:** Vite 5, React 18, TypeScript, Tailwind, Radix/shadcn, TanStack Query, Zod, Zustand, Supabase JS, Axios.
- **API:** NestJS 10, Prisma 6, PostgreSQL, Supabase JS, ethers 5, class-validator, Joi.
- **Contracts:** Hardhat 2, Solidity 0.8.x, OpenZeppelin 5, Typechain, Mocha/Chai.

## Turborepo

Pipeline is defined in `turbo.json`. Task outputs include `dist/`, Hardhat `artifacts/`, `cache/`, and `typechain-types/` where relevant. See [Turborepo docs](https://turbo.build/repo/docs) for caching and filtering.
