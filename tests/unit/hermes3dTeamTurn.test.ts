// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const turn: any = await import("../../server/hermes3d-team-turn.js");
const { createRunAgentTurn, closeDanglingTurns, DANGLING_NOTE } = turn;

type Msg = { role: string; content: string; createdAt?: number; timestamp?: number };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const setup = (streamOneTurn: any, settings: Record<string, unknown> = {}) => {
  const store = new Map<string, Msg[]>();
  const getHistory = (key: string) => {
    if (!store.has(key)) store.set(key, []);
    return store.get(key)!;
  };
  const saveHistory = vi.fn();
  const run = createRunAgentTurn({
    getAgent: (id: string) => (id === "designer" ? { id, settings } : null),
    getHistory,
    saveHistory,
    resolveModel: () => "hermes-agent",
    buildSystemMessages: () => [{ role: "system", content: "sys" }],
    streamOneTurn,
    mainKey: "main",
  });
  return { run, getHistory, saveHistory };
};

describe("hermes3d team turn history", () => {
  it("stores the task before the model answers, so chat.history shows it mid-run", async () => {
    let seenDuringRun: string[] = [];
    const { run, getHistory } = setup(
      vi.fn(async (messages: Msg[], _model: string, _tools: unknown[], onDelta: (t: string) => void) => {
        seenDuringRun = getHistory("agent:designer:main").map((m) => m.role);
        expect(messages.filter((m) => m.role === "user")).toHaveLength(1);
        onDelta("Hi");
        return { textContent: "Hi there" };
      })
    );
    await expect(run({ agentId: "designer", message: "Draw a logo" })).resolves.toBe("Hi there");
    expect(seenDuringRun).toEqual(["user"]);
    expect(getHistory("agent:designer:main")).toEqual([
      expect.objectContaining({ role: "user", content: "Draw a logo" }),
      expect.objectContaining({ role: "assistant", content: "Hi there" }),
    ]);
    const msgs = getHistory("agent:designer:main");
    expect(typeof msgs[0].createdAt).toBe("number");
    expect(typeof msgs[0].timestamp).toBe("number");
    expect(typeof msgs[1].createdAt).toBe("number");
    expect(typeof msgs[1].timestamp).toBe("number");
  });

  it("keeps the partial answer and the stop reason when the run fails", async () => {
    const { run, getHistory, saveHistory } = setup(
      vi.fn(async (_m: Msg[], _mo: string, _t: unknown[], onDelta: (t: string) => void) => {
        onDelta("Half done");
        throw new Error("Hermes API HTTP 500");
      })
    );
    await expect(run({ agentId: "designer", message: "t" })).rejects.toThrow("HTTP 500");
    expect(getHistory("agent:designer:main")[1]).toEqual(
      expect.objectContaining({
        role: "assistant",
        content: "Half done\n\n[Run stopped: Hermes API HTTP 500]",
      })
    );
    expect(saveHistory).toHaveBeenCalledTimes(2);
  });

  it("passes the abort signal down and records the timeout", async () => {
    const controller = new AbortController();
    const stream = vi.fn(async (_m: Msg[], _mo: string, _t: unknown[], onDelta: (t: string) => void) => {
      onDelta("partial");
      controller.abort(new Error("Run timed out after 5 ms"));
      return { textContent: "partial" };
    });
    const { run, getHistory } = setup(stream);
    await expect(run({ agentId: "designer", message: "t", signal: controller.signal })).rejects.toThrow(/timed out/);
    expect((stream.mock.calls[0] as unknown[])[5]).toBe(controller.signal);
    expect(getHistory("agent:designer:main").map((m) => m.content)).toEqual([
      "t",
      "partial\n\n[Run stopped: Run timed out after 5 ms]",
    ]);
  });

  it("writes nothing when continuity is off", async () => {
    const { run, getHistory } = setup(vi.fn(async () => ({ textContent: "ok" })), { continuity: false });
    await run({ agentId: "designer", message: "t" });
    expect(getHistory("agent:designer:main")).toEqual([]);
  });

  it("rejects unknown agents", async () => {
    const { run } = setup(vi.fn());
    await expect(run({ agentId: "ghost", message: "t" })).rejects.toThrow(/not found/);
  });

  it("closes turns left open by an adapter restart", () => {
    const history = new Map<string, Msg[]>([
      ["agent:a:main", [{ role: "user", content: "q" }]],
      ["agent:b:main", [{ role: "user", content: "q" }, { role: "assistant", content: "a" }]],
      ["agent:c:main", []],
    ]);
    expect(closeDanglingTurns(history)).toBe(1);
    expect(history.get("agent:a:main")!.at(-1)).toEqual(
      expect.objectContaining({ role: "assistant", content: DANGLING_NOTE })
    );
    expect(history.get("agent:b:main")).toHaveLength(2);
  });
});
