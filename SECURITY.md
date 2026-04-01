# Security Policy

## Scope

This repository contains financial workflow logic, internal operator paths, worker execution flows, and blockchain-connected code.

Because of that, security issues should be handled carefully and privately.

## How to report a security issue

Please report security issues privately to the repository owners or maintainers.

Do not:

- open a public issue
- post exploit details in a pull request
- share secrets, tokens, or private keys in comments
- disclose a vulnerability publicly before the maintainers have time to assess it

When reporting, include:

- a clear description of the issue
- where it exists
- impact if exploited
- steps to reproduce, if safe to share
- any proof-of-concept material that helps verification

## What counts as a security issue here

Examples include:

- authentication or authorization bypass
- operator or worker key misuse
- privilege escalation
- secret leakage
- unsafe money-state transitions
- replay or idempotency bypass in workflow execution
- ledger corruption paths
- unsafe blockchain transaction handling
- sensitive data exposure
- dependency issues with real exploit impact

## Sensitive data handling

Never commit or expose:

- real private keys
- production database credentials
- operator API keys
- worker API keys
- JWT secrets
- internal environment files

Use local development secrets only, and keep them outside version control.

## Supported response approach

Security reports will be:

- acknowledged
- reviewed
- triaged by severity and impact
- fixed in the safest practical way for the product

We may ask for follow-up details if reproduction or impact is unclear.

## Safe testing expectations

Only test against environments and assets you are authorized to use.

Do not:

- target third-party infrastructure without permission
- use real customer data
- perform destructive testing in shared environments
- use aggressive automated probing against systems you do not control

## Dependency and infrastructure hygiene

For maintainers and contributors:

- keep dependencies updated intentionally
- avoid unnecessary secret exposure in logs
- review internal auth guard behavior carefully
- treat money-state transitions as security-sensitive
- prefer durable auditability for critical flows

## Disclosure

Please allow maintainers time to investigate and remediate before any disclosure.

For this repository, private coordinated handling is the expected path.
