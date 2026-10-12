// High-level n8n REST API client.
//
// Resource methods are grouped into namespaces (get, post, put, del) and share
// a common query-building helper. Use `list()` for paginated collection fetches.

import { $http } from "./http.js";

/**
 * Normalize a query-options object into URLSearchParams-safe values.
 * Undefined/null values are dropped.
 */
function normalizeQuery(query) {
  if (!query) return undefined;
  const clean = {};
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null) clean[key] = value;
  }
  return clean;
}

const n8n = {
  // --- Read-only resources ---
  get: {
    projects: (INSTANCE, query) =>
      $http.get(INSTANCE, "api/v1/projects", normalizeQuery(query)),

    users: (INSTANCE, query) =>
      $http.get(INSTANCE, "api/v1/users", normalizeQuery(query)),

    workflows: (INSTANCE, query) =>
      $http.get(INSTANCE, "api/v1/workflows", normalizeQuery(query)),

    workflowById: (INSTANCE, workflowId, query) =>
      $http.get(INSTANCE, `api/v1/workflows/${workflowId}`, normalizeQuery(query)),

    executions: (INSTANCE, query) =>
      $http.get(INSTANCE, "api/v1/executions", normalizeQuery(query)),

    workflowVersions: (INSTANCE, workflowId, query) =>
      $http.get(INSTANCE, `api/v1/workflows/${workflowId}/versions`, normalizeQuery(query)),

    messages: (INSTANCE, query) =>
      $http.get(INSTANCE, "api/v1/messages", normalizeQuery(query)),
  },

  // --- Create / update resources ---
  post: {
    // Generic create: n8n.post.create(INSTANCE, ENTITY, payload, query)
    create: (INSTANCE, entity, payload, query) =>
      $http.post(INSTANCE, `api/v1/${entity}`, payload, normalizeQuery(query)),

    // Backwards-friendly alias matching the original README contract:
    // n8n.post.ENTITY(INSTANCE, ENTITY, payload)
    ENTITY: (INSTANCE, entity, payload, query) =>
      $http.post(INSTANCE, `api/v1/${entity}/${entity}`, payload, normalizeQuery(query)),
  },

  put: {
    update: (INSTANCE, workflowId, payload, query) =>
      $http.put(INSTANCE, `api/v1/workflows/${workflowId}`, payload, normalizeQuery(query)),
  },

  del: {
    workflow: (INSTANCE, workflowId, query) =>
      $http.delete(INSTANCE, `api/v1/workflows/${workflowId}`, query),
    execution: (INSTANCE, workflowId, executionId, query) =>
      $http.delete(INSTANCE, `api/v1/workflows/${workflowId}/executions/${executionId}`, query),
  },

  /**
   * Fetch every page of a paginated list endpoint and flatten the results.
   * n8n paginates via the `X-Next-Page` response header (empty when exhausted).
   *
   * @param {{URL: string, API_KEY: string, timeout?: number, retries?: number}} INSTANCE
   * @param {string} endpoint - e.g. "api/v1/workflows"
   * @param {object} query - initial query params
   * @returns {Promise<Array>} flat array of records
   */
  async list(INSTANCE, endpoint, query = {}) {
    const results = [];
    let current = normalizeQuery(query);

    // Guard against runaway loops if the server keeps returning a cursor.
    let guard = 0;
    const maxPages = 10_000;

    while (guard < maxPages) {
      guard += 1;
      const { body, headers } = await $http.request(
        INSTANCE,
        endpoint,
        { method: "GET", query: current },
        { returnHeaders: true },
      );

      if (Array.isArray(body)) results.push(...body);

      // Stop once the server stops providing a pagination cursor.
      const next = headers.get("X-Next-Page");
      if (!next) break;

      current = { ...current, next };
    }

    return results;
  },
};

export { n8n };
export default n8n;
