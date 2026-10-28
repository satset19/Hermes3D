/**
 * Tests for skillGymHold handling in reconcileOfficeAnimationTriggerState.
 *
 * Gym directives are retired with the removal of the gym room.
 * Key behaviour:
 * - New messages or transcripts do not trigger new skillGymHold entries.
 * - Existing holds in state persist across reconcile ticks for backward compatibility.
 * - Agents without prior holds do not receive hold entries.
 */
import { describe, expect, it } from "vitest";

import type { AgentState, AgentStoreSeed } from "@/features/agents/state/store";
import { createTranscriptEntryFromLine } from "@/features/agents/state/transcript";
import {
  createOfficeAnimationTriggerState,
  reconcileOfficeAnimationTriggerState,
} from "@/lib/office/eventTriggers";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeAgent = (
  overrides: Partial<AgentState> & Pick<AgentStoreSeed, "agentId" | "name" | "sessionKey">,
): AgentState => ({
  agentId: overrides.agentId,
  name: overrides.name,
  sessionKey: overrides.sessionKey,
  avatarSeed: overrides.avatarSeed ?? overrides.agentId,
  avatarUrl: overrides.avatarUrl ?? null,
  model: overrides.model ?? null,
  thinkingLevel: overrides.thinkingLevel ?? "high",
  sessionExecHost: overrides.sessionExecHost,
  sessionExecSecurity: overrides.sessionExecSecurity,
  sessionExecAsk: overrides.sessionExecAsk,
  status: overrides.status ?? "idle",
  sessionCreated: overrides.sessionCreated ?? false,
  awaitingUserInput: overrides.awaitingUserInput ?? false,
  hasUnseenActivity: overrides.hasUnseenActivity ?? false,
  outputLines: overrides.outputLines ?? [],
  lastResult: overrides.lastResult ?? null,
  lastDiff: overrides.lastDiff ?? null,
  runId: overrides.runId ?? null,
  runStartedAt: overrides.runStartedAt ?? null,
  streamText: overrides.streamText ?? null,
  thinkingTrace: overrides.thinkingTrace ?? null,
  latestOverride: overrides.latestOverride ?? null,
  latestOverrideKind: overrides.latestOverrideKind ?? null,
  lastAssistantMessageAt: overrides.lastAssistantMessageAt ?? null,
  lastActivityAt: overrides.lastActivityAt ?? null,
  latestPreview: overrides.latestPreview ?? null,
  lastUserMessage: overrides.lastUserMessage ?? null,
  draft: overrides.draft ?? "",
  queuedMessages: overrides.queuedMessages ?? [],
  sessionSettingsSynced: overrides.sessionSettingsSynced ?? false,
  historyLoadedAt: overrides.historyLoadedAt ?? null,
  historyFetchLimit: overrides.historyFetchLimit ?? null,
  historyFetchedCount: overrides.historyFetchedCount ?? null,
  historyMaybeTruncated: overrides.historyMaybeTruncated ?? false,
  toolCallingEnabled: overrides.toolCallingEnabled ?? false,
  showThinkingTraces: overrides.showThinkingTraces ?? true,
  transcriptEntries: overrides.transcriptEntries ?? [],
  transcriptRevision: overrides.transcriptRevision ?? 0,
  transcriptSequenceCounter: overrides.transcriptSequenceCounter ?? 0,
  sessionEpoch: overrides.sessionEpoch ?? 0,
  lastHistoryRequestRevision: overrides.lastHistoryRequestRevision ?? null,
  lastAppliedHistoryRequestId: overrides.lastAppliedHistoryRequestId ?? null,
});

