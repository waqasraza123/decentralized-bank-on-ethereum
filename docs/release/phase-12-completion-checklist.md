# Phase 12 Completion Checklist

This document is the human entrypoint for the repo-owned Phase 12 checklist.

The source of truth is now printable from the launch-closure CLI:

```bash
pnpm release:launch-closure -- checklist
```

For a release-scoped checklist:

```bash
pnpm release:launch-closure -- checklist --manifest ./launch-manifest.json
```

Use that command when you need the exact ordered path from the current repo state to launch readiness.

What the checklist covers:

- repo-owned and locally verifiable proof that should be rerun before staging-like execution
- manifest validation and launch-pack scaffolding
- the exact external-only operational evidence sequence
- the governed launch-approval gate
- adjacent follow-on hardening items that matter for a broadly production-grade product but are not yet enforced by the current Phase 12 gate

Related docs:

- [`docs/runbooks/phase-12-launch-closure.md`](/Users/mc/development/blockchain/ethereum/stealth-trails-bank/docs/runbooks/phase-12-launch-closure.md)
- [`docs/release/launch-checklist.md`](/Users/mc/development/blockchain/ethereum/stealth-trails-bank/docs/release/launch-checklist.md)
- [`docs/runbooks/release-launch-approval.md`](/Users/mc/development/blockchain/ethereum/stealth-trails-bank/docs/runbooks/release-launch-approval.md)
