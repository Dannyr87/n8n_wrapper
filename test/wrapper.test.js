// Tests for the n8n wrapper.
//
// `fetch` is mocked so no network access is required. Uses Node's built-in test runner.

import test from "node:test";
import assert from "node:assert/strict";

import { $http } from "../src/http.js";
import { n8n } from "../src/n8n.js";
import { createInstance } from "../src/config.js";

// --- helpers ---------------------------------------------------------------

/**
 * Install a global `fetch` mock that records the last request and returns
 * a controllable response. Returns the mock so tests can configure it.
 */
function mockFetch(resolve) {
  const calls = [];
  const original = globalThis.fetch;
  globalThis.fetch = (url, init) => {
    calls.push({ url, init });
    return resolve(url, init);
  };
  return { calls, restore: () => (globalThis.fetch = original) };
}

const OK = (body, status = 200) => ({
  ok: true,
  status,
  statusText: status === 200 ? "OK" : "",
  headers: new Headers({ "content-type": "application/json" }),
  json: async () => body,
  text: async () => JSON.stringify(body),
});

const ERR = (status, body) => ({
  ok: false,
  status,
  statusText: status === 404 ? "Not Found" : "Error",
  headers: new Headers({ "content-type": "application/json" }),
  json: async () => body,
  text: async () => JSON.stringify(body),
});

const INSTANCE = { URL: "http://localhost:5678", API_KEY: "test-key", timeout: 1000, retries: 0 };

// --- config ----------------------------------------------------------------

test("createInstance validates required fields", () => {
  assert.throws(() => createInstance({ API_KEY: "x" }), /URL/);
  assert.throws(() => createInstance({ URL: "http://x" }), /API_KEY/);
});

test("createInstance normalizes URL to origin", () => {
  const inst = createInstance({ URL: "http://localhost:5678/", API_KEY: "k" });
  assert.equal(inst.URL, "http://localhost:5678");
});

// --- http ------------------------------------------------------------------

test("GET builds correct URL + header", async (t) => {
  const m = mockFetch(() => OK([{ id: 1 }]));
  const res = await $http.get(INSTANCE, "api/v1/workflows", { limit: 5 });

  assert.deepEqual(res, [{ id: 1 }]);
  const call = m.calls[0];
  assert.equal(call.url, "http://localhost:5678/api/v1/workflows?limit=5");
  assert.equal(call.init.headers["X-N8N-API-KEY"], "test-key");
  assert.equal(call.init.method, "GET");
  m.restore();
});

test("POST serializes body to JSON", async (t) => {
  const m = mockFetch(() => OK({ created: true }));
  const res = await $http.post(INSTANCE, "api/v1/workflows", { name: "x" });

  assert.deepEqual(res, { created: true });
  assert.equal(m.calls[0].init.body, JSON.stringify({ name: "x" }));
  assert.equal(m.calls[0].init.headers["content-type"], "application/json");
  m.restore();
});

test("POST passes through raw strings", async (t) => {
  const m = mockFetch(() => OK({}));
  await $http.post(INSTANCE, "api/v1/workflows", "raw-string");
  assert.equal(m.calls[0].init.body, "raw-string");
  m.restore();
});

test("non-2xx throws a descriptive error with status", async (t) => {
  const m = mockFetch(() => ERR(404, { message: "not found" }));
  await assert.rejects(
    () => $http.get(INSTANCE, "api/v1/workflows/999"),
    (err) => {
      assert.ok(err instanceof Error);
      assert.equal(err.status, 404);
      assert.match(err.message, /HTTP 404/);
      assert.match(err.message, /not found/);
      return true;
    },
  );
  m.restore();
});

test("network error is surfaced", async (t) => {
  const m = mockFetch(() => { throw new Error("ECONNREFUSED"); });
  await assert.rejects(() => $http.get(INSTANCE, "api/v1/workflows"), /ECONNREFUSED/);
  m.restore();
});

test("retries then succeeds", async (t) => {
  let n = 0;
  const m = mockFetch(() => {
    n += 1;
    return n < 3 ? ERR(503, { message: "temp" }) : OK([{ ok: true }]);
  });
  const res = await $http.get({ ...INSTANCE, retries: 5 }, "api/v1/workflows");
  assert.deepEqual(res, [{ ok: true }]);
  assert.equal(n, 3);
  m.restore();
});

// --- n8n resources ---------------------------------------------------------

test("n8n.get.workflows maps to correct endpoint", async (t) => {
  const m = mockFetch(() => OK([]));
  const res = await n8n.get.workflows(INSTANCE, { limit: 3 });
  assert.deepEqual(res, []);
  assert.equal(m.calls[0].url, "http://localhost:5678/api/v1/workflows?limit=3");
  m.restore();
});

test("n8n.post.create uses generic entity path", async (t) => {
  const m = mockFetch(() => OK({ id: 7 }));
  const res = await n8n.post.create(INSTANCE, "workflows", { name: "a" });
  assert.deepEqual(res, { id: 7 });
  assert.equal(m.calls[0].url, "http://localhost:5678/api/v1/workflows");
  m.restore();
});

test("list() flattens pages using X-Next-Page header", async (t) => {
  const pages = [
    [{ id: 1 }, { id: 2 }],
    [{ id: 3 }],
  ];
  let i = 0;
  const m = mockFetch(() => {
    const body = pages[Math.min(i, pages.length - 1)];
    i += 1;
    const next = i < pages.length ? "cursor-" + (i + 1) : "";
    return {
      ok: true,
      status: 200,
      statusText: "OK",
      headers: new Headers({ "content-type": "application/json", "X-Next-Page": next }),
      json: async () => body,
      text: async () => JSON.stringify(body),
    };
  });

  const all = await n8n.list(INSTANCE, "api/v1/workflows", { limit: 2 });
  assert.deepEqual(all, [{ id: 1 }, { id: 2 }, { id: 3 }]);
  m.restore();
});

