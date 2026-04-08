#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const DEFAULT_API_PORT = 9001;
const DEFAULT_INTERNAL_API_BASE_URL = "http://localhost:9001";
const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1"]);

function fail(messageLines) {
  for (const line of messageLines) {
    console.error(line);
  }

  process.exit(1);
}

function parseEnvFile(filePath) {
  if (!existsSync(filePath)) {
    return {};
  }

  const result = {};
  const contents = readFileSync(filePath, "utf8");

  for (const rawLine of contents.split(/\r?\n/u)) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");

    if (separatorIndex <= 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith("\"") && value.endsWith("\"")) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    result[key] = value;
  }

  return result;
}

function parsePositiveInteger(value, name) {
  const parsedValue = Number(value);

  if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
    fail([`Dev preflight failed: ${name} must be a positive integer.`]);
  }

  return parsedValue;
}

function loadEnvFileValues(relativePath) {
  return parseEnvFile(path.join(process.cwd(), relativePath));
}

function readApiPort() {
  const apiEnv = loadEnvFileValues("apps/api/.env");
  const rawPort = process.env["API_PORT"] ?? apiEnv["API_PORT"];

  if (!rawPort) {
    return DEFAULT_API_PORT;
  }

  return parsePositiveInteger(rawPort, "API_PORT");
}

function readWorkerInternalApiBaseUrl() {
  const workerEnv = loadEnvFileValues("apps/worker/.env");
  return (
    process.env["INTERNAL_API_BASE_URL"] ??
    workerEnv["INTERNAL_API_BASE_URL"] ??
    DEFAULT_INTERNAL_API_BASE_URL
  );
}

function validateWorkerInternalApiBaseUrl(expectedApiPort) {
  const rawBaseUrl = readWorkerInternalApiBaseUrl();
  let parsedBaseUrl;

  try {
    parsedBaseUrl = new URL(rawBaseUrl);
  } catch {
    fail([
      "Dev preflight failed: INTERNAL_API_BASE_URL must be a valid absolute URL.",
      `Resolved value: ${rawBaseUrl}`
    ]);
  }

  if (!LOCAL_HOSTNAMES.has(parsedBaseUrl.hostname)) {
    return;
  }

  const resolvedPort =
    parsedBaseUrl.port ||
    (parsedBaseUrl.protocol === "https:" ? "443" : "80");
  const normalizedExpectedPort = String(expectedApiPort);

  if (resolvedPort === normalizedExpectedPort) {
    return;
  }

  fail([
    "Dev preflight failed: worker INTERNAL_API_BASE_URL does not match the local API port.",
    `Expected local API port: ${normalizedExpectedPort}`,
    `Resolved worker base URL: ${rawBaseUrl}`,
    "Fix apps/worker/.env or your shell env so the worker targets the same local API instance before running `pnpm dev`."
  ]);
}

function ensureApiMigrationsAreApplied() {
  const migrationStatus = spawnSync(
    "pnpm",
    [
      "--filter",
      "@stealth-trails-bank/api",
      "exec",
      "prisma",
      "migrate",
      "status",
      "--schema",
      "prisma/schema.prisma"
    ],
    {
      cwd: process.cwd(),
      encoding: "utf8"
    }
  );

  if (migrationStatus.status === 0) {
    return;
  }

  const output = [migrationStatus.stdout, migrationStatus.stderr]
    .filter(Boolean)
    .join("\n")
    .trim();

  fail([
    "Dev preflight failed: the API database is behind the checked-in Prisma migrations.",
    "Run `pnpm --filter @stealth-trails-bank/api prisma:deploy` and retry `pnpm dev`.",
    output ? "" : "",
    output
  ].filter(Boolean));
}

function main() {
  const apiPort = readApiPort();
  validateWorkerInternalApiBaseUrl(apiPort);
  ensureApiMigrationsAreApplied();
  console.log("Dev preflight passed.");
}

main();
