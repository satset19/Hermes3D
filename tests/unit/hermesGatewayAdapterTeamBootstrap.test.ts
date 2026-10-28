// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const adapter: any = await import("../../server/hermes-gateway-adapter.js");
type TestAgent = { id: string; name: string; teamId?: string | null };

const {
  seedTeamItIfNeeded,
  DEFAULT_TEAM_IT_ID,
  DEFAULT_TEAM_IT_AGENT_IDS,
  teamRegistry,
  agentRegistry,
} = adapter;

describe("hermes-gateway-adapter Team IT bootstrap", () => {
  it("exports seedTeamItIfNeeded and constants", () => {
    expect(typeof seedTeamItIfNeeded).toBe("function");
    expect(DEFAULT_TEAM_IT_ID).toBe("team-it");
    expect(DEFAULT_TEAM_IT_AGENT_IDS).toEqual([
      "hermes",
      "maker-fd54ae",
      "captain-9860a1",
      "architect-8dc35f",
      "automator-e6fa33",
      "herald-c9d827",
      "tester-ac9ce4",
      "fe-specialist-1c1143",
      "backend-5f219b",
      "designer-1c1143",
    ]);
  });

  it("seeds Team IT and assigns the 10 stable agent IDs when team-it is absent", async () => {
    const customTeams = new Map();
    const customAgents = new Map<string, TestAgent>([
      ["hermes", { id: "hermes", name: "Hermes" }],
      ["maker-fd54ae", { id: "maker-fd54ae", name: "Maker" }],
      ["captain-9860a1", { id: "captain-9860a1", name: "Captain" }],
      ["architect-8dc35f", { id: "architect-8dc35f", name: "Architect" }],
      ["automator-e6fa33", { id: "automator-e6fa33", name: "Automator" }],
      ["herald-c9d827", { id: "herald-c9d827", name: "Herald" }],
      ["tester-ac9ce4", { id: "tester-ac9ce4", name: "Tester" }],
      ["fe-specialist-1c1143", { id: "fe-specialist-1c1143", name: "FE Specialist" }],
      ["backend-5f219b", { id: "backend-5f219b", name: "Backend" }],
      ["designer-1c1143", { id: "designer-1c1143", name: "Designer" }],
      ["other-agent", { id: "other-agent", name: "Other Agent" }],
    ]);

    const mockMongo = {
      upsertTeam: vi.fn(async () => ({ ok: 1 })),
      upsertAgentRecord: vi.fn(async () => ({ ok: 1 })),
    };
    const mockSaveTeams = vi.fn();
    const mockSaveAgents = vi.fn();

    const result = await seedTeamItIfNeeded({
      teamRegistry: customTeams,
      agentRegistry: customAgents,
      mongoDb: mockMongo,
      saveTeamsToDisk: mockSaveTeams,
      saveAgentsToDisk: mockSaveAgents,
    });

    expect(result.created).toBe(true);
    expect(result.team.id).toBe("team-it");
    expect(result.team.name).toBe("Team IT");
    expect(result.team.enabled).toBe(true);

    expect(customTeams.get("team-it")).toEqual(
      expect.objectContaining({
        id: "team-it",
        name: "Team IT",
        enabled: true,
      })
    );

    // All 10 stable agents should have teamId: "team-it"
    for (const aid of DEFAULT_TEAM_IT_AGENT_IDS) {
      expect(customAgents.get(aid)?.teamId).toBe("team-it");
    }
    // Other agent should not be modified
    expect(customAgents.get("other-agent")?.teamId).toBeUndefined();

    // Persisted to Mongo and disk
    expect(mockMongo.upsertTeam).toHaveBeenCalledWith(
      expect.objectContaining({ id: "team-it", name: "Team IT", enabled: true })
    );
    expect(mockMongo.upsertAgentRecord).toHaveBeenCalledTimes(10);
    expect(mockSaveTeams).toHaveBeenCalled();
    expect(mockSaveAgents).toHaveBeenCalled();
  });

  it("preserves pre-existing agent team assignment if an agent is already in another team on fresh seed", async () => {
    const customTeams = new Map();
    const customAgents = new Map<string, TestAgent>([
      ["hermes", { id: "hermes", name: "Hermes" }],
      ["fe-specialist-1c1143", { id: "fe-specialist-1c1143", name: "FE Specialist", teamId: "team-design" }],
      ["tester-ac9ce4", { id: "tester-ac9ce4", name: "Tester" }],
    ]);

    const mockMongo = {
      upsertTeam: vi.fn(async () => ({ ok: 1 })),
      upsertAgentRecord: vi.fn(async () => ({ ok: 1 })),
    };
    const mockSaveTeams = vi.fn();
    const mockSaveAgents = vi.fn();

    const result = await seedTeamItIfNeeded({
      teamRegistry: customTeams,
      agentRegistry: customAgents,
      mongoDb: mockMongo,
      saveTeamsToDisk: mockSaveTeams,
      saveAgentsToDisk: mockSaveAgents,
    });

    expect(result.created).toBe(true);
    expect(customAgents.get("hermes")?.teamId).toBe("team-it");
    expect(customAgents.get("tester-ac9ce4")?.teamId).toBe("team-it");
    // Pre-existing team-design assignment is preserved
    expect(customAgents.get("fe-specialist-1c1143")?.teamId).toBe("team-design");
    // Only hermes and tester-ac9ce4 were updated
    expect(mockMongo.upsertAgentRecord).toHaveBeenCalledTimes(2);
  });

  it("preserves disabled Team IT and existing memberships on subsequent startup", async () => {
    const customTeams = new Map([
      ["team-it", { id: "team-it", name: "Custom IT Team", enabled: false, createdAt: "2026-01-01T00:00:00.000Z" }],
    ]);
    const customAgents = new Map<string, TestAgent>([
      ["hermes", { id: "hermes", name: "Hermes", teamId: "team-it" }],
      // User unassigned tester-ac9ce4 or assigned to another team
      ["tester-ac9ce4", { id: "tester-ac9ce4", name: "Tester", teamId: null }],
      ["fe-specialist-1c1143", { id: "fe-specialist-1c1143", name: "FE Specialist", teamId: "team-design" }],
    ]);

    const mockMongo = {
      upsertTeam: vi.fn(),
      upsertAgentRecord: vi.fn(),
    };
    const mockSaveTeams = vi.fn();
    const mockSaveAgents = vi.fn();

    const result = await seedTeamItIfNeeded({
      teamRegistry: customTeams,
      agentRegistry: customAgents,
      mongoDb: mockMongo,
      saveTeamsToDisk: mockSaveTeams,
      saveAgentsToDisk: mockSaveAgents,
    });

    expect(result.created).toBe(false);
    expect(result.team.id).toBe("team-it");
    expect(result.team.name).toBe("Custom IT Team");
    expect(result.team.enabled).toBe(false);

    // Does not re-enable team-it
    expect(customTeams.get("team-it")?.enabled).toBe(false);

    // Does not overwrite agent memberships
    expect(customAgents.get("tester-ac9ce4")?.teamId).toBeNull();
    expect(customAgents.get("fe-specialist-1c1143")?.teamId).toBe("team-design");

    // Should NOT write to MongoDB or disk
    expect(mockMongo.upsertTeam).not.toHaveBeenCalled();
    expect(mockMongo.upsertAgentRecord).not.toHaveBeenCalled();
    expect(mockSaveTeams).not.toHaveBeenCalled();
    expect(mockSaveAgents).not.toHaveBeenCalled();
  });

  it("handles missing agents in registry gracefully during seed", async () => {
    const customTeams = new Map();
    // Only 2 of the 10 agents exist in registry
    const customAgents = new Map<string, TestAgent>([
      ["hermes", { id: "hermes", name: "Hermes" }],
      ["backend-5f219b", { id: "backend-5f219b", name: "Backend" }],
    ]);

    const mockMongo = {
      upsertTeam: vi.fn(async () => ({ ok: 1 })),
      upsertAgentRecord: vi.fn(async () => ({ ok: 1 })),
    };
    const mockSaveTeams = vi.fn();
    const mockSaveAgents = vi.fn();

    const result = await seedTeamItIfNeeded({
      teamRegistry: customTeams,
      agentRegistry: customAgents,
      mongoDb: mockMongo,
      saveTeamsToDisk: mockSaveTeams,
      saveAgentsToDisk: mockSaveAgents,
    });

    expect(result.created).toBe(true);
    expect(customAgents.get("hermes")?.teamId).toBe("team-it");
    expect(customAgents.get("backend-5f219b")?.teamId).toBe("team-it");
    expect(mockMongo.upsertAgentRecord).toHaveBeenCalledTimes(2);
  });

  it("works with default module-level registries when called without options", async () => {
    teamRegistry.clear();
    // Ensure hermes exists in module agentRegistry
    if (!agentRegistry.has("hermes")) {
      agentRegistry.set("hermes", { id: "hermes", name: "Hermes" });
    }
    const hermesAgent = agentRegistry.get("hermes");
    const origTeamId = hermesAgent.teamId;
    delete hermesAgent.teamId;

    const result = await seedTeamItIfNeeded();
    expect(result.created).toBe(true);
    expect(teamRegistry.has("team-it")).toBe(true);
    expect(teamRegistry.get("team-it")?.enabled).toBe(true);
    expect(agentRegistry.get("hermes")?.teamId).toBe("team-it");

    // Subsequent call is idempotent
    const subResult = await seedTeamItIfNeeded();
    expect(subResult.created).toBe(false);

    // If disabled on subsequent boots, stays disabled
    teamRegistry.get("team-it").enabled = false;
    const thirdResult = await seedTeamItIfNeeded();
    expect(thirdResult.created).toBe(false);
    expect(teamRegistry.get("team-it")?.enabled).toBe(false);

    // Restore state
    teamRegistry.get("team-it").enabled = true;
    if (origTeamId !== undefined) {
      hermesAgent.teamId = origTeamId;
    }
  });
});
