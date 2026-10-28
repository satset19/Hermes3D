import { describe, it, expect, vi, afterEach } from "vitest";
import { cleanup, render, screen, fireEvent, act } from "@testing-library/react";
import { createElement, useEffect } from "react";
import type { Team } from "@/features/teams/types";
import type { AgentState } from "@/features/agents/state/store";
import type { OfficeAgent } from "@/features/retro-office/core/types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/office",
}));

vi.mock("@/features/pixel-office/PixelOffice2D", () => ({
  PixelOffice2D: () => createElement("div", { "data-testid": "mock-pixel-office" }),
}));

vi.mock("@/features/retro-office/RetroOffice3D", () => ({
  RetroOffice3D: () => createElement("div", { "data-testid": "mock-retro-office" }),
}));

import {
  OfficeScreen,
  filterChatRosterEntries,
  resolveActiveChatAgentId,
} from "@/features/office/screens/OfficeScreen";
import { AgentStoreProvider, useAgentStore } from "@/features/agents/state/store";
import { TeamStoreProvider, useTeamStore } from "@/features/teams/store";

const createTestAgent = (id: string, name: string, teamId: string | null = null): AgentState => ({
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

describe("OfficeScreen team filtering: helpers", () => {
  const teams: Team[] = [
    { id: "team-it", name: "Team IT", enabled: false },
    { id: "team-ops", name: "Operations", enabled: true },
  ];

  const localAgents: AgentState[] = [
    createTestAgent("agent-it-1", "IT Specialist", "team-it"),
    createTestAgent("agent-ops-1", "Ops Specialist", "team-ops"),
    createTestAgent("agent-solo", "Solo Specialist", null),
  ];

  const remoteAgents: OfficeAgent[] = [
    { id: "remote:agent-1", name: "Remote Specialist", status: "idle", color: "#fff", item: "mug" },
  ];

  it("filterChatRosterEntries excludes agents belonging to disabled teams", () => {
    const entries = filterChatRosterEntries(localAgents, remoteAgents, teams);
    const ids = entries.map((e) => e.id);

    expect(ids).not.toContain("agent-it-1");
    expect(ids).toContain("agent-ops-1");
    expect(ids).toContain("agent-solo");
    expect(ids).toContain("remote:agent-1");
  });

  it("resolveActiveChatAgentId redirects away from disabled-team agent to first visible agent", () => {
    // Current selection is in disabled team 'team-it'
    const nextId = resolveActiveChatAgentId({
      currentId: "agent-it-1",
      agents: localAgents,
      remoteAgentIds: ["remote:agent-1"],
      teams,
    });

    expect(nextId).toBe("agent-ops-1");
  });

  it("resolveActiveChatAgentId returns null if all agents belong to disabled teams", () => {
    const allDisabledAgents: AgentState[] = [
      createTestAgent("agent-it-1", "IT Specialist 1", "team-it"),
      createTestAgent("agent-it-2", "IT Specialist 2", "team-it"),
    ];

    const nextId = resolveActiveChatAgentId({
      currentId: "agent-it-1",
      agents: allDisabledAgents,
      remoteAgentIds: [],
      teams,
    });

    expect(nextId).toBeNull();
  });

  it("resolveActiveChatAgentId keeps selection if current agent is visible", () => {
    const nextId = resolveActiveChatAgentId({
      currentId: "agent-ops-1",
      agents: localAgents,
      remoteAgentIds: ["remote:agent-1"],
      teams,
    });

    expect(nextId).toBe("agent-ops-1");
  });

  it("resolveActiveChatAgentId selects first visible agent when opening chat without selection", () => {
    const nextId = resolveActiveChatAgentId({
      currentId: null,
      agents: localAgents,
      remoteAgentIds: ["remote:agent-1"],
      teams,
    });

    expect(nextId).toBe("agent-ops-1");
  });
});

function TestOfficeContainer({ initialAgentId }: { initialAgentId?: string }) {
  const { hydrateAgents } = useAgentStore();
  const { hydrateTeams } = useTeamStore();

  useEffect(() => {
    hydrateTeams([
      { id: "team-it", name: "Team IT", enabled: false },
      { id: "team-ops", name: "Operations", enabled: true },
    ]);
    hydrateAgents([
      { agentId: "agent-it-1", name: "IT Specialist", sessionKey: "agent:agent-it-1:main", teamId: "team-it" },
      { agentId: "agent-ops-1", name: "Ops Specialist", sessionKey: "agent:agent-ops-1:main", teamId: "team-ops" },
    ], initialAgentId);
  }, [hydrateAgents, hydrateTeams, initialAgentId]);

  return createElement(OfficeScreen);
}

describe("OfficeScreen team filtering: rendered component integration", () => {
  afterEach(() => {
    cleanup();
  });

  it("filters disabled-team agents from rendered chat roster and active selection", () => {
    render(
      createElement(
        AgentStoreProvider,
        null,
        createElement(TeamStoreProvider, null, createElement(TestOfficeContainer, { initialAgentId: "agent-it-1" }))
      )
    );

    const chatBtn = screen.getByRole("button", { name: /chat/i });
    fireEvent.click(chatBtn);

    const opsElements = screen.getAllByText("Ops Specialist");
    expect(opsElements.length).toBeGreaterThan(0);
    expect(screen.queryByText("IT Specialist")).not.toBeInTheDocument();
  });

  it("retains only enabled and ungrouped agents when team is toggled disabled", () => {
    let updateTeamFn: ((teamId: string, patch: Partial<Team>) => void) | null = null;

    function DynamicToggleHarness() {
      const { hydrateAgents } = useAgentStore();
      const teamStore = useTeamStore();
      updateTeamFn = teamStore.updateTeam;

      useEffect(() => {
        teamStore.hydrateTeams([
          { id: "team-it", name: "Team IT", enabled: true },
        ]);
        hydrateAgents([
          { agentId: "agent-it-1", name: "IT Specialist", sessionKey: "agent:agent-it-1:main", teamId: "team-it" },
          { agentId: "agent-solo", name: "Solo Specialist", sessionKey: "agent:agent-solo:main", teamId: null },
        ], "agent-it-1");
      }, [hydrateAgents]);

      return createElement(OfficeScreen);
    }

    render(
      createElement(
        AgentStoreProvider,
        null,
        createElement(TeamStoreProvider, null, createElement(DynamicToggleHarness, null))
      )
    );

    const chatBtn = screen.getByRole("button", { name: /chat/i });
    fireEvent.click(chatBtn);

    expect(screen.getAllByText("IT Specialist").length).toBeGreaterThan(0);

    // Toggle team to disabled
    act(() => {
      updateTeamFn?.("team-it", { enabled: false });
    });

    expect(screen.queryByText("IT Specialist")).not.toBeInTheDocument();
    expect(screen.getAllByText("Solo Specialist").length).toBeGreaterThan(0);
  });
});
