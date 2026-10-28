import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, fireEvent, renderHook, act, cleanup } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import type { Team } from "@/features/teams/types";
import {
  TeamStoreProvider,
  useTeamStore,
  getTeamForAgent,
  isAgentInDisabledTeam,
} from "@/features/teams/store";
import type { AgentState, AgentStoreSeed } from "@/features/agents/state/store";
import { AgentStoreProvider, useAgentStore } from "@/features/agents/state/store";
import type { OfficeAgent } from "@/features/retro-office/core/types";
import { FleetSidebar } from "@/features/agents/components/FleetSidebar";

const makeAgent = (id: string, name: string, teamId: string | null = null): AgentState => ({
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

describe("Team System: Store and Helpers", () => {
  const teams: Team[] = [
    { id: "team-core", name: "Core", enabled: true },
    { id: "team-ops", name: "Operations", enabled: false },
  ];

  it("getTeamForAgent resolves the matching team or null", () => {
    expect(getTeamForAgent(teams, "team-core")?.name).toBe("Core");
    expect(getTeamForAgent(teams, "team-ops")?.name).toBe("Operations");
    expect(getTeamForAgent(teams, "team-nonexistent")).toBeNull();
    expect(getTeamForAgent(teams, null)).toBeNull();
    expect(getTeamForAgent(teams, undefined)).toBeNull();
  });

  it("isAgentInDisabledTeam detects disabled teams", () => {
    expect(isAgentInDisabledTeam(teams, "team-core")).toBe(false);
    expect(isAgentInDisabledTeam(teams, "team-ops")).toBe(true);
    expect(isAgentInDisabledTeam(teams, null)).toBe(false);
    expect(isAgentInDisabledTeam(teams, "team-unknown")).toBe(false);
  });

  it("TeamStoreProvider manages team state correctly", () => {
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(TeamStoreProvider, null, children);

    const { result } = renderHook(() => useTeamStore(), { wrapper });

    expect(result.current.state.teams).toEqual([]);

    act(() => {
      result.current.hydrateTeams(teams);
    });
    expect(result.current.state.teams.length).toBe(2);

    act(() => {
      result.current.updateTeam("team-ops", { enabled: true });
    });
    expect(result.current.state.teams.find((t) => t.id === "team-ops")?.enabled).toBe(true);

    act(() => {
      result.current.addTeam({ id: "team-new", name: "New Team", enabled: true });
    });
    expect(result.current.state.teams.length).toBe(3);

    act(() => {
      result.current.removeTeam("team-new");
    });
    expect(result.current.state.teams.length).toBe(2);
  });
});

describe("Team System: FleetSidebar Grouping & Toggling", () => {
  afterEach(() => {
    cleanup();
  });
  const teams: Team[] = [
    { id: "team-frontend", name: "Frontend", enabled: true },
    { id: "team-backend", name: "Backend", enabled: false },
  ];

  const agents: AgentState[] = [
    makeAgent("agent-1", "Solo Agent", null),
    makeAgent("agent-2", "FE Dev", "team-frontend"),
    makeAgent("agent-3", "BE Dev", "team-backend"),
  ];

  it("renders ungrouped agents and teams with headers", () => {
    render(
      createElement(FleetSidebar, {
        agents,
        selectedAgentId: "agent-1",
        filter: "all",
        onFilterChange: vi.fn(),
        onSelectAgent: vi.fn(),
        onCreateAgent: vi.fn(),
        teams,
      })
    );

    // Ungrouped agent row is visible
    expect(screen.getByTestId("fleet-agent-row-agent-1")).toBeInTheDocument();
    expect(screen.getByText("Solo Agent")).toBeInTheDocument();

    // Frontend team header is rendered
    expect(screen.getByTestId("fleet-team-section-team-frontend")).toBeInTheDocument();
    expect(screen.getByText("Frontend")).toBeInTheDocument();
    // Frontend agent row is visible because team is enabled
    expect(screen.getByTestId("fleet-agent-row-agent-2")).toBeInTheDocument();
    expect(screen.getByText("FE Dev")).toBeInTheDocument();

    // Backend team header is rendered
    expect(screen.getByTestId("fleet-team-section-team-backend")).toBeInTheDocument();
    expect(screen.getByText("Backend")).toBeInTheDocument();
    // Backend agent row is hidden because team is disabled
    expect(screen.queryByTestId("fleet-agent-row-agent-3")).not.toBeInTheDocument();
    expect(screen.queryByText("BE Dev")).not.toBeInTheDocument();
  });

  it("calls onToggleTeam when team toggle switch is clicked", () => {
    const onToggleTeam = vi.fn();
    render(
      createElement(FleetSidebar, {
        agents,
        selectedAgentId: null,
        filter: "all",
        onFilterChange: vi.fn(),
        onSelectAgent: vi.fn(),
        onCreateAgent: vi.fn(),
        teams,
        onToggleTeam,
      })
    );

    const toggleFE = screen.getByTestId("team-toggle-team-frontend");
    expect(toggleFE).toHaveAttribute("aria-checked", "true");
    fireEvent.click(toggleFE);
    expect(onToggleTeam).toHaveBeenCalledWith("team-frontend", false);

    const toggleBE = screen.getByTestId("team-toggle-team-backend");
    expect(toggleBE).toHaveAttribute("aria-checked", "false");
    fireEvent.click(toggleBE);
    expect(onToggleTeam).toHaveBeenCalledWith("team-backend", true);
  });
});

describe("Team System: AgentStore teamId propagation & 3D filtering", () => {
  it("propagates teamId in AgentStoreProvider hydration", () => {
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(AgentStoreProvider, null, children);

    const { result } = renderHook(() => useAgentStore(), { wrapper });

    act(() => {
      result.current.hydrateAgents([
        { agentId: "agent-1", name: "Agent 1", sessionKey: "key-1", teamId: "team-a" },
        { agentId: "agent-2", name: "Agent 2", sessionKey: "key-2", teamId: null },
      ]);
    });

    expect(result.current.state.agents[0].teamId).toBe("team-a");
    expect(result.current.state.agents[1].teamId).toBeNull();
  });

  it("filters agents in disabled teams from 3D scene agents list", () => {
    const teams: Team[] = [
      { id: "team-alpha", name: "Alpha", enabled: true },
      { id: "team-beta", name: "Beta", enabled: false },
    ];

    const officeAgents: OfficeAgent[] = [
      { id: "a1", name: "Agent 1", status: "idle", color: "#fff", item: "mug", teamId: "team-alpha" },
      { id: "a2", name: "Agent 2", status: "idle", color: "#fff", item: "mug", teamId: "team-beta" },
      { id: "a3", name: "Agent 3", status: "idle", color: "#fff", item: "mug", teamId: null },
    ];

    const visibleAgents = officeAgents.filter(
      (agent) => !isAgentInDisabledTeam(teams, agent.teamId)
    );

    expect(visibleAgents.map((a) => a.id)).toEqual(["a1", "a3"]);
    expect(visibleAgents.find((a) => a.id === "a2")).toBeUndefined();
  });
});
