"use strict";
/**
 * Hermes3D team assignment. Personas run inside the Hermes API, which ignores
 * client-sent tools, so they reach this module through the hermes3d MCP server
 * (server/hermes3d-team-mcp.js) -> adapter HTTP /team/* -> this manager.
 */
const crypto = require("crypto");

const MAX_DEPTH = 2;
const MAX_WAIT_MS = 60_000;
const MAX_BODY_BYTES = 64 * 1024;
const MAX_KEPT_RUNS = 200;
const TOKEN_HEADER = "x-hermes3d-team-token";

function buildTeamToolGuide(agentId) {
  return [
    "## Hermes3D team tools (authoritative, overrides older tool notes)",
    `Your Hermes3D agent_id is "${agentId}".`,
    "To give work to a Hermes3D team member use ONLY these MCP tools. If they are not listed directly, find them with tool_search \"hermes3d\" and call them through tool_call:",
    "- mcp__hermes3d__list_team: list team members (id, name, role, busy).",
    `- mcp__hermes3d__assign_task: assign one task. Always pass caller_agent_id="${agentId}", agent_id taken from list_team, and a self-contained task description.`,
    "- mcp__hermes3d__task_status: poll the returned run_id (wait_seconds up to 60) until status is done or needs_attention, then use the response.",
    "Rules:",
    "- Do not use the built-in delegate_task, subagent_spawn, or any anonymous subagent for work that belongs to a team member. Those run outside the team and are invisible in the office.",
    "- If the hermes3d tools are missing or return an error, stop and report the exact error. Do not do the team member's work yourself.",
  ].join("\n");
}

const str = (v) => (typeof v === "string" ? v.trim() : "");

