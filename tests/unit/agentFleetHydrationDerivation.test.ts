import { describe, expect, it, vi } from "vitest";

import {
  deriveHydrateAgentFleetResult,
  normalizeTeams,
} from "@/features/agents/operations/agentFleetHydrationDerivation";
import { hydrateAgentFleetFromGateway } from "@/features/agents/operations/agentFleetHydration";
import { createDefaultAgentAvatarProfile } from "@/lib/avatars/profile";
import { defaultStudioSettings, type StudioSettings } from "@/lib/studio/settings";
import type { Team } from "@/features/teams/types";

describe("deriveHydrateAgentFleetResult", () => {
  it("derives_seeds_and_sync_sets_from_snapshots", () => {
    const gatewayUrl = "ws://localhost:18789";

    const settings: StudioSettings = {
      ...defaultStudioSettings(),
      avatars: {
        [gatewayUrl]: {
          "agent-1": createDefaultAgentAvatarProfile("persisted-seed"),
        },
      },
    };

    const result = deriveHydrateAgentFleetResult({
      gatewayUrl,
      configSnapshot: {
        config: {
          agents: {
            defaults: {
              model: "openai/gpt-5",
            },
            list: [],
          },
        },
      },
      settings,
      execApprovalsSnapshot: {
        file: {
          agents: {
            "agent-1": { security: "allowlist", ask: "always" },
            "agent-2": { security: "full", ask: "off" },
          },
        },
      },
      agentsResult: {
        defaultId: "agent-1",
        mainKey: "main",
        agents: [
          {
            id: "agent-1",
            name: "One",
            identity: { avatarUrl: "https://example.com/one.png" },
          },
          {
            id: "agent-2",
            name: "Two",
            identity: { avatarUrl: "https://example.com/two.png" },
          },
        ],
      },
      mainSessionByAgentId: new Map([
        [
          "agent-1",
          {
            key: "agent:agent-1:main",
            updatedAt: 1,
            displayName: "Main",
            thinkingLevel: "medium",
            modelProvider: "openai",
            model: "gpt-4.1",
          },
        ],
        [
          "agent-2",
          {
            key: "agent:agent-2:main",
            updatedAt: 1,
            displayName: "Main",
            thinkingLevel: "medium",
            modelProvider: "openai",
            model: "gpt-5",
          },
        ],
      ]),
      statusSummary: null,
      previewResult: null,
    });

    expect(result.seeds).toHaveLength(2);
    expect(result.seeds[0]).toEqual(
      expect.objectContaining({
        agentId: "agent-1",
        name: "One",
        runtimeName: "One",
        identityName: null,
        sessionDisplayName: "Main",
        sessionKey: "agent:agent-1:main",
        avatarSeed: "persisted-seed",
        avatarProfile: expect.objectContaining({ seed: "persisted-seed" }),
        avatarUrl: "https://example.com/one.png",
        model: "openai/gpt-4.1",
        thinkingLevel: "medium",
        sessionExecHost: "gateway",
        sessionExecSecurity: "allowlist",
        sessionExecAsk: "always",
      })
    );
    expect(result.seeds[1]).toEqual(
      expect.objectContaining({
        agentId: "agent-2",
        sessionExecHost: "gateway",
        sessionExecSecurity: "full",
        sessionExecAsk: "off",
      })
    );
    expect(result.sessionCreatedAgentIds).toEqual(["agent-1", "agent-2"]);
    expect(result.sessionSettingsSyncedAgentIds).toEqual([]);
    expect(result.suggestedSelectedAgentId).toBe(null);
    expect(result.summaryPatches).toEqual([]);
  });

  it("derives_summary_patches_and_suggested_agent_when_preview_present", () => {
    const gatewayUrl = "ws://127.0.0.1:18789";

    const result = deriveHydrateAgentFleetResult({
      gatewayUrl,
      configSnapshot: null,
      settings: null,
      execApprovalsSnapshot: null,
      agentsResult: {
        defaultId: "agent-1",
        mainKey: "main",
        agents: [
          { id: "agent-1", name: "One", identity: {} },
          { id: "agent-2", name: "Two", identity: {} },
        ],
      },
      mainSessionByAgentId: new Map([
        ["agent-1", { key: "agent:agent-1:main" }],
        ["agent-2", { key: "agent:agent-2:main" }],
      ]),
      statusSummary: {
        sessions: {
          recent: [],
          byAgent: [],
        },
      },
      previewResult: {
        ts: 1,
        previews: [
          {
            key: "agent:agent-1:main",
            status: "ok",
            items: [
              { role: "assistant", text: "one", timestamp: "2026-02-10T00:00:00Z" },
            ],
          },
          {
            key: "agent:agent-2:main",
            status: "ok",
            items: [
              { role: "assistant", text: "two", timestamp: "2026-02-10T01:00:00Z" },
            ],
          },
        ],
      },
    });

    expect(result.summaryPatches.length).toBeGreaterThan(0);
    expect(result.suggestedSelectedAgentId).toBe("agent-2");
  });

  it("propagates teamId to seeds and normalizes teams payload from agentsResult", () => {
    const rawTeams = [
      { id: "team-it", name: "Team IT", enabled: true, createdAt: "2026-10-28T00:00:00Z" },
      { id: "team-ops", name: "Operations", enabled: false },
      { id: "invalid-missing-name", name: "" },
      null,
    ];

    const result = deriveHydrateAgentFleetResult({
      gatewayUrl: "ws://localhost:18789",
      configSnapshot: null,
      settings: null,
      execApprovalsSnapshot: null,
      agentsResult: {
        defaultId: "agent-1",
        mainKey: "main",
        teams: rawTeams as unknown as Team[],
        agents: [
          { id: "agent-1", name: "One", teamId: "team-it" },
          { id: "agent-2", name: "Two", teamId: "  team-ops  " },
          { id: "agent-3", name: "Three", teamId: null },
          { id: "agent-4", name: "Four", teamId: "" },
          { id: "agent-5", name: "Five" },
        ],
      },
      mainSessionByAgentId: new Map(),
      statusSummary: null,
      previewResult: null,
    });

    expect(result.seeds.map((s) => ({ id: s.agentId, teamId: s.teamId }))).toEqual([
      { id: "agent-1", teamId: "team-it" },
      { id: "agent-2", teamId: "team-ops" },
      { id: "agent-3", teamId: null },
      { id: "agent-4", teamId: null },
      { id: "agent-5", teamId: null },
    ]);

    expect(result.teams).toEqual([
      { id: "team-it", name: "Team IT", enabled: true, createdAt: "2026-10-28T00:00:00Z" },
      { id: "team-ops", name: "Operations", enabled: false },
    ]);
  });

  it("prioritizes direct input.teams over agentsResult.teams and handles empty teams", () => {
    const resultWithDirect = deriveHydrateAgentFleetResult({
      gatewayUrl: "ws://localhost:18789",
      configSnapshot: null,
      settings: null,
      execApprovalsSnapshot: null,
      teams: [{ id: "override-team", name: "Override", enabled: true }],
      agentsResult: {
        defaultId: "agent-1",
        mainKey: "main",
        teams: [{ id: "original-team", name: "Original", enabled: false }],
        agents: [{ id: "agent-1", name: "One", teamId: "override-team" }],
      },
      mainSessionByAgentId: new Map(),
      statusSummary: null,
      previewResult: null,
    });
    expect(resultWithDirect.teams).toEqual([
      { id: "override-team", name: "Override", enabled: true },
    ]);

    const resultEmpty = deriveHydrateAgentFleetResult({
      gatewayUrl: "ws://localhost:18789",
      configSnapshot: null,
      settings: null,
      execApprovalsSnapshot: null,
      agentsResult: {
        defaultId: "agent-1",
        mainKey: "main",
        teams: [],
        agents: [{ id: "agent-1", name: "One" }],
      },
      mainSessionByAgentId: new Map(),
      statusSummary: null,
      previewResult: null,
    });
    expect(resultEmpty.teams).toEqual([]);

    const resultUndefined = deriveHydrateAgentFleetResult({
      gatewayUrl: "ws://localhost:18789",
      configSnapshot: null,
      settings: null,
      execApprovalsSnapshot: null,
      agentsResult: {
        defaultId: "agent-1",
        mainKey: "main",
        agents: [{ id: "agent-1", name: "One" }],
      },
      mainSessionByAgentId: new Map(),
      statusSummary: null,
      previewResult: null,
    });
    expect(resultUndefined.teams).toBeUndefined();
  });

  it("hydrateAgentFleetFromGateway propagates teamId and teams from gateway agents.list", async () => {
    const call = vi.fn(async (method: string) => {
      if (method === "config.get") return { hash: "h", config: { agents: { defaults: {}, list: [] } } };
      if (method === "exec.approvals.get") return { file: { agents: {} } };
      if (method === "agents.list") {
        return {
          defaultId: "agent-1",
          mainKey: "main",
          teams: [{ id: "team-it", name: "Team IT", enabled: true }],
          agents: [
            { id: "agent-1", name: "Agent 1", teamId: "team-it" },
            { id: "agent-2", name: "Agent 2", teamId: null },
          ],
        };
      }
      if (method === "sessions.list") return { sessions: [] };
      throw new Error(`Unhandled method: ${method}`);
    });

    const result = await hydrateAgentFleetFromGateway({
      client: { call },
      gatewayUrl: "ws://127.0.0.1:18789",
      cachedConfigSnapshot: null,
      loadStudioSettings: async () => null,
      isDisconnectLikeError: () => false,
    });

    expect(result.teams).toEqual([{ id: "team-it", name: "Team IT", enabled: true }]);
    expect(result.seeds[0].teamId).toBe("team-it");
    expect(result.seeds[1].teamId).toBeNull();
  });

  it("hydrateAgentFleetFromGateway propagates teamId and teams from hello snapshot fallback", async () => {
    const call = vi.fn(async (method: string) => {
      if (method === "config.get") return { hash: "h", config: { agents: { defaults: {}, list: [] } } };
      if (method === "exec.approvals.get") return { file: { agents: {} } };
      if (method === "agents.list") {
        throw new Error("agents.list unavailable");
      }
      if (method === "sessions.list") return { sessions: [] };
      throw new Error(`Unhandled method: ${method}`);
    });

    const getLastHello = vi.fn(() => ({
      snapshot: {
        health: {
          agents: [
            { agentId: "agent-hello-1", name: "Hello Agent", teamId: "team-hello" },
            { agentId: "agent-hello-2", name: "Solo Agent", teamId: null },
          ],
          defaultAgentId: "agent-hello-1",
          teams: [{ id: "team-hello", name: "Hello Team", enabled: false }],
        },
        sessionDefaults: { mainKey: "main" },
      },
    }));

    const result = await hydrateAgentFleetFromGateway({
      client: { call, getLastHello },
      gatewayUrl: "ws://127.0.0.1:18789",
      cachedConfigSnapshot: null,
      loadStudioSettings: async () => null,
      isDisconnectLikeError: () => false,
    });

    expect(result.teams).toEqual([{ id: "team-hello", name: "Hello Team", enabled: false }]);
    expect(result.seeds[0].agentId).toBe("agent-hello-1");
    expect(result.seeds[0].teamId).toBe("team-hello");
    expect(result.seeds[1].agentId).toBe("agent-hello-2");
    expect(result.seeds[1].teamId).toBeNull();
  });
});
