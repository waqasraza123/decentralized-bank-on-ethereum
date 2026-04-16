#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import process from "node:process";

const VALIDATE_BEFORE_PUSH_FLAG = "--validate-before-push";

function repoRoot() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
}

function runCommand(command, args) {
  const result = spawnSync(command, args, {
    cwd: repoRoot(),
    encoding: "utf8",
    stdio: "inherit"
  });

  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function main() {
  const forwardedArgs = [];
  let shouldValidate = false;

  for (const arg of process.argv.slice(2)) {
    if (arg === VALIDATE_BEFORE_PUSH_FLAG) {
      shouldValidate = true;
      continue;
    }

    forwardedArgs.push(arg);
  }

  if (shouldValidate) {
    runCommand("pnpm", ["verify:push"]);
  }

  runCommand("git", ["push", ...forwardedArgs]);
}

main();