function createTeamManager({
  getAgent, listAgents, runAgentTurn, broadcast, randomId,
  now = () => Date.now(), runTimeoutMs = 20 * 60_000,
  isTeamEnabled, getTeam,
}) {
  const runs = new Map(); // runId -> run record
  const busy = new Map(); // agentId -> runId currently occupying that agent
  const waiters = new Map(); // runId -> [wake fn]
  const iso = () => new Date(now()).toISOString();

  function isAgentTeamDisabled(agent) {
    if (!agent) return false;
    const teamId = typeof agent.teamId === "string" ? agent.teamId.trim() : "";
    if (!teamId) return false;
    if (typeof isTeamEnabled === "function") {
      return isTeamEnabled(teamId, agent) === false;
    }
    if (typeof getTeam === "function") {
      const team = getTeam(teamId);
      return Boolean(team && team.enabled === false);
    }
    return false;
  }

  // streamOneTurn has no timeout of its own; without this a hung run keeps the target busy forever.
  // The abort reaches runAgentTurn, which closes the Hermes stream so the Hermes session stops too.
  const withTimeout = (start) => new Promise((resolve, reject) => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      const err = new Error(`Run timed out after ${runTimeoutMs} ms`);
      controller.abort(err);
      reject(err);
    }, runTimeoutMs);
    if (timer.unref) timer.unref();
    Promise.resolve().then(() => start(controller.signal))
      .then((v) => { clearTimeout(timer); resolve(v); }, (e) => { clearTimeout(timer); reject(e); });
  });

  const listTeam = () =>
    listAgents().map((a) => ({ id: a.id, name: a.name, role: a.role || "", busy: busy.has(a.id) }));

  function markBusy(agentId, runId) {
    if (!busy.has(agentId)) busy.set(agentId, runId);
  }

  function clearBusy(agentId, runId) {
    if (busy.get(agentId) === runId) busy.delete(agentId);
  }

  function prune() {
    for (const [id, r] of runs) {
      if (runs.size <= MAX_KEPT_RUNS) return;
      if (r.status !== "working") runs.delete(id);
    }
  }

  function finish(rec, patch) {
    Object.assign(rec, patch, { updatedAt: iso() });
    clearBusy(rec.agentId, rec.runId);
    const at = now();
    broadcast({ type: "event", event: "presence", payload: { sessions: {
      recent: [{ key: rec.sessionKey, updatedAt: at }],
      byAgent: [{ agentId: rec.agentId, recent: [{ key: rec.sessionKey, updatedAt: at }] }],
    } } });
    const wake = waiters.get(rec.runId) || [];
    waiters.delete(rec.runId);
    wake.forEach((fn) => fn());
  }

  function assign(args = {}) {
    const caller = str(args.caller_agent_id);
    const target = str(args.agent_id);
    const task = str(args.task);
    const callerAgent = caller ? getAgent(caller) : null;
    if (!callerAgent) {
      return { ok: false, error: `Unknown caller_agent_id "${caller}". Use the agent_id stated in your system prompt.` };
    }
    if (isAgentTeamDisabled(callerAgent)) {
      return {
        ok: false,
        code: "caller_team_disabled",
        error: "caller_team_disabled",
        agent_id: caller,
        message: `Caller agent "${callerAgent.name || caller}" belongs to disabled team "${callerAgent.teamId}". Enable the team first.`,
      };
    }
    const targetAgent = target ? getAgent(target) : null;
    if (!targetAgent) return { ok: false, error: `Unknown agent_id "${target}". Call list_team first.` };
    if (isAgentTeamDisabled(targetAgent)) {
      return {
        ok: false,
        code: "team_disabled",
        error: "team_disabled",
        agent_id: target,
        message: `Target agent "${targetAgent.name || target}" belongs to disabled team "${targetAgent.teamId}". Enable the team first.`,
      };
    }
    if (target === caller) return { ok: false, error: "Cannot assign a task to yourself." };
    if (!task) return { ok: false, error: "task is required." };
    if (busy.has(target)) return { ok: false, error: "busy", agent_id: target, run_id: busy.get(target) };
    const parent = runs.get(busy.get(caller));
    const depth = (parent ? parent.depth : 0) + 1;
    if (depth > MAX_DEPTH) {
      return { ok: false, error: `Delegation depth limit (${MAX_DEPTH}) reached. Do this step yourself or report back.` };
    }

    const runId = randomId();
    const sessionKey = `agent:${target}:main`;
    const message = `[Task assigned by ${callerAgent.name || caller} (${caller})]\n${task}`;
    const createdAt = iso();
    const rec = {
      runId, taskId: `h3d-${runId}`, callerAgentId: caller, agentId: target, sessionKey,
      title: (str(args.title) || task).slice(0, 80), task, depth, status: "working",
      response: null, error: null, createdAt, updatedAt: createdAt,
    };
    runs.set(runId, rec);
    busy.set(target, runId);
    prune();

    const emit = (event, payload) =>
      broadcast({ type: "event", event, payload: { runId, sessionKey, ...payload } });
    emit("chat", { state: "delta", message: { role: "user", content: message } });
    emit("agent", { stream: "lifecycle", data: { phase: "start" } });

    withTimeout((signal) => runAgentTurn({
      agentId: target,
      message,
      signal,
      onDelta: (partial) => emit("chat", { state: "delta", message: { role: "assistant", content: partial } }),
    }))
      .then((text) => {
        const response = typeof text === "string" ? text : "";
        emit("chat", { state: "final", stopReason: "end_turn", message: { role: "assistant", content: response } });
        emit("agent", { stream: "lifecycle", data: { phase: "end" } });
        finish(rec, { status: "done", response });
      })
      .catch((err) => {
        const error = err && err.message ? err.message : String(err);
        emit("chat", { state: "error", errorMessage: error });
        emit("agent", { stream: "lifecycle", data: { phase: "error" } });
        finish(rec, { status: "needs_attention", error });
      });

    return { ok: true, run_id: runId, agent_id: target, agent_name: targetAgent.name, status: "working" };
  }

  async function status(args = {}) {
    const rec = runs.get(str(args.run_id));
    if (!rec) return { ok: false, error: `Unknown run_id "${str(args.run_id)}".` };
    const waitMs = Math.min(MAX_WAIT_MS, Math.max(0, Number(args.wait_seconds) || 0) * 1000);
    if (rec.status === "working" && waitMs > 0) {
      await new Promise((resolve) => {
        const timer = setTimeout(resolve, waitMs);
        const list = waiters.get(rec.runId) || [];
        list.push(() => { clearTimeout(timer); resolve(); });
        waiters.set(rec.runId, list);
      });
    }
    return {
      ok: true, run_id: rec.runId, agent_id: rec.agentId, status: rec.status,
      response: rec.response, error: rec.error, updated_at: rec.updatedAt,
    };
  }

  const listTasks = () =>
    [...runs.values()].map((r) => ({
      id: r.taskId, title: r.title, description: r.task, status: r.status, source: "hermes_event",
      assignedAgentId: r.agentId, createdAt: r.createdAt, updatedAt: r.updatedAt, runId: r.runId,
      lastActivityAt: r.updatedAt, notes: r.error ? [r.error] : [],
    }));

  return { listTeam, assign, status, listTasks, markBusy, clearBusy };
}

