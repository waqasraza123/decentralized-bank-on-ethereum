# Wallet Projection Safe Batch Runbook

## Purpose

This runbook executes the safe wallet migration workflow in the correct operator order and produces a before-vs-after batch report.

The batch runner chains these steps:

1. pre-repair audit summary
2. missing customer projection repair
3. missing customer account and wallet repair
4. wallet-only repair
5. post-repair audit summary
6. derived delta report
7. optional manual-review export

The runner stops on the first failing step.

Dry-run mode is the default.

## Script

From `apps/api`:

~~~bash
pnpm run repair:wallet-projection-safe-batch
~~~

## Supported options

### Dry-run all rows

~~~bash
pnpm run repair:wallet-projection-safe-batch
~~~

### Dry-run limited batch

~~~bash
pnpm run repair:wallet-projection-safe-batch -- --limit=100
~~~

### Apply limited batch

~~~bash
pnpm run repair:wallet-projection-safe-batch -- --limit=100 --apply
~~~

### Dry-run one user

~~~bash
pnpm run repair:wallet-projection-safe-batch -- --email=user@example.com
~~~

### Apply one user

~~~bash
pnpm run repair:wallet-projection-safe-batch -- --email=user@example.com --apply
~~~

### Run batch and export manual-review queue

~~~bash
pnpm run repair:wallet-projection-safe-batch -- --limit=100 --export-manual-review
~~~

### Run batch and choose manual-review export path

~~~bash
pnpm run repair:wallet-projection-safe-batch -- --limit=100 --export-manual-review --manual-review-output=.artifacts/wallet-manual-review-batch.json
~~~

### Write the full batch report to a file

~~~bash
pnpm run repair:wallet-projection-safe-batch -- --limit=100 --report-output=.artifacts/wallet-safe-batch-report.json
~~~

## Output shape

The script prints one JSON object with:

* `mode`
* `productChainId`
* `filters`
* `steps`
* `delta`
* `manualReviewExport`
* `reportOutputPath`

Each step includes:

* `command`
* `summary`

The delta section includes:

* `byMetric`
* `highlights`

## Delta semantics

For each metric in the audit summary:

* `before`
* `after`
* `delta`

Examples:

* `walletProjected`

  * positive delta is good

* `autoRepairableProfiles`

  * negative delta is good

* `manualReviewProfiles`

  * negative delta is good

* `legacySourceProfiles`

  * negative delta is good

## Safety notes

* dry-run is the default
* `--apply` must be explicit
* the runner only chains the already-bounded safe repair commands
* manual-review-only rows are not auto-repaired by this command
* the batch stops immediately if any sub-step fails

## Recommended rollout

1. Run the batch in dry-run mode
2. Review the pre vs post delta
3. Apply a small limited batch
4. Re-run with report output enabled
5. Re-run with manual-review export enabled if needed
6. Hand remaining hard cases to operators

## Success condition

A successful batch should show:

* `walletProjected` increasing
* `autoRepairableProfiles` decreasing
* `legacySourceProfiles` decreasing
* manual-review export containing only the true hard cases
