import type { AgentState, FocusFilter } from "@/features/agents/state/store";
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AgentAvatar } from "./AgentAvatar";
import {
  NEEDS_APPROVAL_BADGE_CLASS,
  resolveAgentStatusBadgeClass,
  resolveAgentStatusLabel,
} from "./colorSemantics";
import { EmptyStatePanel } from "./EmptyStatePanel";
import type { Team } from "@/features/teams/types";
import { useOptionalTeamStore } from "@/features/teams/store";

type FleetSidebarProps = {
  agents: AgentState[];
  selectedAgentId: string | null;
  filter: FocusFilter;
  onFilterChange: (next: FocusFilter) => void;
  onSelectAgent: (agentId: string) => void;
  onCreateAgent: () => void;
  createDisabled?: boolean;
  createBusy?: boolean;
  teams?: Team[];
  onToggleTeam?: (teamId: string, enabled: boolean) => void | Promise<void>;
  pendingTeamIds?: string[] | Set<string> | Record<string, boolean>;
  teamErrors?: Record<string, string | null>;
};

const FILTER_OPTIONS: Array<{ value: FocusFilter; label: string; testId: string }> = [
  { value: "all", label: "All", testId: "fleet-filter-all" },
  { value: "running", label: "Running", testId: "fleet-filter-running" },
  { value: "approvals", label: "Approvals", testId: "fleet-filter-approvals" },
];

