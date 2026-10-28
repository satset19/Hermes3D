import { describe, expect, it } from "vitest";

const { handleMethod } = await import("../../server/demo-gateway-adapter.js");

describe("demo-gateway-adapter", () => {
  it("rejects_unsupported_cron_mutations", async () => {
    await expect(handleMethod("cron.add", {}, "1", () => {})).resolves.toMatchObject({
      type: "res",
      id: "1",
      ok: false,
      error: {
        code: "unsupported_method",
      },
    });

    await expect(handleMethod("cron.run", {}, "2", () => {})).resolves.toMatchObject({
      type: "res",
      id: "2",
      ok: false,
      error: {
        code: "unsupported_method",
      },
    });

    await expect(handleMethod("cron.remove", {}, "3", () => {})).resolves.toMatchObject({
      type: "res",
      id: "3",
      ok: false,
      error: {
        code: "unsupported_method",
      },
    });
  });

  it("returns_all_expected_demo_agents", async () => {
    const res = await handleMethod("agents.list", {}, "4", () => {});
    expect(res).toMatchObject({
      type: "res",
      id: "4",
      ok: true,
      payload: {
        defaultId: "demo-orchestrator",
        mainKey: "main",
        agents: expect.arrayContaining([
          expect.objectContaining({ id: "demo-orchestrator", role: "Orchestrator" }),
          expect.objectContaining({ id: "demo-fe-specialist", role: "Frontend Specialist" }),
          expect.objectContaining({ id: "demo-backend", role: "Backend Developer" }),
          expect.objectContaining({ id: "demo-architect", role: "Systems Architect" }),
        ]),
      },
    });
  });

  it("returns teams and teamId in agents.list", async () => {
    const res = await handleMethod("agents.list", {}, "list-1", () => {});
    expect(res).toMatchObject({
      type: "res",
      id: "list-1",
      ok: true,
      payload: {
        teams: expect.any(Array),
        agents: expect.arrayContaining([
          expect.objectContaining({
            id: "demo-orchestrator",
            teamId: null,
          }),
        ]),
      },
    });
  });

  it("supports team creation, listing, updating, and toggling", async () => {
    const createRes = await handleMethod(
      "teams.create",
      { id: "team-eng", name: "Engineering", enabled: true },
      "team-1",
      () => {}
    );
    expect(createRes).toMatchObject({
      type: "res",
      id: "team-1",
      ok: true,
      payload: {
        team: { id: "team-eng", name: "Engineering", enabled: true },
      },
    });

    const listRes = await handleMethod("teams.list", {}, "team-2", () => {});
    expect(listRes).toMatchObject({
      type: "res",
      id: "team-2",
      ok: true,
      payload: {
        teams: expect.arrayContaining([
          expect.objectContaining({ id: "team-eng", name: "Engineering", enabled: true }),
        ]),
      },
    });

    const toggleRes = await handleMethod(
      "teams.toggle",
      { teamId: "team-eng", enabled: false },
      "team-3",
      () => {}
    );
    expect(toggleRes).toMatchObject({
      type: "res",
      id: "team-3",
      ok: true,
      payload: {
        team: expect.objectContaining({ id: "team-eng", enabled: false }),
      },
    });

    const toggleBackRes = await handleMethod(
      "teams.toggle",
      { teamId: "team-eng" },
      "team-4",
      () => {}
    );
    expect(toggleBackRes).toMatchObject({
      type: "res",
      id: "team-4",
      ok: true,
      payload: {
        team: expect.objectContaining({ id: "team-eng", enabled: true }),
      },
    });
  });

  it("blocks chat.send for members of a disabled team", async () => {
    await handleMethod(
      "teams.create",
      { id: "team-frontend", name: "Frontend", enabled: true },
      "t-create",
      () => {}
    );

    await handleMethod(
      "agents.update",
      { agentId: "demo-fe-specialist", teamId: "team-frontend" },
      "a-update",
      () => {}
    );

    const agentsRes = await handleMethod("agents.list", {}, "a-list", () => {});
    expect((agentsRes as any).payload.agents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "demo-fe-specialist", teamId: "team-frontend" }),
      ])
    );

    const sendAllowed = await handleMethod(
      "chat.send",
      { sessionKey: "agent:demo-fe-specialist:main", message: "Hello Kai" },
      "chat-1",
      () => {}
    );
    expect(sendAllowed).toMatchObject({
      type: "res",
      id: "chat-1",
      ok: true,
      payload: { status: "started" },
    });

    await handleMethod(
      "teams.toggle",
      { teamId: "team-frontend", enabled: false },
      "t-toggle",
      () => {}
    );

    const sendBlocked = await handleMethod(
      "chat.send",
      { sessionKey: "agent:demo-fe-specialist:main", message: "Are you there?" },
      "chat-2",
      () => {}
    );
    expect(sendBlocked).toMatchObject({
      type: "res",
      id: "chat-2",
      ok: false,
      error: {
        code: "team_disabled",
        message: expect.stringContaining("disabled team"),
      },
    });

    const sendOrch = await handleMethod(
      "chat.send",
      { sessionKey: "agent:demo-orchestrator:main", message: "Status check" },
      "chat-3",
      () => {}
    );
    expect(sendOrch).toMatchObject({
      type: "res",
      id: "chat-3",
      ok: true,
      payload: { status: "started" },
    });

    await handleMethod(
      "teams.toggle",
      { teamId: "team-frontend", enabled: true },
      "t-reenable",
      () => {}
    );
    const sendAllowedAgain = await handleMethod(
      "chat.send",
      { sessionKey: "agent:demo-fe-specialist:main", message: "Welcome back" },
      "chat-4",
      () => {}
    );
    expect(sendAllowedAgain).toMatchObject({
      type: "res",
      id: "chat-4",
      ok: true,
      payload: { status: "started" },
    });
  });

  it("handles team deletion and unknown team errors", async () => {
    const notFoundRes = await handleMethod(
      "teams.toggle",
      { teamId: "team-non-existent" },
      "err-1",
      () => {}
    );
    expect(notFoundRes).toMatchObject({
      type: "res",
      id: "err-1",
      ok: false,
      error: { code: "not_found" },
    });

    await handleMethod(
      "teams.create",
      { id: "team-to-delete", name: "Temp Team", enabled: true },
      "td-1",
      () => {}
    );
    await handleMethod(
      "agents.update",
      { agentId: "demo-backend", teamId: "team-to-delete" },
      "td-2",
      () => {}
    );

    const delRes = await handleMethod(
      "teams.delete",
      { teamId: "team-to-delete" },
      "td-3",
      () => {}
    );
    expect(delRes).toMatchObject({
      type: "res",
      id: "td-3",
      ok: true,
    });

    const checkAgent = await handleMethod("agents.list", {}, "td-4", () => {});
    const backendAgent = (checkAgent as any).payload.agents.find((a: any) => a.id === "demo-backend");
    expect(backendAgent?.teamId).toBeNull();
  });
});
