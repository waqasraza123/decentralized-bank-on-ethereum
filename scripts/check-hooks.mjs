#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const expectedHooksPath = path.join(repoRoot, ".githooks");

function runGit(args) {
  const result = spawnSync("git", args, {
    cwd: repoRoot,
    encoding: "utf8"
  });

  if (result.error) {
    throw result.error;
  }

  return result;
}

const hooksPathResult = runGit(["config", "--path", "--get", "core.hooksPath"]);

if (hooksPathResult.status !== 0) {
  console.error(
    "Git hooks are not configured. Run `pnpm setup:hooks` before pushing."
  );
  process.exit(1);
}

const configuredHooksPath = hooksPathResult.stdout.trim();
const normalizedConfiguredHooksPath = path.resolve(repoRoot, configuredHooksPath);

if (normalizedConfiguredHooksPath !== expectedHooksPath) {
  console.error(
    `Git hooks are misconfigured. Expected ${expectedHooksPath}, found ${normalizedConfiguredHooksPath}. Run \`pnpm setup:hooks\` and retry.`
  );
  process.exit(1);
}

console.log(`Git hooks are configured at ${normalizedConfiguredHooksPath}`);
