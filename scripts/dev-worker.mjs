#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const repoRoot = path.resolve(import.meta.dirname, "..");
const workerEnvPath = path.join(repoRoot, "apps", "worker", ".env");
const DEFAULT_INTERNAL_API_BASE_URL = "http://localhost:9001";
const DEFAULT_WAIT_TIMEOUT_MS = 120_000;
const POLL_INTERVAL_MS = 1_000;

function parseEnvFile(filePath) {
  if (!existsSync(filePath)) {
    return {};
  }

  const values = {};
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

    values[key] = value;
  }

  return values;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function resolveInternalApiBaseUrl() {
  const envFile = parseEnvFile(workerEnvPath);
  return (
    process.env.INTERNAL_API_BASE_URL?.trim() ||
    envFile.INTERNAL_API_BASE_URL?.trim() ||
    DEFAULT_INTERNAL_API_BASE_URL
  ).replace(/\/+$/u, "");
}

function resolveWaitTimeoutMs() {
  const rawValue = process.env.WORKER_DEV_API_WAIT_TIMEOUT_MS?.trim();

  if (!rawValue) {
    return DEFAULT_WAIT_TIMEOUT_MS;
  }

  const parsedValue = Number(rawValue);

  if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
    throw new Error("WORKER_DEV_API_WAIT_TIMEOUT_MS must be a positive integer.");
  }

  return parsedValue;
}

async function isApiReady(baseUrl) {
  try {
    const response = await fetch(`${baseUrl}/healthz`, {
      method: "GET"
    });

    return response.ok;
  } catch {
    return false;
  }
}

async function main() {
  const baseUrl = resolveInternalApiBaseUrl();
  const waitTimeoutMs = resolveWaitTimeoutMs();
  const deadlineMs = Date.now() + waitTimeoutMs;

  while (Date.now() < deadlineMs) {
    if (await isApiReady(baseUrl)) {
      return;
    }

    await sleep(POLL_INTERVAL_MS);
  }

  console.error(
    `Worker dev startup failed: API health endpoint did not become ready at ${baseUrl}/healthz within ${waitTimeoutMs}ms.`
  );
  process.exit(1);
}

await main();
