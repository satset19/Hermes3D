import { describe, expect, it, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, act, waitFor } from "@testing-library/react";
import { createElement, useEffect } from "react";
import AgentsPageScreen from "@/features/agents/screens/AgentsPageScreen";
import { AgentStoreProvider, useAgentStore, type AgentStoreSeed } from "@/features/agents/state/store";
import { TeamStoreProvider, useTeamStore } from "@/features/teams/store";
import type { Team } from "@/features/teams/types";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
  }),
  usePathname: () => "/agents",
  useSearchParams: () => new URLSearchParams(),
}));

// Mock runtime connection
const mockClient = {
  call: vi.fn().mockResolvedValue({}),
  onEvent: vi.fn(() => () => {}),
  onGap: vi.fn(() => () => {}),
  close: vi.fn(),
  isConnected: () => true,
};

vi.mock("@/lib/runtime/useRuntimeConnection", () => ({
  useRuntimeConnection: () => ({
    client: mockClient,
    provider: mockClient,
    status: "connected",
    connectPromptReady: true,
    shouldPromptForConnect: false,
    gatewayUrl: "ws://localhost:18789",
    token: "",
    selectedAdapterType: "hermes",
    activeAdapterType: "hermes",
    localGatewayDefaults: {},
    error: null,
    connect: vi.fn(),
    disconnect: vi.fn(),
    useLocalGatewayDefaults: vi.fn(),
    setGatewayUrl: vi.fn(),
    setToken: vi.fn(),
    setSelectedAdapterType: vi.fn(),
    supportsCapability: vi.fn(() => true),
  }),
}));

vi.mock("@/hooks/useStudioVoiceRepliesPreference", () => ({
  useStudioVoiceRepliesPreference: () => ({
    loaded: true,
    preference: { provider: "default", voiceId: "" },
    enabled: false,
    speed: 1.0,
  }),
}));

vi.mock("@/hooks/useVoiceReplyPlayback", () => ({
  useVoiceReplyPlayback: () => ({
    enqueue: vi.fn(),
    stop: vi.fn(),
  }),
}));

// Mock bootstrap operation so it doesn't try to fetch over network
vi.mock("@/features/agents/operations/studioBootstrapOperation", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/agents/operations/studioBootstrapOperation")>();
  return {
    ...actual,
    runStudioBootstrapLoadOperation: vi.fn(async () => []),
    executeStudioBootstrapLoadCommands: vi.fn(),
  };
});

vi.mock("@/lib/http", () => ({
  fetchJson: vi.fn().mockResolvedValue({}),
}));

const makeSeed = (id: string, name: string, teamId: string | null = null): AgentStoreSeed => ({
  agentId: id,
  name,
  sessionKey: `agent:${id}:main`,
  teamId,
});

