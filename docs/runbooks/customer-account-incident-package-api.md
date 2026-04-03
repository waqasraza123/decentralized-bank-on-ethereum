# Customer Account Incident Package API

## Purpose

This runbook covers the first export ready customer account incident package slice for operators.

This slice gives one stable package that bundles:
- customer summary
- current restriction state
- balances
- active holds
- hold history
- review cases
- oversight incidents
- recent transaction intents
- normalized timeline

It also provides a markdown rendering for human review and handoff.

## Authentication

These endpoints require:
- x-operator-api-key
- x-operator-id

## JSON incident package

Endpoint:
GET /customer-account-incident-package/internal?customerAccountId=account_1&recentLimit=20&timelineLimit=100

Alternative lookup:
GET /customer-account-incident-package/internal?supabaseUserId=supabase_1&recentLimit=20&timelineLimit=100

At least one of these is required:
- customerAccountId
- supabaseUserId

Optional filters:
- dateFrom
- dateTo
- recentLimit
- timelineLimit

Expected behavior:
- returns one stable JSON incident package
- uses the customer account timeline service as the narrative spine
- adds current operational context around that timeline

## Markdown incident package

Endpoint:
GET /customer-account-incident-package/internal/markdown?customerAccountId=account_1&recentLimit=20&timelineLimit=100

Expected behavior:
- builds the same package data as the JSON endpoint
- renders a markdown narrative for:
  - human review
  - support handoff
  - compliance handoff
  - internal incident notes

## Package sections

The JSON package currently includes:
- generatedAt
- customer
- accountStatus
- currentRestriction
- counts
- balances
- activeHolds
- holdHistory
- reviewCases
- oversightIncidents
- recentTransactionIntents
- timeline
- limits

## Success condition

A successful incident package slice should produce:
- one export ready operator package endpoint
- one markdown export path for human readable handoff
- no need to manually stitch together multiple endpoints for support, compliance, or escalation review
