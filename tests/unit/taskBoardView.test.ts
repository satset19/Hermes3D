import { createElement } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TaskBoardView } from "@/features/office/tasks/TaskBoardView";
import type { TaskBoardCard } from "@/features/office/tasks/types";
import type { AgentState } from "@/features/agents/state/store";
import type { CronJobSummary } from "@/lib/cron/types";
import type { Team } from "@/features/teams/types";
import { TeamStoreContext } from "@/features/teams/store";

const createCard = (overrides: Partial<TaskBoardCard> = {}): TaskBoardCard => ({
  id: "task-1",
  title: "New task",
  description: "",
  status: "inbox",
  source: "hermes3d_manual",
  sourceEventId: null,
  assignedAgentId: null,
  createdAt: "2026-03-29T10:00:00.000Z",
  updatedAt: "2026-03-29T10:00:00.000Z",
  playbookJobId: null,
  runId: null,
  channel: null,
  externalThreadId: null,
  lastActivityAt: null,
  notes: [],
  isArchived: false,
  isInferred: false,
  model: null,
  skills: [],
  subagentCount: 0,
  scheduledFor: null,
  learnedSkill: false,
  ...overrides,
});

const createAgent = (overrides: Partial<AgentState> = {}): AgentState => ({
  agentId: "agent-1",
  name: "Agent One",
  sessionKey: "agent:agent-1:main",
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
  model: "openai/gpt-5",
  thinkingLevel: "medium",
  avatarSeed: "seed-1",
  avatarUrl: null,
  ...overrides,
});

const createCronJob = (): CronJobSummary => ({
  id: "job-1",
  name: "Morning review",
  agentId: "agent-1",
  enabled: true,
  updatedAtMs: Date.now(),
  schedule: { kind: "every", everyMs: 60_000 },
  sessionTarget: "isolated",
  wakeMode: "now",
  payload: { kind: "agentTurn", message: "Review new tasks." },
  state: {},
});