describe("teamAgentSelection: AgentsPageScreen disabled team filtering", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }))
    );

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => "{}",
      json: async () => ({}),
    } as unknown as Response);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("focuses the first visible agent instead of a disabled team agent", async () => {
    const teams: Team[] = [
      { id: "team-ops", name: "Operations", enabled: false },
      { id: "team-core", name: "Core", enabled: true },
    ];

    const agents: AgentStoreSeed[] = [
      makeSeed("agent-ops", "Ops Agent", "team-ops"),
      makeSeed("agent-core", "Core Agent", "team-core"),
    ];

    const TestHost = () => {
      const { hydrateAgents } = useAgentStore();
      const { hydrateTeams } = useTeamStore();

      useEffect(() => {
        hydrateTeams(teams);
        hydrateAgents(agents, "agent-ops");
      }, [hydrateAgents, hydrateTeams]);

      return createElement(AgentsPageScreen);
    };

    render(
      createElement(
        TeamStoreProvider,
        null,
        createElement(AgentStoreProvider, null, createElement(TestHost))
      )
    );

    // Because agent-ops is in a disabled team, AgentsPageScreen should focus agent-core (Core Agent)
    // and NOT Ops Agent in the chat panel.
    await waitFor(() => {
      expect(screen.getByTestId("focused-agent-panel")).toBeInTheDocument();
    });

    await waitFor(() => {
      const panel = screen.getByTestId("focused-agent-panel");
      expect(panel).toHaveTextContent("Core Agent");
      expect(panel).not.toHaveTextContent("Ops Agent");
    });
  });

  it("renders empty state when all agents belong to disabled teams", async () => {
    const teams: Team[] = [
      { id: "team-ops", name: "Operations", enabled: false },
    ];

    const agents: AgentStoreSeed[] = [
      makeSeed("agent-ops-1", "Ops One", "team-ops"),
      makeSeed("agent-ops-2", "Ops Two", "team-ops"),
    ];

    const TestHost = () => {
      const { hydrateAgents } = useAgentStore();
      const { hydrateTeams } = useTeamStore();

      useEffect(() => {
        hydrateTeams(teams);
        hydrateAgents(agents, "agent-ops-1");
      }, [hydrateAgents, hydrateTeams]);

      return createElement(AgentsPageScreen);
    };

    render(
      createElement(
        TeamStoreProvider,
        null,
        createElement(AgentStoreProvider, null, createElement(TestHost))
      )
    );

    await waitFor(() => {
      expect(screen.getByTestId("focused-agent-panel")).toBeInTheDocument();
    });

    await waitFor(() => {
      const panel = screen.getByTestId("focused-agent-panel");
      expect(panel).not.toHaveTextContent("Ops One");
      expect(panel).not.toHaveTextContent("Ops Two");
      expect(panel).toHaveTextContent(/No agents match this filter|No agents available/i);
    });
  });

  it("dynamically switches focus away when an active agent's team is disabled", async () => {
    let updateTeamFn: ((id: string, patch: Partial<Team>) => void) | null = null;

    const initialTeams: Team[] = [
      { id: "team-ops", name: "Operations", enabled: true },
      { id: "team-core", name: "Core", enabled: true },
    ];

    const agents: AgentStoreSeed[] = [
      makeSeed("agent-ops", "Ops Agent", "team-ops"),
      makeSeed("agent-core", "Core Agent", "team-core"),
    ];

    const TestHost = () => {
      const { hydrateAgents } = useAgentStore();
      const { hydrateTeams, updateTeam } = useTeamStore();
      updateTeamFn = updateTeam;

      useEffect(() => {
        hydrateTeams(initialTeams);
        hydrateAgents(agents, "agent-ops");
      }, [hydrateAgents, hydrateTeams]);

      return createElement(AgentsPageScreen);
    };

    render(
      createElement(
        TeamStoreProvider,
        null,
        createElement(AgentStoreProvider, null, createElement(TestHost))
      )
    );

    // Initially Ops Agent is focused because team-ops is enabled
    await waitFor(() => {
      const panel = screen.getByTestId("focused-agent-panel");
      expect(panel).toHaveTextContent("Ops Agent");
    });

    // Disable team-ops
    act(() => {
      updateTeamFn?.("team-ops", { enabled: false });
    });

    // Should switch focus to Core Agent
    await waitFor(() => {
      const panel = screen.getByTestId("focused-agent-panel");
      expect(panel).toHaveTextContent("Core Agent");
      expect(panel).not.toHaveTextContent("Ops Agent");
    });
  });

  it("restores agent focus/selection when team is re-enabled", async () => {
    let updateTeamFn: ((id: string, patch: Partial<Team>) => void) | null = null;
    let dispatchFn: any = null;

    const initialTeams: Team[] = [
      { id: "team-ops", name: "Operations", enabled: false },
      { id: "team-core", name: "Core", enabled: true },
    ];

    const agents: AgentStoreSeed[] = [
      makeSeed("agent-ops", "Ops Agent", "team-ops"),
      makeSeed("agent-core", "Core Agent", "team-core"),
    ];

    const TestHost = () => {
      const { hydrateAgents, dispatch } = useAgentStore();
      const { hydrateTeams, updateTeam } = useTeamStore();
      updateTeamFn = updateTeam;
      dispatchFn = dispatch;

      useEffect(() => {
        hydrateTeams(initialTeams);
        hydrateAgents(agents, "agent-core");
      }, [hydrateAgents, hydrateTeams]);

      return createElement(AgentsPageScreen);
    };

    render(
      createElement(
        TeamStoreProvider,
        null,
        createElement(AgentStoreProvider, null, createElement(TestHost))
      )
    );

    await waitFor(() => {
      const panel = screen.getByTestId("focused-agent-panel");
      expect(panel).toHaveTextContent("Core Agent");
    });

    // Re-enable team-ops
    act(() => {
      updateTeamFn?.("team-ops", { enabled: true });
    });

    // Now select Ops Agent
    act(() => {
      dispatchFn?.({ type: "selectAgent", agentId: "agent-ops" });
    });

    await waitFor(() => {
      const panel = screen.getByTestId("focused-agent-panel");
      expect(panel).toHaveTextContent("Ops Agent");
    });
  });

  it("prevents selecting a disabled team agent via sidebar roster selection", async () => {
    let capturedOnSelectAgent: ((id: string) => void) | null = null;

    const teams: Team[] = [
      { id: "team-ops", name: "Operations", enabled: false },
      { id: "team-core", name: "Core", enabled: true },
    ];

    const agents: AgentStoreSeed[] = [
      makeSeed("agent-ops", "Ops Agent", "team-ops"),
      makeSeed("agent-core", "Core Agent", "team-core"),
    ];

    const TestHost = () => {
      const { hydrateAgents, dispatch } = useAgentStore();
      const { hydrateTeams } = useTeamStore();

      useEffect(() => {
        hydrateTeams(teams);
        hydrateAgents(agents, "agent-core");
      }, [hydrateAgents, hydrateTeams]);

      return createElement(
        "div",
        null,
        createElement(AgentsPageScreen),
        createElement("button", {
          "data-testid": "force-select-disabled",
          onClick: () => dispatch({ type: "selectAgent", agentId: "agent-ops" }),
        })
      );
    };

    render(
      createElement(
        TeamStoreProvider,
        null,
        createElement(AgentStoreProvider, null, createElement(TestHost))
      )
    );

    await waitFor(() => {
      const panel = screen.getByTestId("focused-agent-panel");
      expect(panel).toHaveTextContent("Core Agent");
    });

    // Try to force select the disabled agent
    act(() => {
      screen.getByTestId("force-select-disabled").click();
    });

    // The guard should prevent focusing the disabled agent; focus remains on Core Agent
    await waitFor(() => {
      const panel = screen.getByTestId("focused-agent-panel");
      expect(panel).toHaveTextContent("Core Agent");
      expect(panel).not.toHaveTextContent("Ops Agent");
    });
  });
});
