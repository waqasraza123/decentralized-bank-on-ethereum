#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

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

const insideWorkTree = runGit(["rev-parse", "--is-inside-work-tree"]);

if (insideWorkTree.status !== 0 || insideWorkTree.stdout.trim() !== "true") {
  console.log("Skipping hook installation because this directory is not a Git worktree.");
  process.exit(0);
}

const setHooksPath = runGit(["config", "core.hooksPath", ".githooks"]);

if (setHooksPath.status !== 0) {
  process.stderr.write(setHooksPath.stderr);
  process.exit(setHooksPath.status ?? 1);
}

console.log("Configured Git hooks path to .githooks");
