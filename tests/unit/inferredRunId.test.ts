import { describe, expect, it } from "vitest";

import {
  isInferredRunId,
  LIVE_RUN_MAX_AGE_MS,
  shouldKeepLiveRun,
  toInferredRunId,
} from "@/features/agents/state/inferredRunId";

describe("inferred run ids", () => {
  it("builds and recognises placeholder run ids", () => {
    expect(toInferredRunId("designer")).toBe("inferred-designer");
    expect(isInferredRunId("inferred-designer")).toBe(true);
    expect(isInferredRunId(" run-1 ")).toBe(false);
    expect(isInferredRunId(null)).toBe(false);
  });

  it("keeps only recent real live runs when history says idle", () => {
    const now = 10 * 60 * 60_000;
    const live = { status: "running", runId: "run-1", runStartedAt: now - 60_000 };
    expect(shouldKeepLiveRun(live, now)).toBe(true);
    expect(shouldKeepLiveRun({ ...live, runId: "inferred-designer" }, now)).toBe(false);
    expect(shouldKeepLiveRun({ ...live, runId: null }, now)).toBe(false);
    expect(shouldKeepLiveRun({ ...live, status: "idle" }, now)).toBe(false);
    expect(shouldKeepLiveRun({ ...live, runStartedAt: null }, now)).toBe(false);
    expect(shouldKeepLiveRun({ ...live, runStartedAt: now - LIVE_RUN_MAX_AGE_MS }, now)).toBe(false);
  });
});
