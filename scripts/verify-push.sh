#!/bin/sh
set -eu

repo_root="$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"
cd "$repo_root"

echo "Running push verification checks..."

echo "1/2 hook installation gate"
if ! pnpm hooks:check; then
  echo "Push verification failed: Git hooks are not installed correctly." >&2
  exit 1
fi

echo "2/2 repo test gate"
if ! pnpm test:ci; then
  echo "Push verification failed: repo test gate failed." >&2
  exit 1
fi

echo "Push verification passed."
