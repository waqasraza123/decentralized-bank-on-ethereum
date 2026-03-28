# ADR 001: Chain Strategy

- Status: Accepted
- Date: 2026-03-28

## Context

The current repository is Ethereum-oriented but does not yet lock a production chain strategy.

The prototype behaves like an Ethereum product but still leaves major operational questions open:
- whether customer activity should run on Ethereum mainnet or an L2
- whether the platform should optimize for one chain or multiple chains
- whether chain-specific behavior should spread through the codebase

Leaving this ambiguous would create rework across:
- contracts
- chain integration
- wallet handling
- config
- transaction orchestration
- customer product design

## Decision

Version 1 will be built as a single-chain product on an Ethereum L2.

The default execution network for production will be Base.

Environment targets:
- local development: local EVM chain
- shared testing and staging: Base Sepolia
- production: Base mainnet

The architecture must remain EVM-portable, but multi-chain support is explicitly out of scope for version 1.

The repository must not model multiple production chains in the first implementation phases. Chain configuration should be centralized so a future chain change remains possible, but the runtime product should behave as a single-chain platform.

Ethereum mainnet is not the default customer execution environment for version 1. If future treasury, bridging, settlement, or proof workflows need mainnet visibility, those should be introduced as explicit later phases instead of leaking into the customer core model now.

## Why This Decision

This product needs:
- lower execution cost than raw Ethereum mainnet customer flows
- Ethereum-aligned developer tooling
- predictable EVM behavior across contracts and backend integration
- a clean single-chain operating model for version 1

A single L2-first decision keeps the platform practical while preserving Ethereum alignment.

## Consequences

### Positive

- contracts can target one production execution environment
- config remains simpler in v1
- wallet, deposit, withdrawal, and transaction flows can assume one chain
- worker and indexer design can be optimized for one chain first
- admin and customer UI can expose clearer state without chain fragmentation

### Negative

- cross-chain product expansion is deferred
- future mainnet-first or alternate-L2 support would require explicit expansion work
- some ecosystem choices later may need chain-specific reevaluation

## Non-Goals

This decision does not:
- finalize bridge providers
- finalize oracle providers
- authorize multi-chain product scope
- require mainnet settlement in version 1

## Implementation Implications

Phase 1 and later work should:
- add shared chain config ownership
- treat Base as the default production chain
- avoid spreading network constants across apps
- avoid building multi-chain routing abstractions in version 1
