// Web UI logic for the n8n wrapper.
//
// Talks to the local proxy (/api/proxy) rather than n8n directly, which keeps
// the browser out of CORS' reach. Connection settings persist in localStorage.

const KEYS = {
  url: "n8n.url",
  apiKey: "n8n.apiKey",
  timeout: "n8n.timeout",
  retries: "n8n.retries",
};

const el = (id) => document.getElementById(id);

const state = {
  config: { URL: "", API_KEY: "", timeout: 30000, retries: 2 },
  connected: false,
};

function loadConfig() {
  const url = localStorage.getItem(KEYS.url);
  if (url) {
    state.config = {
      URL: url,
      API_KEY: localStorage.getItem(KEYS.apiKey) ?? "",
      timeout: Number(localStorage.getItem(KEYS.timeout)) || 30000,
      retries: Number(localStorage.getItem(KEYS.retries)) || 2,
    };
    el("cfgUrl").value = state.config.URL;
    el("cfgApiKey").value = state.config.API_KEY;
    el("cfgTimeout").value = state.config.timeout;
    el("cfgRetries").value = state.config.retries;
  }
}

function setStatus(text, kind) {
  const s = el("status");
  s.textContent = text;
  s.style.color = kind === "ok" ? "var(--ok)" : kind === "err" ? "var(--err)" : "var(--muted)";
}

async function connect() {
  state.config.URL = el("cfgUrl").value.trim();
  state.config.API_KEY = el("cfgApiKey").value.trim();
  state.config.timeout = Number(el("cfgTimeout").value) || 30000;
  state.config.retries = Number(el("cfgRetries").value) || 2;

  localStorage.setItem(KEYS.url, state.config.URL);
  localStorage.setItem(KEYS.apiKey, state.config.API_KEY);
  localStorage.setItem(KEYS.timeout, state.config.timeout);
  localStorage.setItem(KEYS.retries, state.config.retries);

  el("connectBtn").disabled = true;
  setStatus("Connecting…", "warn");
  try {
    await proxyRequest({ method: "GET", endpoint: "api/v1/workflows" });
    state.connected = true;
    setStatus("● connected", "ok");
  } catch (err) {
    state.connected = false;
    setStatus(`✕ connection failed: ${err.message}`, "err");
    throw err;
  } finally {
    el("connectBtn").disabled = false;
  }
}

async function proxyRequest({ method, endpoint, payload, query }) {
  const res = await fetch("/api/proxy", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      config: state.config,
      method,
      endpoint,
      payload: method === "POST" || method === "PUT" ? payload : undefined,
      query,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (data && data.error) || `HTTP ${res.status}`;
    const err = new Error(msg);
    err.status = data.status ?? res.status;
    throw err;
  }
  return data.body;
}

function sendRequest() {
  if (!state.connected) {
    setStatus("✕ not connected — configure connection first", "err");
    return;
  }

  const method = el("method").value;
  const endpoint = el("endpoint").value.trim();
  const output = el("output");
  const meta = el("meta");

  meta.textContent = "";
  output.className = "output";
  output.textContent = "Sending…";

  let query;
  try {
    query = el("query").value.trim() ? JSON.parse(el("query").value) : undefined;
  } catch (err) {
    output.textContent = `Invalid query JSON: ${err.message}`;
    output.classList.add("err");
    return;
  }

  let payload;
  const bodyRaw = el("body").value.trim();
  if (bodyRaw) {
    try {
      payload = JSON.parse(bodyRaw);
    } catch (err) {
      output.textContent = `Invalid body JSON: ${err.message}`;
      output.classList.add("err");
      return;
    }
  }

  proxyRequest({ method, endpoint, payload, query })
    .then((body) => {
      output.className = "output ok";
      meta.textContent = `${method} ${endpoint} · ${new Date().toLocaleTimeString()}`;
      output.textContent = typeof body === "string" ? body : JSON.stringify(body, null, 2);
    })
    .catch((err) => {
      output.className = "output err";
      meta.textContent = `${method} ${endpoint} · error`;
      output.textContent = `${err.message} (status: ${err.status ?? "n/a"})`;
    });
}

function bind() {
  el("configToggle").addEventListener("click", () =>
    el("configPanel").classList.toggle("collapsed"),
  );
  el("connectBtn").addEventListener("click", connect);
  el("sendBtn").addEventListener("click", sendRequest);
  el("clearRes").addEventListener("click", () => {
    el("output").textContent = "Output cleared.";
    el("output").className = "output";
    el("meta").textContent = "";
  });
}

loadConfig();
bind();
setStatus(state.config.URL ? "⚪ configured" : "⚪ not connected", "warn");
