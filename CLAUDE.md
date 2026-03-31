# CLAUDE.md

## Project Overview

Stealth Trails Bank is being transformed from a prototype DeFi style monorepo into a production grade Ethereum financial platform with a bank like user experience.

Current repo reality:
- apps/web exists and is a real UI codebase, but it is still mostly mocked and is not yet the final production banking UI
- apps/api is the main NestJS backend
- packages/contracts contains older staking prototype work
- the platform is moving from legacy User centric flows toward Customer, CustomerAccount, Wallet, and later TransactionIntent plus ledger backed accounting

## Main Direction

Build this as a professional Ethereum financial platform, not a casually patched prototype.

Work in controlled phases:
- lock architecture first
- keep shared boundaries clean
- move from legacy User flows to Customer and Wallet projections
- delay broad runtime rewrites until the current slice is proven
- treat ledger derived balances as the long term source of truth

## Current Verified State

The following has been verified from repo inspection and handoff notes:
- shared workspace boundaries exist for apps/admin, apps/worker, packages/config, packages/types, and packages/db
- packages/config is the runtime config spine
- packages/db is the shared Prisma boundary
- packages/types contains shared profile contract work
- Prisma schema includes Customer, CustomerAccount, Wallet, Asset, TransactionIntent, ReviewCase, and AuditEvent
- apps/web exists today
- the UI is present, but it is not yet the rebuilt production banking experience
- many later wallet migration steps were drafted in chat, but must not be assumed landed locally until file contents prove them

## Working Rules

- treat this as an existing repo with real code and pre existing issues
- do not assume the repo is green
- do not assume previous planned patches exist until files prove it
- work one meaningful step at a time
- prefer the smallest safe cohesive patch
- keep changes additive when possible
- never claim something is green unless commands prove it
- state assumptions explicitly instead of guessing requirements

## Coding Rules

- no comments in code unless explicitly requested
- use descriptive and consistent names
- keep functions small, focused, and readable
- prefer reusable modules over large multi purpose files
- write production grade code with strong typing, validation, and error handling
- avoid hardcoded values, hacks, and tight coupling
- keep code modular, testable, and scalable
- follow the existing architecture and naming conventions unless intentionally improving them
- keep commit messages under 140 characters

## Patch Application Preferences

When writing file creation or modification scripts for this repo:
- prefer a single copy paste safe bash script
- avoid heredocs
- prefer python3 -c with Path.write_text for creating or replacing files
- keep scripts idempotent when practical
- append file verification with sed -n
- separate verification commands from implementation code when possible

## Migration Principles

- legacy User still exists and is still part of the migration surface
- do not remove legacy fallback until coverage is proven
- product chain selection comes from PRODUCT_CHAIN_ID
- default product chain for v1 is 8453
- CustomerAccount is one per customer
- one product chain wallet per customer account is the intended steady state
- wallet identity is unique by chainId plus address
- conflicts and mismatches should go to manual review before broader automation
- prefer audit and repair tooling before removing compatibility paths

## Verified Execution Style For This Repo

Use this order whenever proposing or applying a meaningful implementation step:
1. WHAT THIS STEP DOES
2. CODE
3. VERIFICATION COMMANDS
4. EXPECTED RESULT
5. COMMIT MESSAGE
6. GIT COMMANDS
7. NEXT BEST STEP

## Current Priority

Before stacking more migration work, re inspect the local repo and confirm which drafted steps actually landed.

Especially verify:
- wallet backfill
- wallet first public profile read
- internal wallet lookup path
- wallet coverage audit
- targeted wallet repair scripts
- manual review export

Continue from the last confirmed local state, not from the planned state.

## High Value Files To Inspect First

- apps/api/src/auth/auth.service.ts
- apps/api/src/auth/auth.controller.ts
- apps/api/src/user/user.service.ts
- apps/api/src/scripts/backfill-customer-accounts.ts
- apps/api/src/scripts/backfill-customer-wallets.ts
- apps/api/src/scripts/audit-wallet-projection-coverage.ts
- apps/api/src/scripts/repair-customer-wallet-projections.ts
- apps/api/src/scripts/repair-customer-account-wallet-projections.ts
- apps/api/src/scripts/export-wallet-projection-manual-review-queue.ts
- packages/config/src/node-runtime-config.ts
- packages/types/src/user-profile.ts
- apps/api/prisma/schema.prisma
- apps/api/package.json
- apps/web/package.json

## What Not To Do Next

Do not jump ahead into assets, intents, review cases, ledger, or broad UI rebuild work until the wallet migration slice is verified locally.

Do not remove legacy fallback just because the planned migration steps look complete on paper.

## Immediate Next Step

Run a repo reality check on the files above, confirm the actual local state, and then continue the wallet migration from the last verified point.
