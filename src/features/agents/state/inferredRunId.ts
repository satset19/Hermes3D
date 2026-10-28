// OfficeScreen marks an agent it only guessed is busy (from chat history) with a
// placeholder runId. Real runs must be allowed to replace it.
export const INFERRED_RUN_ID_PREFIX = "inferred-";

export const toInferredRunId = (agentId: string): string => `${INFERRED_RUN_ID_PREFIX}${agentId}`;

export const isInferredRunId = (runId: string | null | undefined): boolean =>
  (runId?.trim() ?? "").startsWith(INFERRED_RUN_ID_PREFIX);

// loadAgents() re-infers status from chat history, which can lag a live run (the run's
// frames are the source of truth). Keep a real run until its own final/error frame, but
// not past LIVE_RUN_MAX_AGE_MS, so a run whose terminal frame was lost (adapter restart)
// cannot pin the agent at "working" forever. 25 min = team run timeout (20 min) + margin.
export const LIVE_RUN_MAX_AGE_MS = 25 * 60_000;

export const shouldKeepLiveRun = (
  agent: { status: string; runId: string | null; runStartedAt: number | null },
  nowMs: number
): boolean =>
  agent.status === "running" &&
  Boolean(agent.runId?.trim()) &&
  !isInferredRunId(agent.runId) &&
  typeof agent.runStartedAt === "number" &&
  nowMs - agent.runStartedAt < LIVE_RUN_MAX_AGE_MS;
