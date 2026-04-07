# Treasury Visibility API

This runbook covers the internal treasury visibility surface used by operators to inspect treasury wallet inventory and treasury-linked activity without direct database access.

## Treasury overview

Request:

```http
GET /treasury/internal/overview?walletLimit=12&activityLimit=12&alertLimit=6&staleAfterSeconds=180
```

Response shape:
- `generatedAt`
- `coverage`
- `walletSummary`
- `managedWorkers`
- `wallets`
- `recentActivity`
- `recentAlerts`

## Coverage meaning

`coverage` answers whether managed execution has the wallet boundaries it needs:
- `managedWorkerCount`
- `activeTreasuryWalletCount`
- `activeOperationalWalletCount`
- `customerLinkedWalletCount`
- `missingManagedWalletCoverage`
- `openTreasuryAlertCount`

Operational interpretation:
- missing treasury or operational wallet coverage is critical when managed workers are active
- treasury or operational wallets linked to customer accounts are a critical data-boundary violation
- degraded or stale managed workers should be investigated alongside wallet coverage

## Wallet inventory

Each wallet entry returns:
- wallet identity, chain, address, kind, custody type, and status
- recent linked-intent count
- last linked activity timestamp
- any linked customer assignment when a treasury wallet is incorrectly attached to a customer account

Use this section to:
- confirm operational and treasury wallet presence on the product chain
- spot archived or restricted treasury infrastructure
- detect customer-account linkage drift on treasury-scoped wallets

## Recent treasury activity

`recentActivity` returns recent intents that are treasury-linked by either:
- `intentType = treasury_transfer`
- source wallet kind is `treasury` or `operational`
- destination wallet kind is `treasury` or `operational`

Use it to trace:
- treasury transfers
- managed-fund movement touching operational wallets
- latest blockchain transaction state for treasury-linked intents

## Alerts

`recentAlerts` returns open `PlatformAlert` rows in the `treasury` category so operators can see current treasury-specific failures beside the wallet inventory that caused them.
