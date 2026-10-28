// @vitest-environment node
import http from "node:http";
import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const adapter: any = await import("../../server/hermes-gateway-adapter.js");
const {
  execDelegateTask,
  executeToolCall,
  agentRegistry,
  teamRegistry,
} = adapter;

describe("hermes gateway adapter legacy execDelegateTask team guards", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("exports execDelegateTask and executeToolCall", () => {
    expect(typeof execDelegateTask).toBe("function");
    expect(typeof executeToolCall).toBe("function");
  });

  it("validates required parameters before checking teams", async () => {
    const rawNoArgs = await execDelegateTask({});
    const resNoArgs = JSON.parse(rawNoArgs);
    expect(resNoArgs.ok).toBe(false);
    expect(resNoArgs.error).toMatch(/agent_id and message required/);

    const rawNotFound = await execDelegateTask({
      agent_id: "non-existent-agent",
      message: "hello",
    });
    const resNotFound = JSON.parse(rawNotFound);
    expect(resNotFound.ok).toBe(false);
    expect(resNotFound.error).toMatch(/Agent non-existent-agent not found/);
  });

  it("rejects delegation when target agent belongs to a disabled team", async () => {
    teamRegistry.set("team-qa-disabled", {
      id: "team-qa-disabled",
      name: "QA Team",
      enabled: false,
    });

    agentRegistry.set("agent-qa-1", {
      id: "agent-qa-1",
      name: "Tester Agent",
      role: "QA",
      teamId: "team-qa-disabled",
      settings: {},
    });

    const raw = await execDelegateTask({
      agent_id: "agent-qa-1",
      message: "Run test suite",
    });

    const res = JSON.parse(raw);
    expect(res.ok).toBe(false);
    expect(res.code).toBe("team_disabled");
    expect(res.error).toBe("team_disabled");
    expect(res.message).toMatch(/QA Team/);
  });

  it("rejects delegation when caller agent belongs to a disabled team (via callerAgentId argument)", async () => {
    teamRegistry.set("team-ops-disabled", {
      id: "team-ops-disabled",
      name: "Ops Team",
      enabled: false,
    });
    teamRegistry.set("team-dev-enabled", {
      id: "team-dev-enabled",
      name: "Dev Team",
      enabled: true,
    });

    agentRegistry.set("caller-ops-1", {
      id: "caller-ops-1",
      name: "Ops Agent",
      role: "Ops",
      teamId: "team-ops-disabled",
      settings: {},
    });

    agentRegistry.set("target-dev-1", {
      id: "target-dev-1",
      name: "Dev Agent",
      role: "Dev",
      teamId: "team-dev-enabled",
      settings: {},
    });

    const raw = await execDelegateTask(
      { agent_id: "target-dev-1", message: "Deploy fix" },
      undefined,
      "caller-ops-1"
    );

    const res = JSON.parse(raw);
    expect(res.ok).toBe(false);
    expect(res.code).toBe("caller_team_disabled");
    expect(res.error).toBe("caller_team_disabled");
    expect(res.message).toMatch(/Ops Team/);
  });

  it("rejects delegation when caller agent belongs to a disabled team (via args.caller_agent_id)", async () => {
    teamRegistry.set("team-ops-disabled-2", {
      id: "team-ops-disabled-2",
      name: "Ops Team 2",
      enabled: false,
    });
    teamRegistry.set("team-dev-enabled-2", {
      id: "team-dev-enabled-2",
      name: "Dev Team 2",
      enabled: true,
    });

    agentRegistry.set("caller-ops-2", {
      id: "caller-ops-2",
      name: "Ops Agent 2",
      role: "Ops",
      teamId: "team-ops-disabled-2",
      settings: {},
    });

    agentRegistry.set("target-dev-2", {
      id: "target-dev-2",
      name: "Dev Agent 2",
      role: "Dev",
      teamId: "team-dev-enabled-2",
      settings: {},
    });

    const raw = await execDelegateTask({
      agent_id: "target-dev-2",
      message: "Deploy fix",
      caller_agent_id: "caller-ops-2",
    });

    const res = JSON.parse(raw);
    expect(res.ok).toBe(false);
    expect(res.code).toBe("caller_team_disabled");
    expect(res.error).toBe("caller_team_disabled");
    expect(res.message).toMatch(/Ops Team 2/);
  });

  it("does not block delegation when target has no teamId or references missing team", async () => {
    // Mock http.request to quickly fail network request and verify bypass did not trigger team_disabled
    const fakeReq = new EventEmitter() as any;
    fakeReq.write = vi.fn();
    fakeReq.end = vi.fn(() => {
      fakeReq.emit("error", new Error("mocked connection refused"));
    });
    fakeReq.destroy = vi.fn();

    const requestSpy = vi.spyOn(http, "request").mockImplementation((..._args: any[]) => {
      setTimeout(() => {
        fakeReq.emit("error", new Error("mocked connection refused"));
      }, 0);
      return fakeReq;
    });

    agentRegistry.set("agent-no-team", {
      id: "agent-no-team",
      name: "Solo Agent",
      role: "Freelancer",
      settings: {},
    });

    agentRegistry.set("agent-missing-team", {
      id: "agent-missing-team",
      name: "Agent With Missing Team",
      role: "Freelancer",
      teamId: "team-non-existent",
      settings: {},
    });

    const p1 = execDelegateTask({
      agent_id: "agent-no-team",
      message: "Do task",
    });
    await vi.runAllTimersAsync();
    const rawNoTeam = await p1;
    const resNoTeam = JSON.parse(rawNoTeam);
    expect(resNoTeam.code).not.toBe("team_disabled");
    expect(resNoTeam.error).not.toBe("team_disabled");
    expect(requestSpy).toHaveBeenCalled();

    requestSpy.mockClear();

    const p2 = execDelegateTask({
      agent_id: "agent-missing-team",
      message: "Do task",
    });
    await vi.runAllTimersAsync();
    const rawMissingTeam = await p2;
    const resMissingTeam = JSON.parse(rawMissingTeam);
    expect(resMissingTeam.code).not.toBe("team_disabled");
    expect(resMissingTeam.error).not.toBe("team_disabled");
    expect(requestSpy).toHaveBeenCalled();

    requestSpy.mockRestore();
  });

  it("rejects delegation via executeToolCall when target is in disabled team", async () => {
    teamRegistry.set("team-finance-disabled", {
      id: "team-finance-disabled",
      name: "Finance Team",
      enabled: false,
    });

    agentRegistry.set("agent-fin-1", {
      id: "agent-fin-1",
      name: "Finance Bot",
      role: "Finance",
      teamId: "team-finance-disabled",
      settings: {},
    });

    const raw = await executeToolCall(
      {
        name: "delegate_task",
        args: { agent_id: "agent-fin-1", message: "Review invoice" },
      },
      "hermes",
      vi.fn()
    );

    const res = JSON.parse(raw);
    expect(res.ok).toBe(false);
    expect(res.code).toBe("team_disabled");
    expect(res.error).toBe("team_disabled");
  });

  it("rejects delegation via executeToolCall when caller is in disabled team", async () => {
    teamRegistry.set("team-caller-disabled", {
      id: "team-caller-disabled",
      name: "Disabled Caller Team",
      enabled: false,
    });

    agentRegistry.set("agent-caller-dis", {
      id: "agent-caller-dis",
      name: "Disabled Caller Agent",
      role: "Caller",
      teamId: "team-caller-disabled",
      settings: {},
    });

    agentRegistry.set("agent-target-ok", {
      id: "agent-target-ok",
      name: "Target OK",
      role: "Worker",
      settings: {},
    });

    const raw = await executeToolCall(
      {
        name: "delegate_task",
        args: { agent_id: "agent-target-ok", message: "Process data" },
      },
      "agent-caller-dis",
      vi.fn()
    );

    const res = JSON.parse(raw);
    expect(res.ok).toBe(false);
    expect(res.code).toBe("caller_team_disabled");
    expect(res.error).toBe("caller_team_disabled");
  });
});
