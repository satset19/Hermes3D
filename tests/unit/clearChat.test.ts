import { describe, expect, it } from "vitest";

import {
  agentStoreReducer,
  buildClearChatAgentPatch,
  type AgentState,
  type AgentStoreState,
} from "@/features/agents/state/store";

const createTestAgent = (overrides: Partial<AgentState> = {}): AgentState => ({
  agentId: "agent-1",
  name: "Agent One",
  sessionKey: "agent:agent-1:main",
  avatarSeed: "agent-1",
  avatarUrl: null,
  model: null,
  thinkingLevel: "high",
  sessionExecHost: undefined,
  sessionExecSecurity: undefined,
  sessionExecAsk: undefined,
  status: "idle",
  sessionCreated: true,
  awaitingUserInput: false,
  hasUnseenActivity: false,
  outputLines: ["User: Hello", "Assistant: Hi there!"],
  transcriptEntries: [
    {
      entryId: "entry-0",
      role: "user",
      kind: "user",
      text: "Hello",
      confirmed: true,
      sequenceKey: 0,
      timestampMs: 1000,
      sessionKey: "agent:agent-1:main",
      source: "legacy",
      runId: null,
      fingerprint: "fp-0",
    },
    {
      entryId: "entry-1",
      role: "assistant",
      kind: "assistant",
      text: "Hi there!",
      confirmed: true,
      sequenceKey: 1,
      timestampMs: 1001,
      sessionKey: "agent:agent-1:main",
      source: "legacy",
      runId: null,
      fingerprint: "fp-1",
    },
  ],
  transcriptRevision: 2,
  transcriptSequenceCounter: 2,
  lastResult: null,
  lastDiff: null,
  runId: null,
  runStartedAt: null,
  streamText: "streaming...",
  thinkingTrace: "thinking...",
  latestOverride: null,
  latestOverrideKind: null,
  lastAssistantMessageAt: 1001,
  lastActivityAt: 1001,
  latestPreview: null,
  lastUserMessage: "Hello",
  draft: "",
  queuedMessages: [],
  sessionSettingsSynced: true,
  historyLoadedAt: 1000,
  historyFetchLimit: 10,
  historyFetchedCount: 2,
  historyMaybeTruncated: false,
  toolCallingEnabled: false,
  showThinkingTraces: true,
  sessionEpoch: 1,
  lastHistoryRequestRevision: null,
  lastAppliedHistoryRequestId: null,
  ...overrides,
});

describe("clearChat action and patch", () => {
  it("buildClearChatAgentPatch clears chat history and traces", () => {
    const agent = createTestAgent();
    const patch = buildClearChatAgentPatch(agent);

    expect(patch.outputLines).toEqual([]);
    expect(patch.transcriptEntries).toEqual([]);
    expect(patch.streamText).toBeNull();
    expect(patch.thinkingTrace).toBeNull();
    expect(patch.transcriptRevision).toBe(3);
    expect(patch.transcriptSequenceCounter).toBe(0);
    expect(patch.lastAssistantMessageAt).toBeNull();
    expect(patch.lastUserMessage).toBeNull();
  });

  it("agentStoreReducer clears chat state on clearChat action", () => {
    const agent = createTestAgent();
    const state: AgentStoreState = {
      agents: [agent],
      selectedAgentId: "agent-1",
      loading: false,
      error: null,
    };

    const nextState = agentStoreReducer(state, {
      type: "clearChat",
      agentId: "agent-1",
    });

    const updated = nextState.agents.find((a) => a.agentId === "agent-1");
    expect(updated).toBeDefined();
    expect(updated?.outputLines).toEqual([]);
    expect(updated?.transcriptEntries).toEqual([]);
    expect(updated?.streamText).toBeNull();
    expect(updated?.thinkingTrace).toBeNull();
    expect(updated?.transcriptRevision).toBe(3);
    expect(updated?.transcriptSequenceCounter).toBe(0);
  });
});
