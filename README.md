# n8n Wrapper

A small, dependency-free Node.js client for the [n8n](https://n8n.io) HTTP REST API.
It provides a clean `n8n.get.ENTITY()` / `n8n.post.ENTITY()` style surface on top of
`fetch`, with timeout, retry, robust error handling and pagination.

## Architecture

```
main.js              Demo / smoke-script entry point
src/
  index.js           Public entry point (re-exports)
  config.js          Instance factory + validation
  http.js            Low-level fetch wrapper (timeout, retries, error handling)
  n8n.js             High-level resource methods + pagination
```

`config` builds a validated `INSTANCE` object → `http` performs the requests →
`n8n` maps those to REST resources.

## Setup

Requires **Node.js >= 18** (for the built-in `fetch`). No runtime dependencies.

```bash
cp example.env .env
# edit .env: set URL and API_KEY
```

Create an API token in n8n (**User settings → API**). Use the token value as `API_KEY`.

## Running

```bash
node --env-file=.env main.js     # demo script
npm start                        # same, via npm
npm run web                      # web UI + proxy at http://localhost:3000
```

## Usage

```js
import { createInstance, n8n } from "n8n-wrapper";

const INSTANCE = createInstance({ URL: process.env.URL, API_KEY: process.env.API_KEY });

// Single request (options-based query params)
const workflows = await n8n.get.workflows(INSTANCE, { limit: 20, excludePinnedData: true });

// Paginated: fetch every record into a flat array
const all = await n8n.list(INSTANCE, "api/v1/workflows", { excludePinnedData: true });

// Create / update via the generic post / put dispatchers
await n8n.post.create(INSTANCE, "workflows", { name: "Backup", workflow: { active: false } });
await n8n.put.update(INSTANCE, workflowId, { name: "Renamed" });
```

## API reference

### `createInstance(config)`
Validates `URL` and `API_KEY`, returns an `INSTANCE` object.
Options: `timeout` (ms, default 30000), `retries` (default 2).

### `n8n.get.*`
`projects`, `users`, `workflows`, `workflowById`, `executions`, `workflowVersions`, `messages`.
Each takes `(INSTANCE, query)` where `query` is a plain options object.

### `n8n.post.create(INSTANCE, entity, payload, query)`
Generic create for any entity (`workflows`, `executions`, etc.).

### `n8n.post.ENTITY(INSTANCE, entity, payload, query)`
Backwards-friendly alias matching the original README contract.

### `n8n.put.update`, `n8n.del.workflow`, `n8n.del.execution`
Update / delete helpers.

### `$http`
Low-level `get`, `post`, `put`, `delete`, and generic `request`.

## Use cases

- **Backup assets:** fetch workflows/versions/executions and persist them.
- **Bulk control:** enable/disable workflows by tag via `workflows?tag=<name>`.
- **Automation:** drive n8n resources programmatically from other services.

## Testing

```bash
npm test
```

## License

GPL-3.0-or-later. See [LICENSE](./LICENSE).
