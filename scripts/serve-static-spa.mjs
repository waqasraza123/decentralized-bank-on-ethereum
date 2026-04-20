#!/usr/bin/env node

import { createReadStream, existsSync, statSync } from "node:fs";
import http from "node:http";
import path from "node:path";

const [, , directoryArg, portArg, hostArg = "0.0.0.0"] = process.argv;

if (!directoryArg || !portArg) {
  console.error(
    "Usage: node ./scripts/serve-static-spa.mjs <directory> <port> [host]",
  );
  process.exit(1);
}

const rootDirectory = path.resolve(process.cwd(), directoryArg);
const port = Number.parseInt(portArg, 10);

if (!Number.isInteger(port) || port <= 0) {
  console.error(`Invalid port: ${portArg}`);
  process.exit(1);
}

if (!existsSync(rootDirectory) || !statSync(rootDirectory).isDirectory()) {
  console.error(`Directory does not exist: ${rootDirectory}`);
  process.exit(1);
}

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".ttf": "font/ttf",
  ".wasm": "application/wasm",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

function safeJoin(root, requestedPath) {
  const decodedPath = decodeURIComponent(requestedPath.split("?")[0]);
  const normalizedPath = decodedPath === "/" ? "/index.html" : decodedPath;
  const fullPath = path.resolve(root, `.${normalizedPath}`);

  if (fullPath !== root && !fullPath.startsWith(`${root}${path.sep}`)) {
    return null;
  }

  return fullPath;
}

function sendFile(response, filePath) {
  const extension = path.extname(filePath).toLowerCase();
  const contentType = mimeTypes[extension] ?? "application/octet-stream";

  response.writeHead(200, {
    "Cache-Control":
      extension === ".html" ? "no-cache" : "public, max-age=31536000, immutable",
    "Content-Type": contentType,
  });

  createReadStream(filePath).pipe(response);
}

const server = http.createServer((request, response) => {
  if (!request.url) {
    response.writeHead(400);
    response.end("Bad Request");
    return;
  }

  const requestedFile = safeJoin(rootDirectory, request.url);

  if (!requestedFile) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  const targetPath =
    existsSync(requestedFile) && statSync(requestedFile).isFile()
      ? requestedFile
      : path.join(rootDirectory, "index.html");

  if (!existsSync(targetPath)) {
    response.writeHead(404);
    response.end("Not Found");
    return;
  }

  sendFile(response, targetPath);
});

server.listen(port, hostArg, () => {
  console.log(`Serving ${rootDirectory} at http://${hostArg}:${port}`);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
  });
}
