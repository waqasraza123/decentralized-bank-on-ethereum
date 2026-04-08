#!/bin/sh
set -eu

repo_root="$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"
cd "$repo_root"

echo "Running push verification checks..."
pnpm build

echo "Push verification passed."
