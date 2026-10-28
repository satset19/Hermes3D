import { afterEach, describe, expect, it, vi } from "vitest";
import { loadAgentPositions, saveAgentPositions, resolveInitialAgentPosition } from "@/features/retro-office/core/persistence";

describe("retro office agent position persistence", () => {
  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("round-trips finite positions by stable agent ID within its namespace", () => {
    saveAgentPositions("office-a", { maker: { x: 123, y: 456 } });
    expect(loadAgentPositions("office-a")).toEqual({ maker: { x: 123, y: 456 } });
    expect(loadAgentPositions("office-b")).toEqual({});
  });

  it("ignores malformed JSON and invalid IDs or coordinates", () => {
    localStorage.setItem("hermes3d_agent_positions:office-a", "not json");
    expect(loadAgentPositions("office-a")).toEqual({});

    localStorage.setItem("hermes3d_agent_positions:office-a", JSON.stringify({
      "": { x: 1, y: 2 },
      valid: { x: 1, y: Infinity },
      invalid: { x: "1", y: 2 },
      good: { x: 3, y: 4 },
    }));
    expect(loadAgentPositions("office-a")).toEqual({ good: { x: 3, y: 4 } });
  });

  it("restores manual placement only when no desk or active work takes precedence", () => {
    expect(resolveInitialAgentPosition("maker", "idle", false, { maker: { x: 10, y: 20 } }, { x: 90, y: 80 })).toEqual({ x: 10, y: 20 });
    expect(resolveInitialAgentPosition("maker", "working", false, { maker: { x: 10, y: 20 } }, { x: 90, y: 80 })).toEqual({ x: 90, y: 80 });
    expect(resolveInitialAgentPosition("maker", "idle", true, { maker: { x: 10, y: 20 } }, { x: 90, y: 80 })).toEqual({ x: 90, y: 80 });
  });

  it("merges saved IDs instead of deleting positions not in the current save", () => {
    saveAgentPositions("office-a", { maker: { x: 1, y: 2 }, herald: { x: 3, y: 4 } });
    saveAgentPositions("office-a", { maker: { x: 8, y: 9 } });
    expect(loadAgentPositions("office-a")).toEqual({
      maker: { x: 8, y: 9 },
      herald: { x: 3, y: 4 },
    });
  });
});
