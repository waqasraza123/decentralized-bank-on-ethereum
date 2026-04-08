#!/bin/sh
set -eu

node ./scripts/preflight-dev.mjs
exec pnpm exec turbo dev "$@"
