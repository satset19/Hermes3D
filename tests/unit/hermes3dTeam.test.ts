// @vitest-environment node
import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it, vi } from "vitest";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const team: any = await import("../../server/hermes3d-team.js");
const { createTeamManager, createTeamHttpHandler, buildTeamToolGuide } = team;

const AGENTS = [
  { id: "hermes", name: "Xouuus", role: "Orchestrator" },
  { id: "captain-9860a1", name: "Captain", role: "Project Manager" },
  { id: "designer-1c1143", name: "Designer", role: "UI/UX Lead" },
  { id: "architect-8dc35f", name: "Architect", role: "Systems Architect" },
];

type Deferred = { promise: Promise<string>; resolve: (v: string) => void; reject: (e: Error) => void };
const deferred = (): Deferred => {
  let resolve!: (v: string) => void;
  let reject!: (e: Error) => void;
  const promise = new Promise<string>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const makeManager = (runAgentTurn: any = vi.fn(async () => "ok"), extra: Record<string, unknown> = {}) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const frames: any[] = [];
  let n = 0;
  const manager = createTeamManager({
    getAgent: (id: string) => AGENTS.find((a) => a.id === id) || null,
    listAgents: () => AGENTS,
    runAgentTurn,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    broadcast: (f: any) => frames.push(f),
    randomId: () => `run${++n}`,
    now: () => Date.UTC(2026, 9, 27),
    ...extra,
  });
  return { manager, frames, runAgentTurn };
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tag = (f: any) => `${f.event}:${f.payload.state || f.payload.data?.phase || "presence"}`;

describe("hermes3d team manager", () => {
  it("lists the team with busy flags", () => {
    const { manager } = makeManager();
    expect(manager.listTeam()).toEqual(AGENTS.map((a) => ({ ...a, busy: false })));
  });

  it("rejects invalid assignments", () => {
    const { manager } = makeManager();
    const base = { caller_agent_id: "captain-9860a1", agent_id: "designer-1c1143", task: "x" };
    expect(manager.assign({ ...base, caller_agent_id: "nope" }).ok).toBe(false);
    expect(manager.assign({ ...base, agent_id: "nope" }).error).toMatch(/list_team/);
    expect(manager.assign({ ...base, agent_id: "captain-9860a1" }).error).toMatch(/yourself/);
    expect(manager.assign({ ...base, task: "  " }).error).toMatch(/task is required/);
  });

  it("emits office frames in order and records the response", async () => {
    const run = vi.fn(async ({ onDelta }: { onDelta: (s: string) => void }) => {
      onDelta("PO");
      onDelta("PONG");
      return "PONG";
    });
    const { manager, frames } = makeManager(run);
    const res = manager.assign({ caller_agent_id: "captain-9860a1", agent_id: "designer-1c1143", task: "Say PONG" });
    expect(res).toMatchObject({ ok: true, run_id: "run1", agent_id: "designer-1c1143", status: "working" });
    const st = await manager.status({ run_id: "run1", wait_seconds: 1 });
    expect(st).toMatchObject({ ok: true, status: "done", response: "PONG" });
    expect(frames.map(tag)).toEqual([
      "chat:delta", "agent:start", "chat:delta", "chat:delta", "chat:final", "agent:end", "presence:presence",
    ]);
    expect(frames[0].payload.message.role).toBe("user");
    expect(frames[0].payload.message.content).toContain("Captain (captain-9860a1)");
    for (const f of frames.slice(0, 6)) {
      expect(f.payload).toMatchObject({ runId: "run1", sessionKey: "agent:designer-1c1143:main" });
    }
    expect(run.mock.calls[0][0]).toMatchObject({ agentId: "designer-1c1143" });
  });

  it("marks failures as needs_attention", async () => {
    const { manager, frames } = makeManager(vi.fn(async () => { throw new Error("boom"); }));
    manager.assign({ caller_agent_id: "hermes", agent_id: "architect-8dc35f", task: "t" });
    const st = await manager.status({ run_id: "run1", wait_seconds: 1 });
    expect(st).toMatchObject({ status: "needs_attention", error: "boom" });
    expect(frames.map(tag)).toContain("agent:error");
    expect(frames.map(tag)).toContain("chat:error");
  });

  it("times out a hung run and frees the agent", async () => {
    const { manager } = makeManager(vi.fn(() => new Promise(() => {})), { runTimeoutMs: 20 });
    manager.assign({ caller_agent_id: "hermes", agent_id: "designer-1c1143", task: "t" });
    const st = await manager.status({ run_id: "run1", wait_seconds: 1 });
    expect(st.status).toBe("needs_attention");
    expect(st.error).toMatch(/timed out/);
    expect(manager.listTeam().find((a: { id: string }) => a.id === "designer-1c1143").busy).toBe(false);
  });

  it("aborts the run's signal when it times out", async () => {
    let signal: AbortSignal | undefined;
    const run = vi.fn((args: { signal: AbortSignal }) => {
      signal = args.signal;
      return new Promise(() => {});
    });
    const { manager } = makeManager(run, { runTimeoutMs: 20 });
    manager.assign({ caller_agent_id: "hermes", agent_id: "designer-1c1143", task: "t" });
    await manager.status({ run_id: "run1", wait_seconds: 1 });
    expect(signal?.aborted).toBe(true);
    expect(String(signal?.reason?.message)).toMatch(/timed out/);
  });

  it("refuses a busy target, then accepts once it is free", async () => {
    const d = deferred();
    const { manager } = makeManager(vi.fn(() => d.promise));
    manager.assign({ caller_agent_id: "hermes", agent_id: "designer-1c1143", task: "a" });
    expect(manager.assign({ caller_agent_id: "captain-9860a1", agent_id: "designer-1c1143", task: "b" }))
      .toMatchObject({ ok: false, error: "busy", run_id: "run1" });
    d.resolve("done");
    await manager.status({ run_id: "run1", wait_seconds: 1 });
    expect(manager.assign({ caller_agent_id: "captain-9860a1", agent_id: "designer-1c1143", task: "b" }).ok).toBe(true);
  });

  it("treats chat.send runs as busy (blocks cycles back to the caller)", () => {
    const { manager } = makeManager();
    manager.markBusy("captain-9860a1", "chat-run");
    expect(manager.assign({ caller_agent_id: "designer-1c1143", agent_id: "captain-9860a1", task: "x" }).error).toBe("busy");
    manager.clearBusy("captain-9860a1", "chat-run");
    expect(manager.listTeam().find((a: { id: string }) => a.id === "captain-9860a1").busy).toBe(false);
  });

  it("caps delegation depth at 2", () => {
    const { manager } = makeManager(vi.fn(() => new Promise(() => {})));
    expect(manager.assign({ caller_agent_id: "hermes", agent_id: "captain-9860a1", task: "1" }).ok).toBe(true);
    expect(manager.assign({ caller_agent_id: "captain-9860a1", agent_id: "designer-1c1143", task: "2" }).ok).toBe(true);
    expect(manager.assign({ caller_agent_id: "designer-1c1143", agent_id: "architect-8dc35f", task: "3" }).error)
      .toMatch(/depth limit/);
  });

  it("exposes runs as gateway task records", () => {
    const { manager } = makeManager(vi.fn(() => new Promise(() => {})));
    manager.assign({ caller_agent_id: "hermes", agent_id: "designer-1c1143", task: "Review the UI", title: "UI review" });
    expect(manager.listTasks()).toEqual([expect.objectContaining({
      id: "h3d-run1", title: "UI review", description: "Review the UI", status: "working",
      assignedAgentId: "designer-1c1143", runId: "run1", source: "hermes_event",
    })]);
  });

  it("reports unknown run ids", async () => {
    const { manager } = makeManager();
    expect(await manager.status({ run_id: "missing" })).toMatchObject({ ok: false });
  });

  it("builds a tool guide bound to the agent id", () => {
    const guide = buildTeamToolGuide("captain-9860a1");
    expect(guide).toContain('caller_agent_id="captain-9860a1"');
    expect(guide).toContain("mcp__hermes3d__assign_task");
    expect(guide).toContain("stop and report");
  });
});

describe("hermes3d team http handler", () => {
  let server: http.Server | null = null;
  afterEach(() => new Promise<void>((r) => (server ? server.close(() => r()) : r())));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const start = async (token: string, manager: any) => {
    const handler = createTeamHttpHandler({ token, manager });
    server = http.createServer(async (req, res) => {
      if (await handler(req, res)) return;
      res.writeHead(200);
      res.end("fallback");
    });
    await new Promise<void>((r) => server!.listen(0, "127.0.0.1", () => r()));
    return (server!.address() as AddressInfo).port;
  };

  const call = (port: number, path: string, opts: { method?: string; headers?: Record<string, string>; body?: string } = {}) =>
    new Promise<{ status: number; body: string }>((resolve, reject) => {
      const req = http.request({ host: "127.0.0.1", port, path, method: opts.method || "POST",
        headers: { "Content-Type": "application/json", ...(opts.headers || {}) } }, (res) => {
        let body = "";
        res.on("data", (c) => (body += c));
        res.on("end", () => resolve({ status: res.statusCode || 0, body }));
      });
      req.on("error", reject);
      // GET bodies are unframed in Node; on a keep-alive socket they corrupt the next request.
      req.end(opts.method === "GET" ? undefined : (opts.body ?? "{}"));
    });

  const auth = { "X-Hermes3D-Team-Token": "secret" };

  it("enforces token, method, origin, and passes through other paths", async () => {
    const port = await start("secret", makeManager().manager);
    expect((await call(port, "/team/list")).status).toBe(401);
    expect((await call(port, "/team/list", { headers: { "X-Hermes3D-Team-Token": "wrong" } })).status).toBe(401);
    expect((await call(port, "/team/list", { method: "GET", headers: auth })).status).toBe(405);
    expect((await call(port, "/team/list", { headers: { ...auth, Origin: "https://evil.example" } })).status).toBe(403);
    expect((await call(port, "/team/list", { headers: auth, body: "{not json" })).status).toBe(400);
    expect((await call(port, "/", { method: "GET" })).body).toBe("fallback");
    const ok = await call(port, "/team/list", { headers: auth });
    expect(ok.status).toBe(200);
    expect(JSON.parse(ok.body).team).toHaveLength(4);
  });

  it("fails closed without a configured token", async () => {
    const port = await start("", makeManager().manager);
    expect((await call(port, "/team/list", { headers: auth })).status).toBe(503);
  });

  it("assigns, reports busy as 409, and returns status", async () => {
    const port = await start("secret", makeManager(vi.fn(() => new Promise(() => {}))).manager);
    const body = JSON.stringify({ caller_agent_id: "hermes", agent_id: "designer-1c1143", task: "t" });
    const first = await call(port, "/team/assign", { headers: auth, body });
    expect(first.status).toBe(200);
    expect((await call(port, "/team/assign", { headers: auth, body })).status).toBe(409);
    const st = await call(port, "/team/status", { headers: auth, body: JSON.stringify({ run_id: "run1" }) });
    expect(JSON.parse(st.body)).toMatchObject({ ok: true, status: "working" });
  });
});
