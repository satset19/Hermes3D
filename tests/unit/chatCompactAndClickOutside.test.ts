import { createElement, useEffect, useRef, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { AgentState } from "@/features/agents/state/store";
import { AgentChatPanel } from "@/features/agents/components/AgentChatPanel";
import type { GatewayModelChoice } from "@/lib/gateway/models";

const createAgent = (): AgentState => ({
  agentId: "agent-1",
  name: "Agent One",
  sessionKey: "agent:agent-1:studio:test-session",
  status: "idle",
  sessionCreated: true,
  awaitingUserInput: false,
  hasUnseenActivity: false,
  outputLines: [
    "> hello from user",
    "hello back from assistant",
  ],
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
  avatarSeed: "seed-1",
  avatarUrl: null,
});

describe("AgentChatPanel compact sizing", () => {
  const models: GatewayModelChoice[] = [
    { provider: "openai", id: "gpt-5", name: "gpt-5" },
  ];

  afterEach(() => {
    cleanup();
  });

  it("renders compact user message card with max-w-[42ch] and text-[9px]", () => {
    render(
      createElement(AgentChatPanel, {
        agent: createAgent(),
        isSelected: true,
        canSend: true,
        models,
        stopBusy: false,
        onLoadMoreHistory: vi.fn(),
        onModelChange: vi.fn(),
        onThinkingChange: vi.fn(),
        onDraftChange: vi.fn(),
        onSend: vi.fn(),
        onStopRun: vi.fn(),
        onAvatarShuffle: vi.fn(),
      })
    );

    const userText = screen.getByText("hello from user");
    const userCard = userText.closest(".ui-chat-user-card");
    expect(userCard).toBeTruthy();
    expect(userCard?.className).toContain("max-w-[42ch]");

    const userBody = userText.closest(".agent-markdown");
    expect(userBody?.className).toContain("text-[9px]");
    expect(userBody?.className).toContain("px-2");
    expect(userBody?.className).toContain("py-1.5");
  });

  it("renders compact assistant message card and compact composer", () => {
    render(
      createElement(AgentChatPanel, {
        agent: createAgent(),
        isSelected: true,
        canSend: true,
        models,
        stopBusy: false,
        onLoadMoreHistory: vi.fn(),
        onModelChange: vi.fn(),
        onThinkingChange: vi.fn(),
        onDraftChange: vi.fn(),
        onSend: vi.fn(),
        onStopRun: vi.fn(),
        onAvatarShuffle: vi.fn(),
      })
    );

    const assistantText = screen.getByText("hello back from assistant");
    const assistantCard = assistantText.closest(".ui-chat-assistant-card");
    expect(assistantCard).toBeTruthy();
    expect(assistantCard?.className).toContain("p-1.5");

    const assistantMarkdown = assistantText.closest(".agent-markdown");
    expect(assistantMarkdown?.className).toContain("text-[9px]");

    const textarea = screen.getByPlaceholderText("type a message");
    expect(textarea.className).toContain("text-[10px]");
    expect(textarea.className).toContain("min-h-[36px]");

    const sendBtn = screen.getByRole("button", { name: "Send" });
    expect(sendBtn.className).toContain("text-[10px]");
  });

  it("closes chat modal on click outside, but not on click inside modal or on toggle button", () => {
    const TestChatModalContainer = () => {
      const [chatOpen, setChatOpen] = useState(true);
      const chatModalRef = useRef(null);
      const chatLauncherRef = useRef(null);

      useEffect(() => {
        if (!chatOpen) return;

        const handlePointerDown = (event: PointerEvent) => {
          const target = event.target as Node | null;
          if (!target) return;
          const modal = chatModalRef.current as HTMLElement | null;
          const launcher = chatLauncherRef.current as HTMLElement | null;
          if (
            modal &&
            !modal.contains(target) &&
            !launcher?.contains(target)
          ) {
            setChatOpen(false);
          }
        };

        window.addEventListener("pointerdown", handlePointerDown);
        return () => {
          window.removeEventListener("pointerdown", handlePointerDown);
        };
      }, [chatOpen]);

      return createElement(
        "div",
        null,
        createElement("div", { "data-testid": "outside-area" }, "Outside"),
        chatOpen
          ? createElement(
              "div",
              { ref: chatModalRef, "data-testid": "chat-modal" },
              createElement("span", null, "Inside Chat")
            )
          : null,
        createElement(
          "button",
          {
            ref: chatLauncherRef,
            type: "button",
            onClick: () => setChatOpen((prev: boolean) => !prev),
          },
          chatOpen ? "HIDE CHAT" : "CHAT"
        )
      );
    };

    render(createElement(TestChatModalContainer));

    expect(screen.queryByTestId("chat-modal")).toBeInTheDocument();

    // Clicking inside the modal should NOT close it
    fireEvent.pointerDown(screen.getByText("Inside Chat"));
    expect(screen.queryByTestId("chat-modal")).toBeInTheDocument();

    // Clicking the launcher button should NOT close via pointerdown prematurely
    fireEvent.pointerDown(screen.getByRole("button", { name: "HIDE CHAT" }));
    expect(screen.queryByTestId("chat-modal")).toBeInTheDocument();

    // Clicking outside should close it
    fireEvent.pointerDown(screen.getByTestId("outside-area"));
    expect(screen.queryByTestId("chat-modal")).not.toBeInTheDocument();
  });
});
