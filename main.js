// Demo / smoke-script entry point.
//
// Reads configuration from the environment (see .env / example.env) and exercises
// the n8n wrapper. Replace the calls below to suit your use case.

import { createInstance } from "./src/config.js";
import { n8n } from "./src/n8n.js";

function loadInstance() {
  return createInstance({
    URL: process.env.URL,
    API_KEY: process.env.API_KEY,
    timeout: process.env.TIMEOUT ? Number(process.env.TIMEOUT) : undefined,
    retries: process.env.RETRIES ? Number(process.env.RETRIES) : undefined,
  });
}

async function main() {
  const INSTANCE = loadInstance();

  const projects = await n8n.get.projects(INSTANCE, { limit: 10 });
  console.log("projects:", projects);

  const users = await n8n.get.users(INSTANCE, { limit: 10, includeRole: true });
  console.log("users:", users);

  const workflows = await n8n.get.workflows(INSTANCE, { limit: 10, excludePinnedData: true });
  console.log("workflows:", workflows);

  // Example: fetch every workflow (paginated) into a single flat array.
  const allWorkflows = await n8n.list(INSTANCE, "api/v1/workflows", { excludePinnedData: true });
  console.log("allWorkflows (paginated):", allWorkflows.length);
}

main().catch((err) => {
  console.error("Fatal error:", err.message);
  process.exit(1);
});
