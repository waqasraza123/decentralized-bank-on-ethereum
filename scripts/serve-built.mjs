#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

const rootDirectory = process.cwd();
const dotenvFilePath = path.join(rootDirectory, ".env");

function loadDotenvFile(filePath) {
  if (!existsSync(filePath)) {
    return {};
  }

  return readFileSync(filePath, "utf8")
    .split(/\r?\n/u)
    .reduce((env, line) => {
      const trimmedLine = line.trim();

      if (!trimmedLine || trimmedLine.startsWith("#")) {
        return env;
      }

      const separatorIndex = trimmedLine.indexOf("=");

      if (separatorIndex <= 0) {
        return env;
      }

      const key = trimmedLine.slice(0, separatorIndex).trim();
      const rawValue = trimmedLine.slice(separatorIndex + 1).trim();
      const unquotedValue = rawValue.replace(/^['"]|['"]$/gu, "");

      env[key] = unquotedValue;
      return env;
    }, {});
}

const dotenvEnv = loadDotenvFile(dotenvFilePath);
const apiPort = process.env.API_PORT ?? dotenvEnv.API_PORT ?? "9001";
const internalApiBaseUrl =
  process.env.INTERNAL_API_BASE_URL ??
  dotenvEnv.INTERNAL_API_BASE_URL ??
  `http://localhost:${apiPort}`;

const services = [
  {
    name: "api",
    command: "node",
    args: ["apps/api/dist/main.js"],
    checkPath: "apps/api/dist/main.js",
    env: {
      API_PORT: apiPort,
    },
  },
  {
    name: "worker",
    command: "node",
    args: ["apps/worker/dist/index.js"],
    checkPath: "apps/worker/dist/index.js",
    env: {
      INTERNAL_API_BASE_URL: internalApiBaseUrl,
    },
  },
  {
    name: "web",
    command: "node",
    args: ["scripts/serve-static-spa.mjs", "apps/web/dist", "4173"],
    checkPath: "apps/web/dist/index.html",
  },
  {
    name: "admin",
    command: "node",
    args: ["scripts/serve-static-spa.mjs", "apps/admin/dist", "4174"],
    checkPath: "apps/admin/dist/index.html",
  },
  {
    name: "mobile",
    command: "node",
    args: ["scripts/serve-static-spa.mjs", "apps/mobile/dist", "4175"],
    checkPath: "apps/mobile/dist/index.html",
  },
];

const missingOutputs = services
  .filter((service) => !existsSync(path.join(rootDirectory, service.checkPath)))
  .map((service) => service.checkPath);

if (missingOutputs.length > 0) {
  console.error("Missing build output. Run `pnpm build:apps` first.");
  for (const missingOutput of missingOutputs) {
    console.error(`- ${missingOutput}`);
  }
  process.exit(1);
}

const children = [];
let shuttingDown = false;

function stopAll(exitCode = 0) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;

  for (const child of children) {
    if (!child.killed) {
      child.kill("SIGTERM");
    }
  }

  setTimeout(() => process.exit(exitCode), 250);
}

for (const service of services) {
  const child = spawn(service.command, service.args, {
    cwd: rootDirectory,
    env: {
      ...process.env,
      ...service.env,
    },
    stdio: "inherit",
  });

  child.on("exit", (code, signal) => {
    if (shuttingDown) {
      return;
    }

    if (signal) {
      console.error(`${service.name} exited from signal ${signal}`);
      stopAll(1);
      return;
    }

    if ((code ?? 0) !== 0) {
      console.error(`${service.name} exited with code ${code}`);
      stopAll(code ?? 1);
    }
  });

  children.push(child);
}

console.log("Serving built apps:");
console.log(`- API: http://localhost:${apiPort}`);
console.log("- Web: http://localhost:4173");
console.log("- Admin: http://localhost:4174");
console.log("- Mobile web: http://localhost:4175");
console.log(`- Worker: background process (${internalApiBaseUrl})`);

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => stopAll(0));
}
