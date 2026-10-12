// Low-level HTTP wrapper around the global `fetch`.
//
// Provides header construction, timeout, retries, robust error handling and
// JSON body serialization for GET/POST/PUT/DELETE requests against an n8n server.

const DEFAULT_TIMEOUT = 30_000;
const DEFAULT_RETRIES = 2;

/**
 * Build the standard n8n API request headers.
 * @param {{API_KEY: string}} INSTANCE
 */
function createHeaders(INSTANCE) {
  return {
    accept: "application/json",
    "X-N8N-API-KEY": INSTANCE.API_KEY,
  };
}

/**
 * Parse a response body based on its content-type.
 * @param {Response} res
 */
async function parseBody(res) {
  const contentType = res.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return res.json();
  }

  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/**
 * Sleep helper.
 * @param {number} ms
 */
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Perform a single HTTP request with timeout + retry/backoff.
 *
 * @param {{URL: string, API_KEY: string, timeout?: number, retries?: number}} INSTANCE
 * @param {object} opts - { method, endpoint, body, headers, query, returnHeaders }
 * @returns {Promise<unknown>|Promise<{body: unknown, headers: Headers}>}
 */
async function request(INSTANCE, { method, endpoint, body, query, headers, returnHeaders }) {
  const timeout = INSTANCE.timeout ?? DEFAULT_TIMEOUT;
  const retries = INSTANCE.retries ?? DEFAULT_RETRIES;

  const url = new URL(`${INSTANCE.URL}/${endpoint}`);
  if (query) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null) params.set(key, value);
    }
    const qs = params.toString();
    if (qs) url.search = qs;
  }

  const init = {
    method,
    headers: {
      ...createHeaders(INSTANCE),
      ...(headers || {}),
    },
  };

  if (body !== undefined && body !== null) {
    init.body = typeof body === "string" ? body : JSON.stringify(body);
    if (!init.headers["content-type"]) {
      init.headers["content-type"] = "application/json";
    }
  }

  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    let res;
    try {
      res = await fetch(url.toString(), { ...init, signal: controller.signal });
    } catch (err) {
      lastError = err;
    } finally {
      clearTimeout(timer);
    }

    if (res) {
      if (res.ok) {
        if (returnHeaders) return { body: await parseBody(res), headers: res.headers };
        return parseBody(res);
      }
      // Non-2xx: read body for context, then throw a descriptive error.
      let detail;
      try {
        detail = await res.json();
      } catch {
        detail = await res.text().catch(() => "");
      }
      lastError = new Error(
        `n8n request failed: ${method} ${endpoint} -> HTTP ${res.status} ${res.statusText || ""}`.trim() +
          (detail ? ` — ${typeof detail === "string" ? detail : JSON.stringify(detail)}` : ""),
      );
      lastError.status = res.status;
    }

    // Backoff before retry (exponential, capped).
    if (attempt < retries) {
      await delay(Math.min(1000 * 2 ** attempt, 20000));
    }
  }

  throw lastError ?? new Error(`${method} ${endpoint} failed without a response`);
}

/**
 * Generic request dispatcher.
 * @param {{URL: string, API_KEY: string, timeout?: number, retries?: number}} INSTANCE
 */
export const $http = {
  request: (INSTANCE, endpoint, options = {}, extra = {}) =>
    request(INSTANCE, { method: options.method || "GET", endpoint, ...options, ...extra }),

  get: (INSTANCE, endpoint, query) =>
    request(INSTANCE, { method: "GET", endpoint, query }),

  post: (INSTANCE, endpoint, body, query) =>
    request(INSTANCE, { method: "POST", endpoint, body, query }),

  put: (INSTANCE, endpoint, body, query) =>
    request(INSTANCE, { method: "PUT", endpoint, body, query }),

  delete: (INSTANCE, endpoint, query) =>
    request(INSTANCE, { method: "DELETE", endpoint, query }),
};

export { request };
