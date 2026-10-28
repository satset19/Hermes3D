import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { AgentState } from "@/features/agents/state/store";
import { AgentChatPanel } from "@/features/agents/components/AgentChatPanel";

const createAgent = (): AgentState => ({
  agentId: "agent-test-dance",
  name: "Dance Master",
  sessionKey: "agent:agent-test-dance:studio:test-session",
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
  model: null,
  thinkingLevel: null,
  avatarSeed: "seed-dance",
  avatarUrl: null,
});

describe("AgentChatPanel dance emotes", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders dance trigger button and toggles menu", () => {
    render(
      createElement(AgentChatPanel, {
        agent: createAgent(),
        isSelected: true,
        canSend: true,
        models: [],
        stopBusy: false,
        onLoadMoreHistory: vi.fn(),
        onDraftChange: vi.fn(),
        onSend: vi.fn(),
        onStopRun: vi.fn(),
        onAvatarShuffle: vi.fn(),
        onModelChange: vi.fn(),
        onThinkingChange: vi.fn(),
      }),
    );

    const danceBtn = screen.getByTestId("agent-dance-trigger");
    expect(danceBtn).toBeDefined();

    // Menu should be closed initially
    expect(screen.queryByText("Disco")).toBeNull();

    // Open menu
    fireEvent.click(danceBtn);
    expect(screen.getByText("Disco")).toBeDefined();
    expect(screen.getByText("Robot Wave")).toBeDefined();
    expect(screen.getByText("360 Spin")).toBeDefined();
    expect(screen.getByText("Rock Headbang")).toBeDefined();
  });

  it("invokes onDance and dispatches custom window event on selection", () => {
    const onDance = vi.fn();
    const eventSpy = vi.fn();
    window.addEventListener("hermes3d:trigger-dance", eventSpy);

    render(
      createElement(AgentChatPanel, {
        agent: createAgent(),
        isSelected: true,
        canSend: true,
        models: [],
        stopBusy: false,
        onLoadMoreHistory: vi.fn(),
        onDraftChange: vi.fn(),
        onSend: vi.fn(),
        onStopRun: vi.fn(),
        onAvatarShuffle: vi.fn(),
        onModelChange: vi.fn(),
        onThinkingChange: vi.fn(),
        onDance,
      }),
    );

    fireEvent.click(screen.getByTestId("agent-dance-trigger"));
    const discoOption = screen.getByText("Disco");
    fireEvent.click(discoOption);

    expect(onDance).toHaveBeenCalledWith("disco");
    expect(eventSpy).toHaveBeenCalled();
    const event = eventSpy.mock.calls[0][0] as CustomEvent;
    expect(event.detail.agentId).toBe("agent-test-dance");
    expect(event.detail.danceStyle).toBe("disco");

    window.removeEventListener("hermes3d:trigger-dance", eventSpy);
  });
});
