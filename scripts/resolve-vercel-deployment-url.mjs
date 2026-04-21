#!/usr/bin/env node

import process from "node:process";

const vercelApiBaseUrl = "https://api.vercel.com/v6/deployments";
const defaultTimeoutMs = 10 * 60 * 1000;
const defaultPollIntervalMs = 10 * 1000;

function parseArgs(argv) {
  const options = {
    projectId: null,
    sha: null,
    teamId: process.env["VERCEL_ORG_ID"] ?? null,
    target: null,
    timeoutMs: defaultTimeoutMs,
    pollIntervalMs: defaultPollIntervalMs
  };

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];

    if (current === "--project-id") {
      options.projectId = argv[index + 1] ?? null;
      index += 1;
      continue;
    }

    if (current === "--sha") {
      options.sha = argv[index + 1] ?? null;
      index += 1;
      continue;
    }

    if (current === "--team-id") {
      options.teamId = argv[index + 1] ?? null;
      index += 1;
      continue;
    }

    if (current === "--target") {
      options.target = argv[index + 1] ?? null;
      index += 1;
      continue;
    }

    if (current === "--timeout-ms") {
      options.timeoutMs = Number(argv[index + 1] ?? defaultTimeoutMs);
      index += 1;
      continue;
    }

    if (current === "--poll-interval-ms") {
      options.pollIntervalMs = Number(argv[index + 1] ?? defaultPollIntervalMs);
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${current}`);
  }

  if (!options.projectId || !options.sha) {
    throw new Error("resolve-vercel-deployment-url requires --project-id and --sha.");
  }

  return options;
}

function sleep(durationMs) {
  return new Promise((resolve) => {
    setTimeout(resolve, durationMs);
  });
}

async function fetchDeployments(options) {
  const url = new URL(vercelApiBaseUrl);
  url.searchParams.set("projectId", options.projectId);
  url.searchParams.set("sha", options.sha);
  url.searchParams.set("state", "READY");
  url.searchParams.set("limit", "20");

  if (options.teamId) {
    url.searchParams.set("teamId", options.teamId);
  }

  if (options.target) {
    url.searchParams.set("target", options.target);
  }

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${process.env["VERCEL_TOKEN"] ?? ""}`
    }
  });

  if (!response.ok) {
    throw new Error(
      `Failed to query Vercel deployments: ${response.status} ${await response.text()}`
    );
  }

  return await response.json();
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const token = process.env["VERCEL_TOKEN"];

  if (!token) {
    throw new Error("VERCEL_TOKEN must be set to resolve a Vercel deployment URL.");
  }

  const deadline = Date.now() + options.timeoutMs;

  while (Date.now() < deadline) {
    const result = await fetchDeployments(options);
    const deployment = (result.deployments ?? []).find((candidate) => {
      if (!candidate?.url) {
        return false;
      }

      if (candidate?.meta?.githubCommitSha && candidate.meta.githubCommitSha !== options.sha) {
        return false;
      }

      return true;
    });

    if (deployment?.url) {
      process.stdout.write(`https://${deployment.url}`);
      return;
    }

    await sleep(options.pollIntervalMs);
  }

  throw new Error(
    `Timed out waiting for a READY Vercel deployment for ${options.sha}.`
  );
}

main().catch((error) => {
  console.error(
    error instanceof Error
      ? error.message
      : "Failed to resolve Vercel deployment URL."
  );
  process.exit(1);
});