describe("TaskBoardView", () => {
  afterEach(() => {
    cleanup();
  });

  it("routes task edits through callbacks", () => {
    const onCreateCard = vi.fn();
    const onMoveCard = vi.fn();
    const onSelectCard = vi.fn();
    const onUpdateCard = vi.fn();
    const onDeleteCard = vi.fn();
    const onRefreshCronJobs = vi.fn();
    const selectedCard = createCard();

    render(
      createElement(TaskBoardView, {
        title: "Kanban",
        subtitle: "Track tasks.",
        agents: [createAgent()],
        cardsByStatus: {
          inbox: [selectedCard],
          scheduled: [],
          working: [],
          needs_attention: [],
          done: [],
        },
        selectedCard,
        activeRuns: [{ runId: "run-1", agentId: "agent-1", label: "Agent One" }],
        cronJobs: [createCronJob()],
        cronLoading: false,
        cronError: null,
        onCreateCard,
        onMoveCard,
        onSelectCard,
        onUpdateCard,
        onDeleteCard,
        onRefreshCronJobs,
      })
    );

    fireEvent.click(screen.getAllByRole("button", { name: /new task/i })[0]!);
    fireEvent.click(screen.getByRole("button", { name: /refresh/i }));
    fireEvent.click(screen.getAllByRole("button", { name: /new task/i })[1]!);
    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Create marketing website" },
    });
    fireEvent.change(screen.getByLabelText("Status"), {
      target: { value: "working" },
    });
    fireEvent.change(screen.getByLabelText("Assigned agent"), {
      target: { value: "agent-1" },
    });
    fireEvent.click(screen.getByRole("button", { name: /delete task/i }));

    expect(onCreateCard).toHaveBeenCalledTimes(1);
    expect(onRefreshCronJobs).toHaveBeenCalledTimes(1);
    expect(onSelectCard).toHaveBeenCalledWith(null);
    expect(onUpdateCard).toHaveBeenCalledWith("task-1", { title: "Create marketing website" });
    expect(onMoveCard).toHaveBeenCalledWith("task-1", "working");
    expect(onUpdateCard).toHaveBeenCalledWith("task-1", { assignedAgentId: "agent-1" });
    expect(onDeleteCard).toHaveBeenCalledWith("task-1");
  });

  it("filters out agents belonging to disabled teams from assignee options", () => {
    const teams: Team[] = [
      { id: "team-active", name: "Active Team", enabled: true },
      { id: "team-disabled", name: "Disabled Team", enabled: false },
    ];
    const agentActive = createAgent({
      agentId: "agent-active",
      name: "Active Agent",
      teamId: "team-active",
    });
    const agentDisabled = createAgent({
      agentId: "agent-disabled",
      name: "Disabled Agent",
      teamId: "team-disabled",
    });
    const agentSolo = createAgent({
      agentId: "agent-solo",
      name: "Solo Agent",
      teamId: null,
    });
    const selectedCard = createCard();

    render(
      createElement(TaskBoardView, {
        title: "Kanban",
        subtitle: "Track tasks.",
        agents: [agentActive, agentDisabled, agentSolo],
        teams,
        cardsByStatus: {
          inbox: [selectedCard],
          scheduled: [],
          working: [],
          needs_attention: [],
          done: [],
        },
        selectedCard,
        activeRuns: [],
        cronJobs: [],
        cronLoading: false,
        cronError: null,
        onCreateCard: vi.fn(),
        onMoveCard: vi.fn(),
        onSelectCard: vi.fn(),
        onUpdateCard: vi.fn(),
        onDeleteCard: vi.fn(),
        onRefreshCronJobs: vi.fn(),
      })
    );

    const select = screen.getByLabelText("Assigned agent") as HTMLSelectElement;
    const optionValues = Array.from(select.options).map((opt) => opt.value);

    expect(optionValues).toContain("agent-active");
    expect(optionValues).toContain("agent-solo");
    expect(optionValues).not.toContain("agent-disabled");
    expect(screen.queryByRole("option", { name: "Disabled Agent" })).not.toBeInTheDocument();
  });

  it("filters out disabled team agents when teams are provided via TeamStoreContext", () => {
    const teams: Team[] = [
      { id: "team-live", name: "Live Team", enabled: true },
      { id: "team-offline", name: "Offline Team", enabled: false },
    ];
    const agentLive = createAgent({
      agentId: "agent-live",
      name: "Live Agent",
      teamId: "team-live",
    });
    const agentOffline = createAgent({
      agentId: "agent-offline",
      name: "Offline Agent",
      teamId: "team-offline",
    });
    const selectedCard = createCard();

    render(
      createElement(
        TeamStoreContext.Provider,
        {
          value: {
            state: { teams, loading: false },
            hydrateTeams: vi.fn(),
            updateTeam: vi.fn(),
            removeTeam: vi.fn(),
            addTeam: vi.fn(),
          },
        },
        createElement(TaskBoardView, {
          title: "Kanban",
          subtitle: "Track tasks.",
          agents: [agentLive, agentOffline],
          cardsByStatus: {
            inbox: [selectedCard],
            scheduled: [],
            working: [],
            needs_attention: [],
            done: [],
          },
          selectedCard,
          activeRuns: [],
          cronJobs: [],
          cronLoading: false,
          cronError: null,
          onCreateCard: vi.fn(),
          onMoveCard: vi.fn(),
          onSelectCard: vi.fn(),
          onUpdateCard: vi.fn(),
          onDeleteCard: vi.fn(),
          onRefreshCronJobs: vi.fn(),
        })
      )
    );

    const select = screen.getByLabelText("Assigned agent") as HTMLSelectElement;
    const optionValues = Array.from(select.options).map((opt) => opt.value);

    expect(optionValues).toContain("agent-live");
    expect(optionValues).not.toContain("agent-offline");
    expect(screen.queryByRole("option", { name: "Offline Agent" })).not.toBeInTheDocument();
  });

  it("restores disabled team agents to assignee options when team is re-enabled", () => {
    const disabledTeams: Team[] = [
      { id: "team-ops", name: "Ops Team", enabled: false },
    ];
    const enabledTeams: Team[] = [
      { id: "team-ops", name: "Ops Team", enabled: true },
    ];
    const opsAgent = createAgent({
      agentId: "agent-ops",
      name: "Ops Agent",
      teamId: "team-ops",
    });
    const selectedCard = createCard();

    const props = {
      title: "Kanban",
      subtitle: "Track tasks.",
      agents: [opsAgent],
      teams: disabledTeams,
      cardsByStatus: {
        inbox: [selectedCard],
        scheduled: [],
        working: [],
        needs_attention: [],
        done: [],
      },
      selectedCard,
      activeRuns: [],
      cronJobs: [],
      cronLoading: false,
      cronError: null,
      onCreateCard: vi.fn(),
      onMoveCard: vi.fn(),
      onSelectCard: vi.fn(),
      onUpdateCard: vi.fn(),
      onDeleteCard: vi.fn(),
      onRefreshCronJobs: vi.fn(),
    };

    const { rerender } = render(createElement(TaskBoardView, props));

    const selectDisabled = screen.getByLabelText("Assigned agent") as HTMLSelectElement;
    expect(Array.from(selectDisabled.options).map((opt) => opt.value)).not.toContain("agent-ops");

    rerender(createElement(TaskBoardView, { ...props, teams: enabledTeams }));

    const selectEnabled = screen.getByLabelText("Assigned agent") as HTMLSelectElement;
    expect(Array.from(selectEnabled.options).map((opt) => opt.value)).toContain("agent-ops");
    expect(screen.getByRole("option", { name: "Ops Agent" })).toBeInTheDocument();
  });
});
