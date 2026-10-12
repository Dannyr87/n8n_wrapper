// Configuration / instance factory.
//
// Produces validated INSTANCE objects that the http and n8n modules consume.

class ConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = "ConfigError";
  }
}

/**
 * Build a validated INSTANCE object from raw config.
 * Throws a ConfigError if required fields are missing.
 *
 * @param {object} config - { URL, API_KEY, baseURL?, timeout?, retries? }
 * @returns {{URL: string, API_KEY: string, baseURL: string, timeout: number, retries: number}}
 */
export function createInstance(config = {}) {
  if (typeof config === "string") {
    config = { URL: config };
  }

  const url = String(config.URL ?? "").trim();
  const API_KEY = String(config.API_KEY ?? "").trim();

  if (!url) {
    throw new ConfigError("Missing required config: URL (n8n server base URL).");
  }
  if (!API_KEY) {
    throw new ConfigError("Missing required config: API_KEY.");
  }

  const baseURL = new URL(url).origin;

  return {
    URL: baseURL,
    API_KEY,
    timeout: Number.isFinite(config.timeout) ? config.timeout : 30000,
    retries: Number.isInteger(config.retries) ? Math.max(0, config.retries) : 2,
  };
}

export { ConfigError };
