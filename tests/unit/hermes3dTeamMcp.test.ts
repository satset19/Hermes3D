// @vitest-environment node
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import type { AddressInfo } from "node:net";
import { describe, expect, it, vi } from "vitest";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mcp: any = await import("../../server/hermes3d-team-mcp.js");
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const team: any = await import("../../server/hermes3d-team.js");
const { handleRpc, loadConfig } = mcp;
const config = { baseUrl: "http://adapter.test", token: "secret" };
const jsonResponse = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe("hermes3d MCP server", () => {
  it("echoes the client protocol version on initialize", async () => {
    const res = await handleRpc({ jsonrpc: "2.0", id: 1, method: "initialize",
      params: { protocolVersion: "2025-11-25" } }, { config });
    expect(res.result).toMatchObject({ protocolVersion: "2025-11-25", capabilities: { tools: {} },
      serverInfo: { name: "hermes3d-team" } });
  });

  it("ignores notifications and rejects unknown methods", async () => {
    expect(await handleRpc({ jsonrpc: "2.0", method: "notifications/initialized" }, { config })).toBeNull();
    expect((await handleRpc({ jsonrpc: "2.0", id: 2, method: "resources/list" }, { config })).error.code).toBe(-32601);
  });

  it("lists three tools with object input schemas", async () => {
    const res = await handleRpc({ jsonrpc: "2.0", id: 3, method: "tools/list" }, { config });
    expect(res.result.tools.map((t: { name: string }) => t.name)).toEqual(["list_team", "assign_task", "task_status"]);
    for (const t of res.result.tools) expect(t.inputSchema.type).toBe("object");
  });

  it("forwards tool calls to the adapter with the token", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ ok: true, run_id: "r1" }));
    const res = await handleRpc({ jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "assign_task",
      arguments: { caller_agent_id: "hermes", agent_id: "fe-specialist-1c1143", task: "t" } } }, { config, fetchImpl });
    expect(fetchImpl).toHaveBeenCalledWith("http://adapter.test/team/assign", expect.objectContaining({
      method: "POST", headers: expect.objectContaining({ "X-Hermes3D-Team-Token": "secret" }) }));
    expect(res.result.isError).toBe(false);
    expect(JSON.parse(res.result.content[0].text)).toEqual({ ok: true, run_id: "r1" });
  });

  it("defaults task_status wait_seconds to 30", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ ok: true, status: "working" }));
    await handleRpc({ jsonrpc: "2.0", id: 5, method: "tools/call",
      params: { name: "task_status", arguments: { run_id: "r1" } } }, { config, fetchImpl });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const init = (fetchImpl.mock.calls[0] as any[])[1];
    expect(JSON.parse(init.body)).toEqual({ run_id: "r1", wait_seconds: 30 });
  });

  it("flags adapter errors and an unreachable adapter as isError", async () => {
    const busy = vi.fn(async () => jsonResponse({ ok: false, error: "busy" }, 409));
    const r1 = await handleRpc({ jsonrpc: "2.0", id: 6, method: "tools/call",
      params: { name: "list_team", arguments: {} } }, { config, fetchImpl: busy });
    expect(r1.result.isError).toBe(true);
    const down = vi.fn(async () => { throw new Error("ECONNREFUSED"); });
    const r2 = await handleRpc({ jsonrpc: "2.0", id: 7, method: "tools/call",
      params: { name: "list_team", arguments: {} } }, { config, fetchImpl: down });
    expect(r2.result).toMatchObject({ isError: true });
    expect(r2.result.content[0].text).toContain("unreachable");
  });

  it("reads the token and port from the env file", () => {
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "h3d-")), ".env.hermes");
    fs.writeFileSync(file, "HERMES_ADAPTER_PORT=18790\nHERMES3D_TEAM_TOKEN=\"abc\"\n");
    expect(loadConfig({ HERMES3D_ENV_FILE: file })).toEqual({ baseUrl: "http://127.0.0.1:18790", token: "abc" });
  });

  it("speaks newline-delimited JSON-RPC over stdio against a real /team handler", async () => {
    const manager = team.createTeamManager({
      getAgent: (id: string) => (id === "hermes" ? { id, name: "Xouuus", role: "Orchestrator" } : null),
      listAgents: () => [{ id: "hermes", name: "Xouuus", role: "Orchestrator" }],
      runAgentTurn: async () => "ok", broadcast: () => {}, randomId: () => "r",
    });
    const handler = team.createTeamHttpHandler({ token: "tok", manager });
    const server = http.createServer(async (req, res) => { if (!(await handler(req, res))) res.end("x"); });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
    const port = (server.address() as AddressInfo).port;

    const child = spawn(process.execPath, [path.resolve("server/hermes3d-team-mcp.js")], {
      env: { ...process.env, PATH: process.env.PATH, HERMES3D_ADAPTER_URL: `http://127.0.0.1:${port}`,
        HERMES3D_TEAM_TOKEN: "tok", HERMES3D_ENV_FILE: "/nonexistent" },
    }) as unknown as ChildProcessWithoutNullStreams;
    const lines: string[] = [];
    let buf = "";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const reply = await new Promise<any>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`timeout: ${lines.join("|\n")}`)), 10_000);
      child.stdout.on("data", (c) => {
        buf += c.toString();
        const parts = buf.split("\n");
        buf = parts.pop() || "";
        for (const l of parts) {
          lines.push(l);
          const msg = JSON.parse(l);
          if (msg.id === 2) { clearTimeout(timer); resolve(msg); }
        }
      });
      const send = (m: unknown) => child.stdin.write(JSON.stringify(m) + "\n");
      send({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-11-25" } });
      send({ jsonrpc: "2.0", method: "notifications/initialized" });
      send({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "list_team", arguments: {} } });
    });
    child.kill();
    await new Promise<void>((r) => server.close(() => r()));
    expect(JSON.parse(lines[0]).result.protocolVersion).toBe("2025-11-25");
    expect(reply.result.isError).toBe(false);
    expect(JSON.parse(reply.result.content[0].text).team).toEqual([
      { id: "hermes", name: "Xouuus", role: "Orchestrator", busy: false },
    ]);
  });
});
