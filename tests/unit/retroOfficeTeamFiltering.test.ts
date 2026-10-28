import { describe, expect, it } from "vitest";
import type { Team } from "@/features/teams/types";
import type { OfficeAgent } from "@/features/retro-office/core/types";
import type { AgentState } from "@/features/agents/state/store";
import { selectVisibleOfficeAgents } from "@/features/retro-office/RetroOffice3D";

const makeTestOfficeAgent = (id: string, name: string, teamId: string | null = null): OfficeAgent => ({
  id,
  name,
  status: "idle",
  color: "#4f46e5",
  item: "mug",
  teamId,
});

const makeTestAgentState = (id: string, name: string, teamId: string | null = null): AgentState => ({
  agentId: id,
  name,
  sessionKey: `agent:${id}:main`,
  status: "idle",
  sessionCreated: true,
  awaitingUserInput: false,
  hasUnseenActivity: false,
  outputLines: [],
  lastResult: null,
  lastDiff: null,
  runId: null,
  runStartedAt: null,
  streamText: null,
  thinkingTrace: null,
  latestOverride: null,
  latestOverrideKind: null,
  lastAssistantMessageAt: null,
  lastActivityAt: null,
  latestPreview: null,
  lastUserMessage: null,
  draft: "",
  sessionSettingsSynced: true,
  historyLoadedAt: null,
  historyFetchLimit: null,
  historyFetchedCount: null,
  historyMaybeTruncated: false,
  toolCallingEnabled: true,
  showThinkingTraces: true,
  teamId,
});

describe("selectVisibleOfficeAgents pure selector", () => {
  const teams: Team[] = [
    { id: "team-it", name: "Team IT", enabled: false },
    { id: "team-ops", name: "Operations", enabled: true },
  ];

  it("returns all agents when teams list is empty, undefined, or null", () => {
    const agents = [
      makeTestOfficeAgent("a1", "Alice", "team-it"),
      makeTestOfficeAgent("a2", "Bob", "team-ops"),
    ];

    expect(selectVisibleOfficeAgents(agents, [])).toEqual(agents);
    expect(selectVisibleOfficeAgents(agents, undefined)).toEqual(agents);
    expect(selectVisibleOfficeAgents(agents, null)).toEqual(agents);
  }, 20000);

  it("filters out OfficeAgents belonging to a disabled team", () => {
    const agents = [
      makeTestOfficeAgent("a1", "Alice", "team-it"), // disabled
      makeTestOfficeAgent("a2", "Bob", "team-ops"),  // enabled
      makeTestOfficeAgent("a3", "Charlie", null),    // no team
      makeTestOfficeAgent("a4", "David", undefined), // undefined team
      makeTestOfficeAgent("a5", "Eve", "unknown"),   // team not in list
    ];

    const visible = selectVisibleOfficeAgents(agents, teams);
    const visibleIds = visible.map((a) => a.id);

    expect(visibleIds).toEqual(["a2", "a3", "a4", "a5"]);
    expect(visible.find((a) => a.id === "a1")).toBeUndefined();
  }, 20000);

  it("filters out AgentState (taskBoardAgents) belonging to a disabled team", () => {
    const stateAgents = [
      makeTestAgentState("a1", "Alice", "team-it"), // disabled
      makeTestAgentState("a2", "Bob", "team-ops"),  // enabled
      makeTestAgentState("a3", "Charlie", null),    // no team
    ];

    const visible = selectVisibleOfficeAgents(stateAgents, teams);
    expect(visible.map((a) => a.agentId)).toEqual(["a2", "a3"]);
  }, 20000);

  it("restores disabled team agents when the team is re-enabled", () => {
    const agents = [
      makeTestOfficeAgent("a1", "Alice", "team-it"),
      makeTestOfficeAgent("a2", "Bob", "team-ops"),
    ];

    const disabledTeams: Team[] = [
      { id: "team-it", name: "Team IT", enabled: false },
      { id: "team-ops", name: "Operations", enabled: true },
    ];
    const enabledTeams: Team[] = [
      { id: "team-it", name: "Team IT", enabled: true },
      { id: "team-ops", name: "Operations", enabled: true },
    ];

    expect(selectVisibleOfficeAgents(agents, disabledTeams).map((a) => a.id)).toEqual(["a2"]);
    expect(selectVisibleOfficeAgents(agents, enabledTeams).map((a) => a.id)).toEqual(["a1", "a2"]);
  }, 20000);
});
