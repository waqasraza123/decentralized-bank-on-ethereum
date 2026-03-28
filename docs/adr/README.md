# Architecture Decision Records

## Purpose

This directory records the accepted architecture decisions for Stealth Trails Bank.

These decisions exist to keep implementation aligned while the repository is transformed from a prototype into a production-grade Ethereum financial platform.

## Rules

- every ADR represents a decision, not a brainstorming note
- every ADR must state status, date, context, decision, and consequences
- accepted ADRs remain active until explicitly superseded
- if a decision changes later, add a new ADR that supersedes the previous one
- implementation work should follow accepted ADRs unless a later ADR replaces them

## Current ADR Set

- `001-chain-strategy.md`
- `002-custody-model.md`
- `003-ledger-source-of-truth.md`
- `004-governance-model.md`
- `005-auth-account-lifecycle.md`
- `006-monorepo-boundaries.md`

## Phase 0 Intent

This ADR set exists to lock the first production assumptions before:
- repo restructuring
- data model redesign
- contract redesign
- customer flow rewiring
- treasury and operational hardening

## How To Use These ADRs

Before starting a new implementation phase:
1. confirm the relevant ADRs still reflect the intended direction
2. identify whether the new work depends on an unresolved decision
3. add a new ADR first if the decision is still ambiguous
4. only then implement the phase
