// Web UI + API proxy server for the n8n wrapper.
//
// This server has two jobs:
//   1. Serve the static frontend assets from ../public.
//   2. Proxy requests to the configured n8n server through the wrapper's
//      `$http` client, so the browser never talks to n8n directly (which would
//      otherwise trip CORS).
//
// It uses only Node's built-in modules so the project stays dependency-free.

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { $http } from "./http.js";
import { createInstance, ConfigError } from "./config.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const PUBLIC_DIR = path.join(ROOT, "public");

// Default connection settings, overridable via environment variables.
const DEFAULTS = {
  URL: process.env.URL ?? "http://localhost:5678",
  API_KEY: process.env.API_KEY ?? "",
  timeout: process.env.TIMEOUT ? Number(process.env.TIMEOUT) : 30000,
  retries: process.env.RETRIES ? Number(process.env.RETRIES) : 2,
};

const PORT = Number(process.env.PORT ?? 3000);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

/**
 * Resolve a request path to a safe absolute file path inside PUBLIC_DIR,
 * rejecting anything that tries to escape the directory.
 */
function resolveStaticFile(urlPath) {
  const clean = decodeURIComponent(urlPath.replace(/^\/+/, ""));
  const resolved = path.normalize(clean);
  if (resolved.startsWith("..") || path.isAbsolute(resolved)) return null;

  const filePath = path.join(PUBLIC_DIR, resolved);
  if (!filePath.startsWith(PUBLIC_DIR)) return null;
  return filePath;
}

function sendJSON(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body),
    "cache-control": "no-store",
  });
  res.end(body);
}

function serveStatic(res, filePath) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      sendJSON(res, 404, { error: "Not found", path: filePath });
      return;
    }
    const ext = path.extname(filePath);
    const type = MIME[ext] ?? "application/octet-stream";
    res.writeHead(200, { "content-type": type });
    res.end(data);
  });
}

/**
 * Handle a proxied request by delegating to the wrapper's `$http` client.
 * Mirrors the instance method names: get/post/put/delete, plus the generic
 * `request` for arbitrary methods.
 */
async function handleProxy(req, res) {
  let raw = "";
  await new Promise((resolve) => {
    req.on("data", (chunk) => (raw += chunk));
    req.on("end", resolve);
  });

  let body;
  if (raw) {
    try {
      body = JSON.parse(raw);
    } catch {
      sendJSON(res, 400, { error: "Invalid JSON body" });
      return;
    }
  }

  const config = body.config ?? DEFAULTS;
  let instance;
  try {
    instance = createInstance(config);
  } catch (err) {
    if (err instanceof ConfigError) {
      sendJSON(res, 400, { error: err.message });
      return;
    }
    throw err;
  }

  const { method, endpoint, payload, query } = body;

  if (!endpoint) {
    sendJSON(res, 400, { error: "Missing 'endpoint' in proxy request." });
    return;
  }

  let result;
  try {
    switch ((method || "GET").toUpperCase()) {
      case "GET":
        result = await $http.get(instance, endpoint, query);
        break;
      case "POST":
        result = await $http.post(instance, endpoint, payload, query);
        break;
      case "PUT":
        result = await $http.put(instance, endpoint, payload, query);
        break;
      case "DELETE":
        result = await $http.delete(instance, endpoint, query);
        break;
      default:
        sendJSON(res, 400, { error: `Unsupported method: ${method}` });
        return;
    }
  } catch (err) {
    const status = err.status || 502;
    sendJSON(res, status, { error: err.message, status: err.status });
    return;
  }

  sendJSON(res, 200, { body: result });
}

const server = http.createServer((req, res) => {
  const urlPath = new URL(req.url, `http://${req.headers.host}`).pathname;

  if (urlPath === "/" || urlPath === "/index.html") {
    serveStatic(res, path.join(PUBLIC_DIR, "index.html"));
    return;
  }

  if (urlPath === "/api/proxy" && req.method === "POST") {
    handleProxy(req, res).catch((err) =>
      sendJSON(res, 500, { error: err.message || "Internal server error" }),
    );
    return;
  }

  if (urlPath === "/api/health") {
    sendJSON(res, 200, { ok: true, defaults: DEFAULTS });
    return;
  }

  const filePath = resolveStaticFile(urlPath);
  if (filePath) {
    serveStatic(res, filePath);
    return;
  }

  sendJSON(res, 404, { error: "Not found", path: urlPath });
});

server.listen(PORT, () => {
  const actual = server.address();
  const port = typeof actual === "object" && actual ? actual.port : PORT;
  console.log(`n8n wrapper web UI listening on http://localhost:${port}`);
});

export { server, DEFAULTS };
export default server;
