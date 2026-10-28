import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { AgentState } from "@/features/agents/state/store";
import type { PendingExecApproval } from "@/features/agents/approvals/types";
import { AgentApprovalPopupStack } from "@/features/office/components/AgentApprovalPopup";

const createAgent = (id: string, name: string): AgentState => ({
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
  model: "openai/gpt-5",
  thinkingLevel: "medium",
  avatarSeed: id,
  avatarUrl: null,
});

const createApproval = (
  id: string,
  agentId: string,
  overrides?: Partial<PendingExecApproval>
): PendingExecApproval => ({
  id,
  agentId,
  sessionKey: `agent:${agentId}:main`,
  command: "git status",
  cwd: "/workspace",
  host: "gateway",
  security: "allowlist",
  ask: "always",
  resolvedPath: "/bin/git",
  createdAtMs: 1000,
  expiresAtMs: 2000,
  resolving: false,
  error: null,
  ...overrides,
});

describe("AgentApprovalPopupStack", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders popup for each agent with pending approval", () => {
    const agents = [
      createAgent("agent-1", "Coder"),
      createAgent("agent-2", "Reviewer"),
    ];
    const approvalsByAgentId = {
      "agent-1": [createApproval("app-1", "agent-1", { command: "npm test" })],
      "agent-2": [createApproval("app-2", "agent-2", { command: "rm -rf tmp" })],
    };

    render(
      createElement(AgentApprovalPopupStack, {
        agents,
        approvalsByAgentId,
        unscopedApprovals: [],
        onResolve: vi.fn(),
      })
    );

    expect(screen.getByTestId("agent-approval-popup-app-1")).toBeInTheDocument();
    expect(screen.getByTestId("agent-approval-popup-app-2")).toBeInTheDocument();
    expect(screen.getByText("Coder")).toBeInTheDocument();
    expect(screen.getByText("Reviewer")).toBeInTheDocument();
    expect(screen.getByText("npm test")).toBeInTheDocument();
    expect(screen.getByText("rm -rf tmp")).toBeInTheDocument();
  });

  it("triggers resolve callback when user changes select option", () => {
    const agents = [createAgent("agent-1", "Coder")];
    const approvalsByAgentId = {
      "agent-1": [createApproval("app-1", "agent-1")],
    };
    const onResolve = vi.fn();

    render(
      createElement(AgentApprovalPopupStack, {
        agents,
        approvalsByAgentId,
        unscopedApprovals: [],
        onResolve,
      })
    );

    const select = screen.getByTestId("popup-approval-select-app-1");
    expect(select).toBeInTheDocument();

    fireEvent.change(select, { target: { value: "allow-once" } });
    expect(onResolve).toHaveBeenNthCalledWith(1, "app-1", "allow-once");

    fireEvent.change(select, { target: { value: "allow-always" } });
    expect(onResolve).toHaveBeenNthCalledWith(2, "app-1", "allow-always");

    fireEvent.change(select, { target: { value: "deny" } });
    expect(onResolve).toHaveBeenNthCalledWith(3, "app-1", "deny");
  });

  it("disables select when approval is resolving", () => {
    const agents = [createAgent("agent-1", "Coder")];
    const approvalsByAgentId = {
      "agent-1": [createApproval("app-1", "agent-1", { resolving: true })],
    };

    render(
      createElement(AgentApprovalPopupStack, {
        agents,
        approvalsByAgentId,
        unscopedApprovals: [],
        onResolve: vi.fn(),
      })
    );

    const select = screen.getByTestId("popup-approval-select-app-1");
    expect(select).toBeDisabled();
    expect(screen.getByText("Resolving...")).toBeInTheDocument();
  });

  it("invokes onSelectAgent when clicking open chat button", () => {
    const agents = [createAgent("agent-1", "Coder")];
    const approvalsByAgentId = {
      "agent-1": [createApproval("app-1", "agent-1")],
    };
    const onSelectAgent = vi.fn();

    render(
      createElement(AgentApprovalPopupStack, {
        agents,
        approvalsByAgentId,
        unscopedApprovals: [],
        onResolve: vi.fn(),
        onSelectAgent,
      })
    );

    const chatBtn = screen.getByTestId("popup-open-chat-app-1");
    fireEvent.click(chatBtn);
    expect(onSelectAgent).toHaveBeenCalledWith("agent-1");
  });
});