function sendJson(res, code, body) {
  res.writeHead(code, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

function tokenMatches(expected, given) {
  const a = Buffer.from(expected);
  const b = Buffer.from(typeof given === "string" ? given : "");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (c) => {
      size += c.length;
      if (size <= MAX_BODY_BYTES) chunks.push(c);
    });
    req.on("end", () => {
      if (size > MAX_BODY_BYTES) reject(Object.assign(new Error("body too large"), { status: 413 }));
      else resolve(Buffer.concat(chunks).toString("utf8"));
    });
    req.on("error", reject);
  });
}

/** Returns an async (req, res) => handled:boolean. Only claims paths under /team/. */
function createTeamHttpHandler({ token, manager }) {
  return async function handleTeamHttp(req, res) {
    const url = String(req.url || "").split("?")[0];
    if (!url.startsWith("/team/")) return false;
    if (!token) { sendJson(res, 503, { ok: false, error: "HERMES3D_TEAM_TOKEN is not configured" }); return true; }
    if (req.method !== "POST") { sendJson(res, 405, { ok: false, error: "POST only" }); return true; }
    if (req.headers.origin) { sendJson(res, 403, { ok: false, error: "browser origins are not allowed" }); return true; }
    const host = String(req.headers.host || "").replace(/:\d+$/, "");
    if (host !== "127.0.0.1" && host !== "localhost") { sendJson(res, 403, { ok: false, error: "bad host" }); return true; }
    if (!tokenMatches(token, req.headers[TOKEN_HEADER])) { sendJson(res, 401, { ok: false, error: "unauthorized" }); return true; }

    let body;
    try {
      const raw = await readBody(req);
      body = raw.trim() ? JSON.parse(raw) : {};
    } catch (err) {
      sendJson(res, err.status === 413 ? 413 : 400, { ok: false, error: err.status === 413 ? "body too large" : "invalid JSON" });
      return true;
    }
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      sendJson(res, 400, { ok: false, error: "JSON object body required" });
      return true;
    }

    if (url === "/team/list") { sendJson(res, 200, { ok: true, team: manager.listTeam() }); return true; }
    if (url === "/team/assign") {
      const r = manager.assign(body);
      sendJson(res, r.ok ? 200 : r.error === "busy" ? 409 : 400, r);
      return true;
    }
    if (url === "/team/status") {
      const r = await manager.status(body);
      sendJson(res, r.ok ? 200 : 404, r);
      return true;
    }
    sendJson(res, 404, { ok: false, error: "unknown team route" });
    return true;
  };
}

module.exports = { buildTeamToolGuide, createTeamManager, createTeamHttpHandler, MAX_DEPTH, MAX_WAIT_MS, TOKEN_HEADER };
