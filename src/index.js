// Public entry point for the n8n_wrapper package.
//
// Re-exports the low-level HTTP client, the high-level n8n resource client and
// the configuration factory so consumers can import from a single module.

import { $http, request } from "./http.js";
import { n8n } from "./n8n.js";
import { createInstance, ConfigError } from "./config.js";

export { $http, request, n8n, createInstance, ConfigError };

const index = { $http, n8n, createInstance, ConfigError };
export default index;
