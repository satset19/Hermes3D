import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { AgentState } from "@/features/agents/state/store";
import type { Team } from "@/features/teams/types";
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

describe("FleetSidebar team grouping & toggle: accessibility & semantics", () => {
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

  describe("keyboard operability", () => {
    it("toggles team state when Space or Enter key is pressed on the switch", () => {
      const onToggleTeam = vi.fn();
      render(
        createElement(FleetSidebar, {
          agents,
          selectedAgentId: "agent-1",
          filter: "all",
          onFilterChange: vi.fn(),
          onSelectAgent: vi.fn(),
          onCreateAgent: vi.fn(),
          teams,
          onToggleTeam,
        })
      );

      const toggleFE = screen.getByTestId("team-toggle-team-frontend");
      expect(toggleFE).toHaveAttribute("role", "switch");
      expect(toggleFE).toHaveAttribute("aria-checked", "true");

      // Press Space
      fireEvent.keyDown(toggleFE, { key: " " });
      expect(onToggleTeam).toHaveBeenCalledWith("team-frontend", false);

      // Press Enter on backend toggle
      const toggleBE = screen.getByTestId("team-toggle-team-backend");
      expect(toggleBE).toHaveAttribute("aria-checked", "false");
      fireEvent.keyDown(toggleBE, { key: "Enter" });
      expect(onToggleTeam).toHaveBeenCalledWith("team-backend", true);
    });

    it("ignores non-toggle keys like ArrowDown or Tab", () => {
      const onToggleTeam = vi.fn();
      render(
        createElement(FleetSidebar, {
          agents,
          selectedAgentId: "agent-1",
          filter: "all",
          onFilterChange: vi.fn(),
          onSelectAgent: vi.fn(),
          onCreateAgent: vi.fn(),
          teams,
          onToggleTeam,
        })
      );

      const toggleFE = screen.getByTestId("team-toggle-team-frontend");
      fireEvent.keyDown(toggleFE, { key: "ArrowDown" });
      fireEvent.keyDown(toggleFE, { key: "Tab" });
      expect(onToggleTeam).not.toHaveBeenCalled();
    });
  });

  describe("active member count", () => {
    it("reflects active/visible agents in main header when teams are disabled", () => {
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

      // Backend team is disabled with 1 agent, Frontend team is enabled with 1 agent, Solo is 1 agent
      // Visible agents = Solo (1) + FE Dev (1) = 2. BE Dev is hidden.
      // The main header should show "Agents (2)" instead of raw total "Agents (3)"
      expect(screen.getByText("Agents (2)")).toBeInTheDocument();
      expect(screen.queryByText("Agents (3)")).not.toBeInTheDocument();
    });

    it("displays active member count semantics for each team section", () => {
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

      const feCount = screen.getByTestId("team-active-count-team-frontend");
      expect(feCount).toBeInTheDocument();
      expect(feCount).toHaveAttribute("data-active-count", "1");
      expect(feCount).toHaveAttribute("data-total-count", "1");
      expect(feCount).toHaveTextContent("(1)");

      const beCount = screen.getByTestId("team-active-count-team-backend");
      expect(beCount).toBeInTheDocument();
      expect(beCount).toHaveAttribute("data-active-count", "0");
      expect(beCount).toHaveAttribute("data-total-count", "1");
      expect(beCount).toHaveTextContent("(0/1)");
    });
  });

  describe("pending and error states", () => {
    it("renders pending state when team toggle is in progress via prop", () => {
      const onToggleTeam = vi.fn();
      render(
        createElement(FleetSidebar, {
          agents,
          selectedAgentId: "agent-1",
          filter: "all",
          onFilterChange: vi.fn(),
          onSelectAgent: vi.fn(),
          onCreateAgent: vi.fn(),
          teams,
          onToggleTeam,
          pendingTeamIds: ["team-frontend"],
        })
      );

      const toggleFE = screen.getByTestId("team-toggle-team-frontend");
      expect(toggleFE).toBeDisabled();
      expect(toggleFE).toHaveAttribute("aria-busy", "true");

      const pendingBadge = screen.getByTestId("team-pending-team-frontend");
      expect(pendingBadge).toBeInTheDocument();
      expect(pendingBadge).toHaveTextContent(/updating/i);

      // Attempting click or keydown while pending does not trigger onToggleTeam
      fireEvent.click(toggleFE);
      fireEvent.keyDown(toggleFE, { key: " " });
      expect(onToggleTeam).not.toHaveBeenCalled();
    });

    it("tracks pending state automatically when onToggleTeam returns a promise", async () => {
      let resolvePromise: () => void = () => {};
      const pendingPromise = new Promise<void>((resolve) => {
        resolvePromise = resolve;
      });
      const onToggleTeam = vi.fn().mockReturnValue(pendingPromise);

      render(
        createElement(FleetSidebar, {
          agents,
          selectedAgentId: "agent-1",
          filter: "all",
          onFilterChange: vi.fn(),
          onSelectAgent: vi.fn(),
          onCreateAgent: vi.fn(),
          teams,
          onToggleTeam,
        })
      );

      const toggleFE = screen.getByTestId("team-toggle-team-frontend");
      expect(toggleFE).not.toBeDisabled();

      // Click to start async toggle
      fireEvent.click(toggleFE);
      expect(onToggleTeam).toHaveBeenCalledWith("team-frontend", false);

      // Should now be in pending state
      expect(toggleFE).toBeDisabled();
      expect(toggleFE).toHaveAttribute("aria-busy", "true");
      expect(screen.getByTestId("team-pending-team-frontend")).toBeInTheDocument();

      // Resolve the promise
      resolvePromise();
      await waitFor(() => {
        expect(toggleFE).not.toBeDisabled();
      });

      expect(toggleFE).not.toHaveAttribute("aria-busy");
      expect(screen.queryByTestId("team-pending-team-frontend")).not.toBeInTheDocument();
    });

    it("renders error state with aria-invalid and role='alert' when teamErrors prop is provided", () => {
      render(
        createElement(FleetSidebar, {
          agents,
          selectedAgentId: "agent-1",
          filter: "all",
          onFilterChange: vi.fn(),
          onSelectAgent: vi.fn(),
          onCreateAgent: vi.fn(),
          teams,
          teamErrors: { "team-frontend": "Failed to toggle team: network error" },
        })
      );

      const toggleFE = screen.getByTestId("team-toggle-team-frontend");
      expect(toggleFE).toHaveAttribute("aria-invalid", "true");
      expect(toggleFE).toHaveAttribute("aria-errormessage", "team-error-team-frontend");

      const errorAlert = screen.getByTestId("team-error-team-frontend");
      expect(errorAlert).toBeInTheDocument();
      expect(errorAlert).toHaveAttribute("role", "alert");
      expect(errorAlert).toHaveTextContent("Failed to toggle team: network error");
    });

    it("displays error state when async onToggleTeam rejects", async () => {
      let rejectPromise: (err: Error) => void = () => {};
      const failingPromise = new Promise<void>((_, reject) => {
        rejectPromise = reject;
      });
      const onToggleTeam = vi.fn().mockReturnValue(failingPromise);

      render(
        createElement(FleetSidebar, {
          agents,
          selectedAgentId: "agent-1",
          filter: "all",
          onFilterChange: vi.fn(),
          onSelectAgent: vi.fn(),
          onCreateAgent: vi.fn(),
          teams,
          onToggleTeam,
        })
      );

      const toggleFE = screen.getByTestId("team-toggle-team-frontend");
      fireEvent.click(toggleFE);

      // Reject the promise
      rejectPromise(new Error("RPC timeout: gateway unavailable"));

      await waitFor(() => {
        expect(screen.getByTestId("team-error-team-frontend")).toBeInTheDocument();
      });

      const errorAlert = screen.getByTestId("team-error-team-frontend");
      expect(errorAlert).toHaveAttribute("role", "alert");
      expect(errorAlert).toHaveTextContent("RPC timeout: gateway unavailable");
      expect(toggleFE).toHaveAttribute("aria-invalid", "true");
    });

    it("clears error on next toggle attempt", async () => {
      let rejectPromise: (err: Error) => void = () => {};
      let resolveSecondPromise: () => void = () => {};
      let callCount = 0;

      const onToggleTeam = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return new Promise<void>((_, reject) => {
            rejectPromise = reject;
          });
        }
        return new Promise<void>((resolve) => {
          resolveSecondPromise = resolve;
        });
      });

      render(
        createElement(FleetSidebar, {
          agents,
          selectedAgentId: "agent-1",
          filter: "all",
          onFilterChange: vi.fn(),
          onSelectAgent: vi.fn(),
          onCreateAgent: vi.fn(),
          teams,
          onToggleTeam,
        })
      );

      const toggleFE = screen.getByTestId("team-toggle-team-frontend");
      fireEvent.click(toggleFE);

      rejectPromise(new Error("Network failure"));
      await waitFor(() => {
        expect(screen.getByTestId("team-error-team-frontend")).toBeInTheDocument();
      });

      // Second click should clear previous error
      fireEvent.click(toggleFE);
      await waitFor(() => {
        expect(screen.queryByTestId("team-error-team-frontend")).not.toBeInTheDocument();
      });

      resolveSecondPromise();
      await waitFor(() => {
        expect(toggleFE).not.toBeDisabled();
      });
    });
  });
});