export const FleetSidebar = ({
  agents,
  selectedAgentId,
  filter,
  onFilterChange,
  onSelectAgent,
  onCreateAgent,
  createDisabled = false,
  createBusy = false,
  teams: propsTeams,
  onToggleTeam,
  pendingTeamIds,
  teamErrors,
}: FleetSidebarProps) => {
  const teamContext = useOptionalTeamStore();
  const teams = propsTeams ?? teamContext?.state.teams ?? [];
  const updateTeam = teamContext?.updateTeam;

  const [internalPendingTeams, setInternalPendingTeams] = useState<Record<string, boolean>>({});
  const [internalTeamErrors, setInternalTeamErrors] = useState<Record<string, string | null>>({});

  const handleToggleTeam = useCallback(
    async (teamId: string, nextEnabled: boolean) => {
      setInternalTeamErrors((prev) => {
        if (!prev[teamId]) return prev;
        const next = { ...prev };
        delete next[teamId];
        return next;
      });
      try {
        const toggleResult = onToggleTeam?.(teamId, nextEnabled);
        if (toggleResult && typeof (toggleResult as Promise<void>).then === "function") {
          setInternalPendingTeams((prev) => ({ ...prev, [teamId]: true }));
          await toggleResult;
        }
        updateTeam?.(teamId, { enabled: nextEnabled });
      } catch (err: unknown) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to toggle team";
        setInternalTeamErrors((prev) => ({ ...prev, [teamId]: errorMessage }));
      } finally {
        setInternalPendingTeams((prev) => {
          if (!prev[teamId]) return prev;
          const next = { ...prev };
          delete next[teamId];
          return next;
        });
      }
    },
    [onToggleTeam, updateTeam]
  );

  const rowRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const previousTopByAgentIdRef = useRef<Map<string, number>>(new Map());
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  const { ungroupedAgents, groupedTeams } = useMemo(() => {
    if (teams.length === 0) {
      return { ungroupedAgents: agents, groupedTeams: [] };
    }
    const teamMap = new Map<string, { team: Team; agents: AgentState[] }>();
    for (const team of teams) {
      teamMap.set(team.id, { team, agents: [] });
    }
    const ungrouped: AgentState[] = [];
    for (const agent of agents) {
      if (agent.teamId && teamMap.has(agent.teamId)) {
        teamMap.get(agent.teamId)!.agents.push(agent);
      } else {
        ungrouped.push(agent);
      }
    }
    return {
      ungroupedAgents: ungrouped,
      groupedTeams: Array.from(teamMap.values()),
    };
  }, [agents, teams]);

  const agentOrderKey = useMemo(() => {
    const visibleIds: string[] = [];
    for (const a of ungroupedAgents) visibleIds.push(a.agentId);
    for (const g of groupedTeams) {
      if (g.team.enabled) {
        for (const a of g.agents) visibleIds.push(a.agentId);
      }
    }
    return visibleIds.join("|");
  }, [ungroupedAgents, groupedTeams]);

  const activeAgentsCount = useMemo(() => {
    let count = ungroupedAgents.length;
    for (const g of groupedTeams) {
      if (g.team.enabled) {
        count += g.agents.length;
      }
    }
    return count;
  }, [ungroupedAgents, groupedTeams]);

  useLayoutEffect(() => {
    const scroller = scrollContainerRef.current;
    if (!scroller) return;
    const scrollerRect = scroller.getBoundingClientRect();

    const getTopInScrollContent = (node: HTMLElement) =>
      node.getBoundingClientRect().top - scrollerRect.top + scroller.scrollTop;

    const nextTopByAgentId = new Map<string, number>();
    const agentIds = agentOrderKey.length === 0 ? [] : agentOrderKey.split("|");
    for (const agentId of agentIds) {
      const node = rowRefs.current.get(agentId);
      if (!node) continue;
      const nextTop = getTopInScrollContent(node);
      nextTopByAgentId.set(agentId, nextTop);
      const previousTop = previousTopByAgentIdRef.current.get(agentId);
      if (typeof previousTop !== "number") continue;
      const deltaY = previousTop - nextTop;
      if (Math.abs(deltaY) < 0.5) continue;
      if (typeof node.animate !== "function") continue;
      node.animate(
        [{ transform: `translateY(${deltaY}px)` }, { transform: "translateY(0px)" }],
        { duration: 300, easing: "cubic-bezier(0.22, 1, 0.36, 1)" }
      );
    }
    previousTopByAgentIdRef.current = nextTopByAgentId;
  }, [agentOrderKey]);

  const renderAgentRow = (agent: AgentState) => {
    const selected = selectedAgentId === agent.agentId;
    const avatarSeed = agent.avatarSeed ?? agent.agentId;
    return (
      <button
        key={agent.agentId}
        ref={(node) => {
          if (node) {
            rowRefs.current.set(agent.agentId, node);
            return;
          }
          rowRefs.current.delete(agent.agentId);
        }}
        type="button"
        data-testid={`fleet-agent-row-${agent.agentId}`}
        aria-label={`Select agent: ${agent.name}`}
        aria-pressed={selected}
        className={`group relative ui-card flex w-full items-center gap-3 overflow-hidden border px-3 py-3 text-left transition-colors ${
          selected
            ? "ui-card-selected"
            : "hover:bg-surface-2/45"
        }`}
        onClick={() => onSelectAgent(agent.agentId)}
      >
        <span
          aria-hidden="true"
          className={`ui-card-select-indicator ${selected ? "opacity-100" : "opacity-0 group-hover:opacity-35"}`}
        />
        <AgentAvatar
          seed={avatarSeed}
          name={agent.name}
          avatarUrl={agent.avatarUrl ?? null}
          size={42}
          isSelected={selected}
        />
        <div className="min-w-0 flex-1">
          <p className="type-secondary-heading truncate text-foreground">
            {agent.name}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <span
              className={`ui-badge ${resolveAgentStatusBadgeClass(agent.status)}`}
              data-status={agent.status}
            >
              {resolveAgentStatusLabel(agent.status)}
            </span>
            {agent.awaitingUserInput ? (
              <span className={`ui-badge ${NEEDS_APPROVAL_BADGE_CLASS}`} data-status="approval">
                Needs approval
              </span>
            ) : null}
          </div>
        </div>
      </button>
    );
  };

  return (
    <aside
      className="glass-panel fade-up-delay ui-panel ui-depth-sidepanel relative flex h-full w-full min-w-72 flex-col gap-3 bg-sidebar p-3 xl:max-w-[320px] xl:border-r xl:border-sidebar-border"
      data-testid="fleet-sidebar"
    >
      <div className="flex items-center justify-between gap-2 px-1">
        <p className="console-title type-page-title text-foreground">Agents ({activeAgentsCount})</p>
        <button
          type="button"
          data-testid="fleet-new-agent-button"
          className="ui-btn-primary px-3 py-2 font-mono text-[12px] font-medium tracking-[0.02em] disabled:cursor-not-allowed disabled:border-border disabled:bg-muted disabled:text-muted-foreground"
          onClick={onCreateAgent}
          disabled={createDisabled || createBusy}
        >
          {createBusy ? "Creating..." : "New agent"}
        </button>
      </div>

      <div className="ui-segment ui-segment-fleet-filter grid-cols-3">
        {FILTER_OPTIONS.map((option) => {
          const active = filter === option.value;
          return (
            <button
              key={option.value}
              type="button"
              data-testid={option.testId}
              aria-pressed={active}
              className="ui-segment-item px-2 py-1 font-mono text-[12px] font-medium tracking-[0.02em]"
              data-active={active ? "true" : "false"}
              onClick={() => onFilterChange(option.value)}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      <div ref={scrollContainerRef} className="ui-scroll min-h-0 flex-1 overflow-auto">
        {agents.length === 0 ? (
          <EmptyStatePanel title="No agents available." compact className="p-3 text-xs" />
        ) : (
          <div className="flex flex-col gap-3">
            {ungroupedAgents.length > 0 && (
              <div className="flex flex-col gap-1.5" data-testid="fleet-ungrouped-agents">
                {groupedTeams.length > 0 && (
                  <div className="flex items-center justify-between px-1 py-1">
                    <span className="font-mono text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                      Ungrouped ({ungroupedAgents.length})
                    </span>
                  </div>
                )}
                <div className="flex flex-col gap-2.5">
                  {ungroupedAgents.map(renderAgentRow)}
                </div>
              </div>
            )}

            {groupedTeams.map((group) => {
              const isPending = Boolean(
                (Array.isArray(pendingTeamIds)
                  ? pendingTeamIds.includes(group.team.id)
                  : pendingTeamIds instanceof Set
                  ? pendingTeamIds.has(group.team.id)
                  : pendingTeamIds?.[group.team.id]) ||
                internalPendingTeams[group.team.id]
              );
              const teamError = teamErrors?.[group.team.id] ?? internalTeamErrors[group.team.id] ?? null;
              const hasError = Boolean(teamError);

              return (
                <div
                  key={group.team.id}
                  className="flex flex-col gap-1.5"
                  data-testid={`fleet-team-section-${group.team.id}`}
                >
                  <div className="flex items-center justify-between px-1 py-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="font-mono text-[11px] font-semibold tracking-wide text-foreground uppercase truncate">
                        {group.team.name}
                      </span>
                      <span
                        className="font-mono text-[10px] text-muted-foreground"
                        data-testid={`team-active-count-${group.team.id}`}
                        data-active-count={group.team.enabled ? group.agents.length : 0}
                        data-total-count={group.agents.length}
                        aria-label={`${group.team.enabled ? group.agents.length : 0} of ${group.agents.length} members active`}
                      >
                        ({group.team.enabled ? group.agents.length : `0/${group.agents.length}`})
                      </span>
                      {isPending ? (
                        <>
                          <span
                            className="font-mono text-[9px] text-muted-foreground animate-pulse"
                            data-testid={`team-pending-${group.team.id}`}
                          >
                            Updating...
                          </span>
                          <span className="sr-only" role="status" aria-live="polite">
                            Updating {group.team.name}
                          </span>
                        </>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-label={`Toggle ${group.team.name}`}
                      aria-checked={Boolean(group.team.enabled)}
                      aria-busy={isPending ? "true" : undefined}
                      aria-invalid={hasError ? "true" : undefined}
                      aria-errormessage={hasError ? `team-error-${group.team.id}` : undefined}
                      disabled={isPending}
                      data-testid={`team-toggle-${group.team.id}`}
                      className={`ui-switch ${group.team.enabled ? "ui-switch--on" : ""} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar ${
                        isPending ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!isPending) {
                          void handleToggleTeam(group.team.id, !group.team.enabled);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === " " || e.key === "Enter") {
                          e.preventDefault();
                          e.stopPropagation();
                          if (!isPending) {
                            void handleToggleTeam(group.team.id, !group.team.enabled);
                          }
                        }
                      }}
                    >
                      <span className="ui-switch-thumb" />
                    </button>
                  </div>
                  {hasError && teamError ? (
                    <div
                      id={`team-error-${group.team.id}`}
                      role="alert"
                      data-testid={`team-error-${group.team.id}`}
                      className="ui-text-danger px-1 text-[11px] font-mono leading-tight"
                    >
                      {teamError}
                    </div>
                  ) : null}
                  {group.team.enabled ? (
                    <div className="flex flex-col gap-2.5">
                      {group.agents.map(renderAgentRow)}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
};
