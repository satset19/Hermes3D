import { memo, useMemo, useState } from "react";
import type { AgentState } from "@/features/agents/state/store";
import type { ExecApprovalDecision, PendingExecApproval } from "@/features/agents/approvals/types";

const POPUP_SELECT_STYLE = {
  backgroundColor: "#17120a",
  color: "#ffffff",
} as const;

export type AgentApprovalPopupStackProps = {
  agents: AgentState[];
  approvalsByAgentId: Record<string, PendingExecApproval[]>;
  unscopedApprovals?: PendingExecApproval[];
  onResolve: (id: string, decision: ExecApprovalDecision) => void;
  onSelectAgent?: (agentId: string) => void;
};

type FlattenedApprovalItem = {
  approval: PendingExecApproval;
  agent: AgentState | null;
};

export const AgentApprovalPopupStack = memo(function AgentApprovalPopupStack({
  agents,
  approvalsByAgentId,
  unscopedApprovals = [],
  onResolve,
  onSelectAgent,
}: AgentApprovalPopupStackProps) {
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(() => new Set());

  const agentMap = useMemo(() => {
    const map = new Map<string, AgentState>();
    for (const agent of agents) {
      map.set(agent.agentId, agent);
    }
    return map;
  }, [agents]);

  const items = useMemo(() => {
    const result: FlattenedApprovalItem[] = [];

    for (const [agentId, approvals] of Object.entries(approvalsByAgentId)) {
      const agent = agentMap.get(agentId) ?? null;
      for (const approval of approvals) {
        if (!dismissedIds.has(approval.id)) {
          result.push({ approval, agent });
        }
      }
    }

    for (const approval of unscopedApprovals) {
      if (!dismissedIds.has(approval.id)) {
        const agent = approval.agentId ? (agentMap.get(approval.agentId) ?? null) : null;
        result.push({ approval, agent });
      }
    }

    return result;
  }, [agentMap, approvalsByAgentId, dismissedIds, unscopedApprovals]);

  if (items.length === 0) {
    return null;
  }

  const handleDismiss = (id: string) => {
    setDismissedIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  };

  return (
    <aside
      aria-label="Pending agent approvals"
      className="pointer-events-auto fixed right-4 top-14 z-50 flex max-w-sm flex-col gap-2.5 font-mono text-[9px]"
    >
      {items.map(({ approval, agent }) => {
        const agentName = agent?.name ?? (approval.agentId ? `Agent (${approval.agentId.slice(0, 8)})` : "Global Agent");
        const disabled = approval.resolving;

        return (
          <div
            key={approval.id}
            data-testid={`agent-approval-popup-${approval.id}`}
            className="flex flex-col gap-1.5 rounded-md border border-amber-600/50 bg-[#140e06]/95 p-2.5 text-amber-100 shadow-2xl backdrop-blur-md"
          >
            <div className="flex items-center justify-between gap-2 border-b border-amber-900/40 pb-1.5">
              <div className="flex items-center gap-1.5">
                <span
                  className="flex h-3.5 w-3.5 items-center justify-center rounded-full text-[8px] font-bold text-black"
                  style={{ backgroundColor: agent?.avatarUrl ? "#f59e0b" : "#d97706" }}
                >
                  !
                </span>
                <span className="font-semibold text-amber-200">{agentName}</span>
                <span className="rounded bg-amber-950/80 px-1 py-0.2 text-[8px] text-amber-300">
                  Approval required
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleDismiss(approval.id)}
                aria-label={`Dismiss popup for ${approval.id}`}
                className="text-amber-400/60 transition hover:text-amber-200"
              >
                X
              </button>
            </div>

            <div className="rounded bg-black/60 px-2 py-1">
              <div className="text-[8px] text-amber-400/70">Command:</div>
              <div className="break-all font-mono font-medium text-white">{approval.command}</div>
            </div>

            {approval.cwd ? (
              <div className="text-[8px] text-amber-400/70">
                CWD: <span className="text-amber-200/90">{approval.cwd}</span>
              </div>
            ) : null}

            {approval.error ? (
              <div className="rounded bg-red-950/80 px-1.5 py-0.5 text-[8px] text-red-200">
                {approval.error}
              </div>
            ) : null}

            <div className="flex items-center justify-between gap-2 pt-0.5">
              <div className="flex items-center gap-1.5">
                <label
                  htmlFor={`popup-approval-select-${approval.id}`}
                  className="text-[8px] text-amber-300/80 whitespace-nowrap"
                >
                  Decision:
                </label>
                <select
                  id={`popup-approval-select-${approval.id}`}
                  data-testid={`popup-approval-select-${approval.id}`}
                  aria-label={`Select decision for approval ${approval.id}`}
                  className="h-5 rounded border border-amber-700/60 bg-[#1c140a] px-1.5 text-[8px] font-medium text-white transition hover:bg-[#261c0e] focus:outline-none focus:ring-1 focus:ring-amber-500 disabled:cursor-not-allowed disabled:opacity-50"
                  style={POPUP_SELECT_STYLE}
                  disabled={disabled}
                  value=""
                  onChange={(event) => {
                    const decision = event.target.value as ExecApprovalDecision;
                    if (decision) {
                      onResolve(approval.id, decision);
                    }
                  }}
                >
                  <option value="" disabled>
                    {approval.resolving ? "Resolving..." : "Select decision..."}
                  </option>
                  <option value="allow-once">Allow once</option>
                  <option value="allow-always">Always allow</option>
                  <option value="deny">Deny</option>
                </select>
              </div>

              {agent && onSelectAgent ? (
                <button
                  type="button"
                  data-testid={`popup-open-chat-${approval.id}`}
                  onClick={() => onSelectAgent(agent.agentId)}
                  className="rounded border border-amber-800/60 bg-amber-950/40 px-1.5 py-0.5 text-[8px] font-medium text-amber-300 transition hover:bg-amber-900/60 hover:text-white"
                >
                  Open Chat
                </button>
              ) : null}
            </div>
          </div>
        );
      })}
    </aside>
  );
});
