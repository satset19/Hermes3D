#!/usr/bin/env node
"use strict";
/**
 * hermes3d MCP server (stdio, dependency-free). Registered in Hermes as `hermes3d`, so
 * personas get mcp__hermes3d__list_team / assign_task / task_status. Each call is
 * forwarded to the Hermes3D adapter's token-protected /team/* HTTP API.
 * stdout carries JSON-RPC only; diagnostics go to stderr.
 */
const fs = require("fs");
const path = require("path");
const readline = require("readline");

const SERVER_INFO = { name: "hermes3d-team", version: "0.1.0" };
const DEFAULT_ENV_FILE = path.join(__dirname, "..", ".env.hermes");
const ADAPTER_TIMEOUT_MS = 75_000; // task_status may wait up to 60 s server-side

const TOOLS = [
  {
    name: "list_team",
    description: "List Hermes3D team agents (id, name, role, busy). Call this before assign_task.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "assign_task",
    description: "Assign a task to a Hermes3D team agent. The agent works on it visibly in the office. Returns run_id immediately; poll task_status for the result.",
    inputSchema: {
      type: "object",
      required: ["caller_agent_id", "agent_id", "task"],
      properties: {
        caller_agent_id: { type: "string", description: "Your own Hermes3D agent_id (stated in your system prompt)." },
        agent_id: { type: "string", description: "Target agent id from list_team." },
        task: { type: "string", description: "Self-contained task instructions, including the expected deliverable." },
        title: { type: "string", description: "Short task title for the task board (optional)." },
      },
    },
  },
  {
    name: "task_status",
    description: "Get the status of an assigned task: working, done, or needs_attention. When done, response holds the agent's answer.",
    inputSchema: {
      type: "object",
      required: ["run_id"],
      properties: {
        run_id: { type: "string" },
        wait_seconds: { type: "number", description: "Wait up to this many seconds (max 60) for completion. Default 30." },
      },
    },
  },
];

const ROUTES = { list_team: "/team/list", assign_task: "/team/assign", task_status: "/team/status" };

function readEnvFile(file) {
  const out = {};
  try {
    for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
      const m = line.trim().match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (m) out[m[1]] = m[2].trim().replace(/^(['"])(.*)\1$/, "$2");
    }
  } catch {
    /* missing file -> empty */
  }
  return out;
}

function loadConfig(env = process.env) {
  const fileEnv = readEnvFile(env.HERMES3D_ENV_FILE || DEFAULT_ENV_FILE);
  const port = env.HERMES_ADAPTER_PORT || fileEnv.HERMES_ADAPTER_PORT || "18789";
  return {
    baseUrl: (env.HERMES3D_ADAPTER_URL || `http://127.0.0.1:${port}`).replace(/\/$/, ""),
    token: env.HERMES3D_TEAM_TOKEN || fileEnv.HERMES3D_TEAM_TOKEN || "",
  };
}

async function callAdapter(config, route, body, fetchImpl) {
  const res = await fetchImpl(config.baseUrl + route, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Hermes3D-Team-Token": config.token },
    body: JSON.stringify(body || {}),
    signal: AbortSignal.timeout(ADAPTER_TIMEOUT_MS),
  });
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { ok: false, error: `adapter HTTP ${res.status}: ${text.slice(0, 200)}` };
  }
}

async function handleRpc(msg, { config, fetchImpl = fetch } = {}) {
  if (!msg || typeof msg !== "object" || msg.id === undefined || msg.id === null) return null; // notification
  const reply = (result) => ({ jsonrpc: "2.0", id: msg.id, result });
  switch (msg.method) {
    case "initialize":
      return reply({
        protocolVersion: (msg.params && msg.params.protocolVersion) || "2025-06-18",
        capabilities: { tools: {} },
        serverInfo: SERVER_INFO,
      });
    case "ping":
      return reply({});
    case "tools/list":
      return reply({ tools: TOOLS });
    case "tools/call": {
      const name = msg.params && msg.params.name;
      const route = ROUTES[name];
      if (!route) return reply({ content: [{ type: "text", text: `Unknown tool: ${name}` }], isError: true });
      const args = { ...((msg.params && msg.params.arguments) || {}) };
      if (name === "task_status" && args.wait_seconds === undefined) args.wait_seconds = 30;
      try {
        const data = await callAdapter(config, route, args, fetchImpl);
        return reply({ content: [{ type: "text", text: JSON.stringify(data) }], isError: data.ok === false });
      } catch (err) {
        return reply({ content: [{ type: "text", text: `Hermes3D adapter unreachable: ${err.message}` }], isError: true });
      }
    }
    default:
      return { jsonrpc: "2.0", id: msg.id, error: { code: -32601, message: "Method not found" } };
  }
}

function main() {
  const config = loadConfig();
  if (!config.token) process.stderr.write("[hermes3d-mcp] HERMES3D_TEAM_TOKEN not found; tool calls will fail\n");
  const rl = readline.createInterface({ input: process.stdin });
  rl.on("line", async (line) => {
    if (!line.trim()) return;
    let msg;
    try {
      msg = JSON.parse(line);
    } catch {
      process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }) + "\n");
      return;
    }
    const out = await handleRpc(msg, { config });
    if (out) process.stdout.write(JSON.stringify(out) + "\n");
  });
  rl.on("close", () => process.exit(0));
}

if (require.main === module) main();

module.exports = { TOOLS, ROUTES, handleRpc, loadConfig, readEnvFile };
