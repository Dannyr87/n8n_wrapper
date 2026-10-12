// Public entry point for the n8n_wrapper package.
//
// Re-exports the low-level HTTP client, the high-level n8n resource client and
// the configuration factory so consumers can import from a single module.

export { $http, request } from "./http.js";
export { n8n } from "./n8n.js";
export { createInstance, ConfigError } from "./config.js";

const index = { $http, n8n, createInstance, ConfigError };
export default index;