const makeTranscriptEntry = (params: {
  line: string;
  role: "user" | "assistant";
  sequenceKey: number;
  sessionKey: string;
  timestampMs: number;
}) => {
  const entry = createTranscriptEntryFromLine({
    line: params.line,
    sessionKey: params.sessionKey,
    source: "history",
    sequenceKey: params.sequenceKey,
    timestampMs: params.timestampMs,
    fallbackTimestampMs: params.timestampMs,
    role: params.role,
    kind: params.role === "user" ? "user" : "assistant",
    confirmed: true,
  });
  if (!entry) throw new Error("Failed to create transcript entry.");
  return entry;
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("reconcileOfficeAnimationTriggerState - skillGym hold", () => {
  it("does not set skillGymHoldByAgentId for skill messages after gym directive retirement", () => {
    const agent = makeAgent({
      agentId: "skill",
      name: "Skill",
      sessionKey: "agent:skill:main",
      lastUserMessage: "Build another Hermes skill.",
    });

    const state = reconcileOfficeAnimationTriggerState({
      state: createOfficeAnimationTriggerState(),
      agents: [agent],
      nowMs: 1_000,
    });

    expect(state.skillGymHoldByAgentId["skill"]).toBeFalsy();
  });

  it("does not set skillGymHoldByAgentId via transcript entry after gym directive retirement", () => {
    const sessionKey = "agent:skill:main";
    const agent = makeAgent({
      agentId: "skill",
      name: "Skill",
      sessionKey,
      lastUserMessage: null,
      transcriptEntries: [
        makeTranscriptEntry({
          line: "Please install a skill for me.",
          role: "user",
          sequenceKey: 1,
          sessionKey,
          timestampMs: 500,
        }),
      ],
    });

    const state = reconcileOfficeAnimationTriggerState({
      state: createOfficeAnimationTriggerState(),
      agents: [agent],
      nowMs: 1_000,
    });

    expect(state.skillGymHoldByAgentId["skill"]).toBeFalsy();
  });

  it("persists an existing hold when no new gym directive is present", () => {
    const priorState = {
      ...createOfficeAnimationTriggerState(),
      skillGymHoldByAgentId: { "skill": true },
    };

    const agent = makeAgent({
      agentId: "skill",
      name: "Skill",
      sessionKey: "agent:skill:main",
      lastUserMessage: "How is the weather?",
    });

    const state = reconcileOfficeAnimationTriggerState({
      state: priorState,
      agents: [agent],
      nowMs: 2_000,
    });

    expect(state.skillGymHoldByAgentId["skill"]).toBe(true);
  });

  it("does NOT add a hold entry when no gym directive and no previous hold exists", () => {
    const agent = makeAgent({
      agentId: "coder",
      name: "Coder",
      sessionKey: "agent:coder:main",
      lastUserMessage: "Fix the linting errors in src/index.ts",
    });

    const state = reconcileOfficeAnimationTriggerState({
      state: createOfficeAnimationTriggerState(),
      agents: [agent],
      nowMs: 1_000,
    });

    expect(state.skillGymHoldByAgentId["coder"]).toBeFalsy();
  });

  it("handles multiple agents without setting new gym holds", () => {
    const agents = [
      makeAgent({
        agentId: "skill",
        name: "Skill",
        sessionKey: "agent:skill:main",
        lastUserMessage: "Enable a skill for Hermes.",
      }),
      makeAgent({
        agentId: "main",
        name: "Main",
        sessionKey: "agent:main:main",
        lastUserMessage: "Check the logs.",
      }),
    ];

    const state = reconcileOfficeAnimationTriggerState({
      state: createOfficeAnimationTriggerState(),
      agents,
      nowMs: 1_000,
    });

    expect(state.skillGymHoldByAgentId["skill"]).toBeFalsy();
    expect(state.skillGymHoldByAgentId["main"]).toBeFalsy();
  });

  it("does NOT set skillGymHoldByAgentId when the latest message has no gym-skill directive", () => {
    const agent = makeAgent({
      agentId: "skill",
      name: "Skill",
      sessionKey: "agent:skill:main",
      lastUserMessage: "Leave the gym.",
    });

    const state = reconcileOfficeAnimationTriggerState({
      state: createOfficeAnimationTriggerState(),
      agents: [agent],
      nowMs: 1_000,
    });

    expect(state.skillGymHoldByAgentId["skill"]).toBeFalsy();
  });
});
