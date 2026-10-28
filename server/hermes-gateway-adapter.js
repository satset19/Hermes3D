"use strict";

/**
 * Hermes Gateway Adapter — with multi-agent orchestration
 *
 * The main Hermes agent acts as an orchestrator and can:
 *   - spawn_agent(name, role, instructions, wipe, continuity, boundaries)
 *   - delegate_task(agent_id, message)
 *   - list_team()
 *   - configure_agent(agent_id, ...)
 *   - dismiss_agent(agent_id)
 *
 * Sub-agents appear as 3D characters in the office, each with their own
 * conversation history, system prompt, and settings.
 *
 * Environment variables:
 *   HERMES_API_URL        Hermes HTTP API base URL   (default: http://localhost:8642)
 *   HERMES_API_KEY        Bearer token for Hermes     (default: empty)
 *   HERMES_ADAPTER_PORT   WebSocket port              (default: 18789)
 *   HERMES_MODEL          Model identifier            (default: hermes)
 *   HERMES_AGENT_NAME     Display name in Hermes3D UI   (default: Hermes)
 */

const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");
const { WebSocketServer } = require("ws");
const { buildTeamToolGuide, createTeamManager, createTeamHttpHandler } = require("./hermes3d-team");
const { createRunAgentTurn, closeDanglingTurns } = require("./hermes3d-team-turn");
const mongoDb = require("./db/mongo");

function loadDotenvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key] !== undefined) continue;
    let value = rawValue.trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

function loadRuntimeEnv() {
  const cwd = process.cwd();
  loadDotenvFile(path.join(cwd, ".env.local"));
  loadDotenvFile(path.join(cwd, ".env"));
  loadDotenvFile(path.join(cwd, ".env.hermes"));
}

loadRuntimeEnv();

const HERMES_API_URL = (process.env.HERMES_API_URL || "http://localhost:8642").replace(/\/$/, "");
const HERMES_API_KEY = process.env.HERMES_API_KEY || "";
const ADAPTER_PORT = parseInt(process.env.HERMES_ADAPTER_PORT || "18789", 10);
const HERMES_MODEL = process.env.HERMES_MODEL || "hermes";
const HERMES_AGENT_NAME = process.env.HERMES_AGENT_NAME || "Hermes";
const HERMES3D_TEAM_TOKEN = process.env.HERMES3D_TEAM_TOKEN || "";
const HOME = process.env.HOME || "/tmp";

const AGENT_ID = "hermes";
const MAIN_KEY = "main";
const MAIN_SESSION_KEY = `agent:${AGENT_ID}:${MAIN_KEY}`;
const CONFIG_PATH = `${HOME}/.hermes/config.json`;
const MAX_TOOL_ROUNDS = 8;
const CHAT_STREAM_THROTTLE_MS = 50;

/**
 * Throttle streaming delta text emissions to client WebSocket connections.
 * Emits leading delta immediately, buffers intermediate chunks up to intervalMs (50ms),
 * and supports instant flush / cancellation for clean final frame delivery.
 */
function createThrottledDeltaEmitter(emitFn, intervalMs = CHAT_STREAM_THROTTLE_MS) {
  let timer = null;
  let lastSentTime = 0;
  let pendingText = null;

  const emit = (text) => {
    pendingText = text;
    const now = Date.now();
    const elapsed = now - lastSentTime;

    if (elapsed >= intervalMs) {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      lastSentTime = now;
      pendingText = null;
      emitFn(text);
    } else if (!timer) {
      timer = setTimeout(() => {
        timer = null;
        if (pendingText !== null) {
          const buffered = pendingText;
          pendingText = null;
          lastSentTime = Date.now();
          try {
            emitFn(buffered);
          } catch (err) {
            console.error("[hermes-adapter] Throttled delta emit error:", sanitizeErrorMessage(err));
          }
        }
      }, intervalMs - elapsed);
    }
  };

  emit.flush = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    if (pendingText !== null) {
      const buffered = pendingText;
      pendingText = null;
      lastSentTime = Date.now();
      emitFn(buffered);
    }
  };

  emit.cancel = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    pendingText = null;
  };

  return emit;
}

// ---------------------------------------------------------------------------
// Orchestrator system prompt
// ---------------------------------------------------------------------------

const ORCHESTRATOR_SYSTEM_PROMPT = `You are ${HERMES_AGENT_NAME}, an AI orchestrator managing a team of sub-agents in a virtual 3D office.

You have tools to build and manage your team autonomously:

- **spawn_agent**: Create a new specialist agent with a name, role, instructions, and settings (wipe/continuity/boundaries).
- **delegate_task**: Send a task to a specific agent and receive their response.
- **list_team**: See all current team members and their IDs, names, and roles.
- **configure_agent**: Update an agent's name, role/title, instructions, or settings.
- **dismiss_agent**: Remove an agent from the team.
- **read_agent_context**: Read the recent conversation history of another agent to understand what they are currently working on, what they have already done, or what their status is. Use this for coordination — before delegating a task, check if the agent already has relevant context.
- **subagent_spawn**: Spawn up to 10 subagents in parallel to perform in-depth research, specialized analysis, or execution on complex subtasks.

When given a goal:
1. Analyse what specialist roles are needed.
2. spawn_agent for each specialist.
3. delegate_task to assign work and coordinate.
4. Use read_agent_context to check what an agent has done or is doing before re-delegating.
5. Synthesise results into a final answer for the user.

Each spawned agent will appear as an animated character in the 3D office — walking when active, standing when idle.
Be concise in your responses to the user; do the heavy lifting via tool calls.`;

// ---------------------------------------------------------------------------
// Team management tools definition (OpenAI tool-calling format)
// ---------------------------------------------------------------------------

const SUBAGENT_SPAWN_TOOL = {
  type: "function",
  function: {
    name: "subagent_spawn",
    description: "Spawn up to 10 sub-agents in parallel to perform in-depth research, specialized analysis, or task execution. Returns consolidated findings.",
    parameters: {
      type: "object",
      required: ["tasks"],
      properties: {
        tasks: {
          type: "array",
          description: "List of research or execution tasks for sub-agents (maximum 10).",
          items: {
            type: "object",
            required: ["goal"],
            properties: {
              name: { type: "string", description: "Role or specialty of the sub-agent (e.g. 'Security Analyst', 'Performance Researcher')" },
              goal: { type: "string", description: "Specific research question, analysis objective, or task instructions" },
              context: { type: "string", description: "Background context, technical specs, or constraints" },
            },
          },
        },
      },
    },
  },
};

const TEAM_TOOLS = [
  SUBAGENT_SPAWN_TOOL,
  {
    type: "function",
    function: {
      name: "spawn_agent",
      description: "Create a new sub-agent team member. Returns the agent's ID.",
      parameters: {
        type: "object",
        required: ["name", "role"],
        properties: {
          name: { type: "string", description: "Display name, e.g. 'Backend Dev'" },
          role: { type: "string", description: "Short role description, e.g. 'Python backend specialist'" },
          instructions: { type: "string", description: "System prompt / instructions for this agent" },
          wipe: { type: "boolean", description: "Clear history before each run (stateless). Default false." },
          continuity: { type: "boolean", description: "Maintain full conversation history. Default true." },
          boundaries: { type: "string", description: "Hard constraints on what this agent may do" },
          model: { type: "string", description: "Model to use. Defaults to hermes." },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delegate_task",
      description: "Send a task or question to a specific team member and get their response.",
      parameters: {
        type: "object",
        required: ["agent_id", "message"],
        properties: {
          agent_id: { type: "string", description: "ID returned by spawn_agent" },
          message: { type: "string", description: "The task, question, or instructions to send" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_team",
      description: "List all current team members with their IDs, names, and roles.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "configure_agent",
      description: "Update an existing agent's name, role/title, instructions, or settings.",
      parameters: {
        type: "object",
        required: ["agent_id"],
        properties: {
          agent_id: { type: "string" },
          name: { type: "string" },
          role: { type: "string", description: "Short role or title shown as subtitle below the agent name in the office (e.g. 'Marketing Chef', 'Code Reviewer')." },
          instructions: { type: "string" },
          wipe: { type: "boolean" },
          continuity: { type: "boolean" },
          boundaries: { type: "string" },
          model: { type: "string" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "dismiss_agent",
      description: "Remove an agent from the team.",
      parameters: {
        type: "object",
        required: ["agent_id"],
        properties: {
          agent_id: { type: "string" },
          reason: { type: "string" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "read_agent_context",
      description: "Read the recent conversation history of another agent to understand what they are working on, what they have already done, or what their current status is. Useful for coordination and avoiding duplicate work.",
      parameters: {
        type: "object",
        required: ["agent_id"],
        properties: {
          agent_id: { type: "string", description: "ID of the agent whose context you want to read" },
          last_n: { type: "number", description: "How many recent messages to return (default 10, max 40)" },
        },
      },
    },
  },
];

const SPECIALIST_TOOLS = [
  SUBAGENT_SPAWN_TOOL,
  TEAM_TOOLS.find((t) => t.function.name === "delegate_task"),
  TEAM_TOOLS.find((t) => t.function.name === "read_agent_context"),
  TEAM_TOOLS.find((t) => t.function.name === "list_team"),
].filter(Boolean);

// ---------------------------------------------------------------------------
// In-memory state
// ---------------------------------------------------------------------------

/** @type {Map<string, Array<{role: string, content: string}>>} */
const conversationHistory = new Map();

/** @type {Map<string, {model?: string, thinkingLevel?: string}>} */
const sessionSettings = new Map();

/** @type {Map<string, string>} agentId/filename → content */
const agentFiles = new Map();

/** @type {Map<string, {runId: string, sessionKey: string, agentId: string, abort: () => void}>} runId → abort handle */
const activeRuns = new Map();

/** @type {Map<string, object>} jobId → CronJobSummary */
const cronJobs = new Map();

/**
 * @type {Map<string, {
 *   id: string, name: string, workspace: string,
 *   role?: string, systemPrompt?: string,
 *   settings: { wipe: boolean, continuity: boolean, model: string, boundaries?: string }
 * }>}
 */
const agentRegistry = new Map([
  [AGENT_ID, {
    id: AGENT_ID,
    name: HERMES_AGENT_NAME,
    workspace: `${HOME}/.hermes/workspace-${AGENT_ID}`,
    role: "Orchestrator",
    systemPrompt: ORCHESTRATOR_SYSTEM_PROMPT,
    settings: { wipe: false, continuity: true, model: HERMES_MODEL, mode: "yolo", yolo: true },
  }],
]);

const { AgentSimulationEngine } = require("./agent-simulation");
const agentSimulation = new AgentSimulationEngine();
const defaultOfficeMap = {
  workspaceId: "default",
  officeVersionId: "1",
  canvas: { width: 800, height: 600 },
  zones: [
    { type: "desk_zone", shape: { points: [{ x: 150, y: 150 }] } },
    { type: "meeting_room", shape: { points: [{ x: 400, y: 300 }] } },
    { type: "hallway", shape: { points: [{ x: 300, y: 200 }] } },
  ],
  objects: [],
};

function buildPresencePayload(extraSessions = {}) {
  const disabledTeamIds = new Set(
    [...teamRegistry.values()].filter((t) => !t.enabled).map((t) => t.id)
  );
  const agentsArray = [...agentRegistry.values()]
    .filter((a) => !a.teamId || !disabledTeamIds.has(a.teamId))
    .map((a) => ({
      agentId: a.id,
      state: "working",
    }));
  agentSimulation.update(agentsArray, defaultOfficeMap, 200);
  const agentPositions = agentSimulation.agentPositions;
  const agentsPresence = agentsArray.map((agent) => {
    const pos = agentPositions.get(agent.agentId) || { x: 150, y: 150 };
    return {
      agentId: agent.agentId,
      name: agentRegistry.get(agent.agentId)?.name || agent.agentId,
      state: agent.state,
      x: pos.x,
      y: pos.y,
    };
  });
  return {
    workspaceId: "default",
    timestamp: new Date().toISOString(),
    agents: agentsPresence,
    sessions: {
      recent: extraSessions.recent || [],
      byAgent: extraSessions.byAgent || [...agentRegistry.keys()].map((aid) => ({
        agentId: aid,
        recent: [],
      })),
    },
  };
}

// Start simulation tick interval
const simTickInterval = setInterval(() => {
  const disabledTeamIds = new Set(
    [...teamRegistry.values()].filter((t) => !t.enabled).map((t) => t.id)
  );
  const agentsArray = [...agentRegistry.values()]
    .filter((a) => !a.teamId || !disabledTeamIds.has(a.teamId))
    .map((a) => ({
      agentId: a.id,
      state: "working",
    }));
  agentSimulation.update(agentsArray, defaultOfficeMap, 200);
  broadcastEvent({
    type: "event",
    event: "presence",
    payload: buildPresencePayload(),
  });
}, 200);
if (simTickInterval && typeof simTickInterval.unref === "function") {
  simTickInterval.unref();
}

// Set of all active sendEvent functions (one per connected WS client)
/** @type {Set<(frame: object) => void>} */
const activeSendEventFns = new Set();

// ---------------------------------------------------------------------------
// Disk persistence for conversation history, agent registry & brain files
// ---------------------------------------------------------------------------

const HISTORY_FILE = path.join(HOME, ".hermes", "hermes3d-history.json");
const AGENT_FILES_FILE = path.join(HOME, ".hermes", "hermes3d-agent-files.json");
const AGENTS_FILE = path.join(HOME, ".hermes", "hermes3d-agents.json");
const SESSIONS_FILE = path.join(HOME, ".hermes", "hermes3d-sessions.json");
const TEAMS_FILE = path.join(HOME, ".hermes", "hermes3d-teams.json");
let persistDebounceTimer = null;
let persistAgentFilesTimer = null;
let persistAgentsTimer = null;
let persistSessionsTimer = null;
let persistTeamsTimer = null;
const teamRegistry = new Map();

const DEFAULT_TEAM_IT_ID = "team-it";
const DEFAULT_TEAM_IT_NAME = "Team IT";
const DEFAULT_TEAM_IT_AGENT_IDS = [
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
];

function saveTeamsToDisk(sync = false) {
  if (sync) {
    if (persistTeamsTimer) {
      clearTimeout(persistTeamsTimer);
      persistTeamsTimer = null;
    }
    try {
      const data = [...teamRegistry.values()];
      fs.mkdirSync(path.dirname(TEAMS_FILE), { recursive: true });
      fs.writeFileSync(TEAMS_FILE, JSON.stringify(data, null, 2), "utf8");
    } catch (err) {
      console.warn("[hermes-adapter] Could not save teams:", err.message);
    }
    return;
  }
  if (persistTeamsTimer) clearTimeout(persistTeamsTimer);
  persistTeamsTimer = setTimeout(() => {
    persistTeamsTimer = null;
    try {
      const data = [...teamRegistry.values()];
      fs.mkdirSync(path.dirname(TEAMS_FILE), { recursive: true });
      fs.writeFileSync(TEAMS_FILE, JSON.stringify(data, null, 2), "utf8");
    } catch (err) {
      console.warn("[hermes-adapter] Could not save teams:", err.message);
    }
  }, 300);
}

async function seedTeamItIfNeeded(options = {}) {
  const targetTeamRegistry = options.teamRegistry || teamRegistry;
  const targetAgentRegistry = options.agentRegistry || agentRegistry;
  const targetMongoDb = options.mongoDb || mongoDb;
  const saveTeamsFn = options.saveTeamsToDisk || saveTeamsToDisk;
  const saveAgentsFn = options.saveAgentsToDisk || saveAgentsToDisk;

  if (targetTeamRegistry.has(DEFAULT_TEAM_IT_ID)) {
    return { created: false, team: targetTeamRegistry.get(DEFAULT_TEAM_IT_ID) };
  }

  const teamIt = {
    id: DEFAULT_TEAM_IT_ID,
    name: DEFAULT_TEAM_IT_NAME,
    enabled: true,
    createdAt: new Date().toISOString(),
  };
  targetTeamRegistry.set(DEFAULT_TEAM_IT_ID, teamIt);

  const updatedAgents = [];
  for (const agentId of DEFAULT_TEAM_IT_AGENT_IDS) {
    const agent = targetAgentRegistry.get(agentId);
    if (agent && !agent.teamId) {
      agent.teamId = DEFAULT_TEAM_IT_ID;
      updatedAgents.push(agent);
    }
  }

  // Persist team to MongoDB
  try {
    if (targetMongoDb && typeof targetMongoDb.upsertTeam === "function") {
      await targetMongoDb.upsertTeam(teamIt);
    }
  } catch (err) {
    console.warn("[hermes-adapter] Could not upsert team-it to MongoDB:", sanitizeErrorMessage(err));
  }

  // Persist team to disk
  if (typeof saveTeamsFn === "function") {
    try {
      saveTeamsFn(true);
    } catch (err) {
      console.warn("[hermes-adapter] Could not save teams to disk during seed:", sanitizeErrorMessage(err));
    }
  }

  // Persist updated agents to MongoDB
  for (const agent of updatedAgents) {
    try {
      if (targetMongoDb && typeof targetMongoDb.upsertAgentRecord === "function") {
        await targetMongoDb.upsertAgentRecord(agent);
      }
    } catch (err) {
      console.warn(`[hermes-adapter] Could not upsert agent ${agent.id} to MongoDB during team seed:`, sanitizeErrorMessage(err));
    }
  }

  // Persist agents to disk
  if (updatedAgents.length > 0 && typeof saveAgentsFn === "function") {
    try {
      saveAgentsFn(true);
    } catch (err) {
      console.warn("[hermes-adapter] Could not save agents to disk during team seed:", sanitizeErrorMessage(err));
    }
  }

  return { created: true, team: teamIt, updatedAgentIds: updatedAgents.map((a) => a.id) };
}

function loadHistoryFromDisk() {
  try {
    if (fs.existsSync(HISTORY_FILE)) {
      const raw = fs.readFileSync(HISTORY_FILE, "utf8");
      const data = JSON.parse(raw);
      if (data && typeof data === "object") {
        for (const [key, messages] of Object.entries(data)) {
          if (Array.isArray(messages)) {
            for (const msg of messages) {
              if (msg && typeof msg === "object") {
                const ts = resolveMessageTimestamp(msg);
                if (ts > 0) {
                  if (typeof msg.timestamp !== "number") msg.timestamp = ts;
                  if (typeof msg.createdAt !== "number") msg.createdAt = ts;
                }
              }
            }
            conversationHistory.set(key, messages);
          }
        }
        console.log(`[hermes-adapter] Loaded history for ${Object.keys(data).length} session(s).`);
      }
    }
  } catch (err) {
    console.warn("[hermes-adapter] Could not load history:", sanitizeErrorMessage(err));
  }
}

function saveHistoryToDisk() {
  if (persistDebounceTimer) clearTimeout(persistDebounceTimer);
  persistDebounceTimer = setTimeout(() => {
    try {
      const data = {};
      for (const [key, messages] of conversationHistory.entries()) {
        if (messages.length > 0) data[key] = messages;
      }
      fs.mkdirSync(path.dirname(HISTORY_FILE), { recursive: true });
      fs.writeFileSync(HISTORY_FILE, JSON.stringify(data, null, 2), "utf8");
    } catch (err) {
      console.warn("[hermes-adapter] Could not save history:", sanitizeErrorMessage(err));
    }
  }, 500);
}

function saveAgentFilesToDisk() {
  if (persistAgentFilesTimer) clearTimeout(persistAgentFilesTimer);
  persistAgentFilesTimer = setTimeout(() => {
    try {
      const data = {};
      for (const [k, v] of agentFiles.entries()) {
        data[k] = v;
      }
      fs.mkdirSync(path.dirname(AGENT_FILES_FILE), { recursive: true });
      fs.writeFileSync(AGENT_FILES_FILE, JSON.stringify(data, null, 2), "utf8");
    } catch (err) {
      console.warn("[hermes-adapter] Could not save agent files:", sanitizeErrorMessage(err));
    }
  }, 300);
}

function saveAgentsToDisk(sync = false) {
  if (sync) {
    if (persistAgentsTimer) {
      clearTimeout(persistAgentsTimer);
      persistAgentsTimer = null;
    }
    try {
      const data = [];
      for (const agent of agentRegistry.values()) {
        data.push(agent);
      }
      fs.mkdirSync(path.dirname(AGENTS_FILE), { recursive: true });
      fs.writeFileSync(AGENTS_FILE, JSON.stringify(data, null, 2), "utf8");
    } catch (err) {
      console.warn("[hermes-adapter] Could not save agents:", sanitizeErrorMessage(err));
    }
    return;
  }
  if (persistAgentsTimer) clearTimeout(persistAgentsTimer);
  persistAgentsTimer = setTimeout(() => {
    persistAgentsTimer = null;
    try {
      const data = [];
      for (const agent of agentRegistry.values()) {
        data.push(agent);
      }
      fs.mkdirSync(path.dirname(AGENTS_FILE), { recursive: true });
      fs.writeFileSync(AGENTS_FILE, JSON.stringify(data, null, 2), "utf8");
    } catch (err) {
      console.warn("[hermes-adapter] Could not save agents:", sanitizeErrorMessage(err));
    }
  }, 300);
}

function saveSessionsToDisk() {
  if (persistSessionsTimer) clearTimeout(persistSessionsTimer);
  persistSessionsTimer = setTimeout(() => {
    try {
      const data = {};
      for (const [k, v] of sessionSettings.entries()) {
        data[k] = v;
      }
      fs.mkdirSync(path.dirname(SESSIONS_FILE), { recursive: true });
      fs.writeFileSync(SESSIONS_FILE, JSON.stringify(data, null, 2), "utf8");
    } catch (err) {
      console.warn("[hermes-adapter] Could not save session settings:", sanitizeErrorMessage(err));
    }
  }, 300);
}

function getAgentWorkspace(agentId) {
  const aid = agentId || AGENT_ID;
  const agent = agentRegistry.get(aid);
  if (agent && agent.workspace) return agent.workspace;
  const slug = aid.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return path.join(HOME, ".hermes", `workspace-${slug}`);
}

function readAgentBrainFile(agentId, fileName) {
  const aid = agentId || AGENT_ID;
  const ws = getAgentWorkspace(aid);
  const filePath = path.join(ws, fileName);
  const key = `${aid}/${fileName}`;

  if (fs.existsSync(filePath)) {
    try {
      const content = fs.readFileSync(filePath, "utf8");
      agentFiles.set(key, content);
      return { content, path: filePath, workspace: ws, missing: false };
    } catch (err) {
      console.warn(`[hermes-adapter] Error reading ${filePath}:`, sanitizeErrorMessage(err));
    }
  }

  if (agentFiles.has(key)) {
    const content = agentFiles.get(key) || "";
    return { content, path: filePath, workspace: ws, missing: false };
  }

  return { content: "", path: filePath, workspace: ws, missing: true };
}

function writeAgentBrainFileToDisk(agentId, fileName, content) {
  const aid = agentId || AGENT_ID;
  const ws = getAgentWorkspace(aid);
  const filePath = path.join(ws, fileName);
  const key = `${aid}/${fileName}`;
  const safeContent = typeof content === "string" ? content : "";

  agentFiles.set(key, safeContent);

  try {
    fs.mkdirSync(ws, { recursive: true });
    fs.writeFileSync(filePath, safeContent, "utf8");
  } catch (err) {
    console.warn(`[hermes-adapter] Error writing ${filePath}:`, sanitizeErrorMessage(err));
  }

  saveAgentFilesToDisk();
  updateAgentSystemPromptFromFiles(aid);
}

function updateAgentSystemPromptFromFiles(agentId) {
  const aid = agentId || AGENT_ID;
  const agent = agentRegistry.get(aid);
  if (!agent) return;

  const parts = [];
  const idKey = `${aid}/IDENTITY.md`;
  const soulKey = `${aid}/SOUL.md`;
  const agentsKey = `${aid}/AGENTS.md`;
  const toolsKey = `${aid}/TOOLS.md`;
  const userKey = `${aid}/USER.md`;
  const memKey = `${aid}/MEMORY.md`;

  if (agentFiles.has(idKey)) parts.push(agentFiles.get(idKey));
  if (agentFiles.has(soulKey)) parts.push(agentFiles.get(soulKey));
  if (agentFiles.has(agentsKey)) parts.push(agentFiles.get(agentsKey));
  if (agentFiles.has(toolsKey)) parts.push(agentFiles.get(toolsKey));
  if (agentFiles.has(userKey)) parts.push(agentFiles.get(userKey));
  if (agentFiles.has(memKey)) parts.push(agentFiles.get(memKey));

  if (parts.length > 0) {
    agent.systemPrompt = parts.join("\n\n").trim();
  }
}

function seedDefaultOrchestratorBrainFiles() {
  const ws = getAgentWorkspace(AGENT_ID);
  fs.mkdirSync(ws, { recursive: true });

  const defaults = {
    "IDENTITY.md": `# Identity\n\n- Name: Hermes\n- Creature: AI Orchestrator\n- Vibe: Direct, concise, capable\n- Emoji: ⚡\n`,
    "SOUL.md": fs.existsSync(path.join(HOME, ".hermes", "SOUL.md"))
      ? fs.readFileSync(path.join(HOME, ".hermes", "SOUL.md"), "utf8")
      : `You are Hermes Agent, built by Nous Research. Be direct: match the length of your reply to the weight of the ask — a one-line question gets a one-line answer, and finished work gets a short report of what changed, what's verified, and what's left, never a replay of the process. No filler, plain claims over adjectives. Depth is earned.\n`,
    "AGENTS.md": fs.existsSync(path.join(HOME, "AGENTS.md"))
      ? fs.readFileSync(path.join(HOME, "AGENTS.md"), "utf8")
      : `# Operating Instructions\n\nPrioritize architectural navigation and knowledge graph before broad codebase scanning.\nAlways verify changes with real execution before concluding work.\n`,
    "USER.md": `# User Profile\n\n- User: Sat (Admin/Owner)\n- Timezone: Asia/Jakarta (WIB, UTC+07:00)\n- Language: Indonesian\n- Style: Direct, final, clean, no emojis.\n`,
    "TOOLS.md": `# Tool Conventions\n\n- Autonomous tool execution to complete requested tasks.\n- Verify all outputs and handles before reporting.\n`,
    "HEARTBEAT.md": `# Heartbeat Checklist\n\n- Check health of Hermes gateway and adapter.\n- Check system status and memory.\n`,
    "MEMORY.md": `# Memory\n\nDurable facts, conventions, and system environment notes.\n`,
  };

  for (const [name, defaultContent] of Object.entries(defaults)) {
    const filePath = path.join(ws, name);
    const key = `${AGENT_ID}/${name}`;
    if (!fs.existsSync(filePath)) {
      try {
        fs.writeFileSync(filePath, defaultContent, "utf8");
      } catch (err) {
        console.warn(`[hermes-adapter] Could not seed ${filePath}:`, sanitizeErrorMessage(err));
      }
      agentFiles.set(key, defaultContent);
    } else {
      try {
        const existing = fs.readFileSync(filePath, "utf8");
        agentFiles.set(key, existing);
      } catch {}
    }
  }
}

async function loadBrainSettingsFromDisk() {
  // 1. Agents - load existing agents from MongoDB to seed agentRegistry
  try {
    const dbAgents = await mongoDb.getAgentsFromDb();
    if (Array.isArray(dbAgents) && dbAgents.length > 0) {
      for (const a of dbAgents) {
        if (!a || !a.id) continue;
        const existing = agentRegistry.get(a.id);
        if (existing) {
          agentRegistry.set(a.id, {
            ...existing,
            ...a,
            settings: { ...(existing.settings || {}), ...(a.settings || {}) },
          });
        } else {
          agentRegistry.set(a.id, {
            id: a.id,
            name: a.name || a.id,
            workspace: a.workspace || path.join(HOME, ".hermes", `workspace-${a.id}`),
            role: a.role || "",
            systemPrompt: a.systemPrompt || `You are ${a.name || a.id}.`,
            settings: a.settings || { wipe: false, continuity: true, model: HERMES_MODEL, mode: "yolo", yolo: true },
            ...(a.identity ? { identity: a.identity } : {}),
          });
        }
      }
      console.log(`[hermes-adapter] Seeded ${dbAgents.length} agent(s) from MongoDB.`);
    }
  } catch (err) {
    console.warn("[hermes-adapter] Could not load agents from MongoDB:", sanitizeErrorMessage(err));
  }

  // 1b. Load from local disk cache file
  try {
    if (fs.existsSync(AGENTS_FILE)) {
      const raw = fs.readFileSync(AGENTS_FILE, "utf8");
      const list = JSON.parse(raw);
      if (Array.isArray(list)) {
        for (const a of list) {
          if (a && a.id) {
            const cur = agentRegistry.get(a.id);
            agentRegistry.set(a.id, cur ? { ...a, ...cur, settings: { ...(a.settings || {}), ...(cur.settings || {}) } } : a);
          }
        }
        console.log(`[hermes-adapter] Loaded registry for ${agentRegistry.size} agent(s).`);
      }
    }
  } catch (err) {
    console.warn("[hermes-adapter] Could not load agents:", sanitizeErrorMessage(err));
  }

  // 1c. Seed any missing records from memory/disk to MongoDB
  for (const agent of agentRegistry.values()) {
    try {
      await mongoDb.upsertAgentRecord(agent);
    } catch (err) {
      console.warn(`[hermes-adapter] Could not upsert agent ${agent.id} to MongoDB:`, sanitizeErrorMessage(err));
    }
  }

  // 1d. Load teams from MongoDB
  try {
    const dbTeams = await mongoDb.getTeamsFromDb();
    if (Array.isArray(dbTeams)) {
      for (const t of dbTeams) {
        if (t && t.id) teamRegistry.set(t.id, t);
      }
    }
    console.log(`[hermes-adapter] Loaded ${teamRegistry.size} team(s) from MongoDB.`);
  } catch (err) {
    console.warn("[hermes-adapter] Could not load teams from MongoDB:", sanitizeErrorMessage(err));
  }
  // Fallback from disk
  try {
    if (fs.existsSync(TEAMS_FILE)) {
      const raw = fs.readFileSync(TEAMS_FILE, "utf8");
      const list = JSON.parse(raw);
      if (Array.isArray(list)) {
        for (const t of list) {
          if (t && t.id && !teamRegistry.has(t.id)) teamRegistry.set(t.id, t);
        }
      }
    }
  } catch {}
  // Sync to MongoDB
  for (const t of teamRegistry.values()) {
    mongoDb.upsertTeam(t).catch(() => {});
  }

  // 1e. Seed Team IT if absent (runs after DB/disk team load, preserves existing teams/membership)
  try {
    await seedTeamItIfNeeded();
  } catch (err) {
    console.warn("[hermes-adapter] Error during Team IT bootstrap:", sanitizeErrorMessage(err));
  }

  // 2. Sessions - load from MongoDB first, fallback to disk
  try {
    const dbSessions = await mongoDb.getSessionsFromDb();
    if (Array.isArray(dbSessions) && dbSessions.length > 0) {
      for (const s of dbSessions) {
        if (!s || !s.sessionKey) continue;
        sessionSettings.set(s.sessionKey, s);
      }
      console.log(`[hermes-adapter] Loaded ${dbSessions.length} session(s) from MongoDB.`);
    }
  } catch (err) {
    console.warn("[hermes-adapter] Could not load sessions from MongoDB:", sanitizeErrorMessage(err));
  }

  // 2b. Load from local disk cache file
  try {
    if (fs.existsSync(SESSIONS_FILE)) {
      const raw = fs.readFileSync(SESSIONS_FILE, "utf8");
      const data = JSON.parse(raw);
      if (data && typeof data === "object") {
        for (const [k, v] of Object.entries(data)) {
          const cur = sessionSettings.get(k);
          sessionSettings.set(k, cur ? { ...v, ...cur } : v);
        }
        console.log(`[hermes-adapter] Loaded metadata for ${sessionSettings.size} session(s).`);
      }
    }
  } catch (err) {
    console.warn("[hermes-adapter] Could not load session settings:", sanitizeErrorMessage(err));
  }

  // 2c. Seed any session settings to MongoDB
  for (const [key, val] of sessionSettings.entries()) {
    try {
      await mongoDb.upsertSessionRecord(key, val);
    } catch {}
  }

  // 3. Agent files cache
  try {
    if (fs.existsSync(AGENT_FILES_FILE)) {
      const raw = fs.readFileSync(AGENT_FILES_FILE, "utf8");
      const data = JSON.parse(raw);
      if (data && typeof data === "object") {
        for (const [k, v] of Object.entries(data)) {
          agentFiles.set(k, v);
        }
      }
    }
  } catch (err) {
    console.warn("[hermes-adapter] Could not load agent files:", sanitizeErrorMessage(err));
  }

  // 4. Seed default orchestrator brain files
  seedDefaultOrchestratorBrainFiles();
  updateAgentSystemPromptFromFiles(AGENT_ID);

  // 5. Read from all agent workspaces on disk and save workspace markdown brain files to MongoDB
  for (const [aid, agent] of agentRegistry.entries()) {
    const ws = agent.workspace || path.join(HOME, ".hermes", `workspace-${aid}`);
    try {
      fs.mkdirSync(ws, { recursive: true });
      if (fs.existsSync(ws)) {
        const files = fs.readdirSync(ws);
        for (const f of files) {
          if (f.endsWith(".md")) {
            const fullPath = path.join(ws, f);
            try {
              const c = fs.readFileSync(fullPath, "utf8");
              agentFiles.set(`${aid}/${f}`, c);
              await mongoDb.upsertBrainFile(aid, f, c, fullPath);
            } catch (err) {
              console.warn(`[hermes-adapter] Could not read/save brain file ${fullPath}:`, sanitizeErrorMessage(err));
            }
          }
        }
      }
    } catch (err) {
      console.warn(`[hermes-adapter] Could not inspect workspace for ${aid}:`, sanitizeErrorMessage(err));
    }
  }

  // 4. Backfill any missing message timestamps in conversationHistory from MongoDB
  try {
    let touchedHistory = false;
    for (const [key, messages] of conversationHistory.entries()) {
      if (!Array.isArray(messages) || messages.length === 0) continue;
      const hasMissing = messages.some((m) => !m.timestamp && !m.createdAt);
      if (hasMissing) {
        const dbMsgs = await mongoDb.getLatestMessages(key, Math.max(messages.length, 50));
        if (Array.isArray(dbMsgs) && dbMsgs.length > 0) {
          for (let i = 0; i < messages.length; i++) {
            const m = messages[i];
            if (!m.timestamp && !m.createdAt) {
              const match = dbMsgs.find(
                (dbm) => dbm.role === m.role && dbm.content === m.content
              ) || dbMsgs[i];
              if (match) {
                const ts = resolveMessageTimestamp(match);
                if (ts > 0) {
                  m.createdAt = ts;
                  m.timestamp = ts;
                  touchedHistory = true;
                }
              }
            }
          }
        }
      }
    }
    if (touchedHistory) saveHistoryToDisk();
  } catch (err) {
    console.warn("[hermes-adapter] Could not sync missing history timestamps from MongoDB:", sanitizeErrorMessage(err));
  }

  saveAgentsToDisk();
  saveAgentFilesToDisk();
  saveTeamsToDisk();
  console.log(`[hermes-adapter] Loaded ${agentFiles.size} agent brain file(s) across local workspaces.`);
}

function resolveMessageTimestamp(msg) {
  if (!msg || typeof msg !== "object") return 0;
  for (const field of [msg.timestamp, msg.createdAt]) {
    if (typeof field === "number" && Number.isFinite(field) && field > 0) {
      return field;
    }
    if (field instanceof Date && !Number.isNaN(field.getTime())) {
      return field.getTime();
    }
    if (typeof field === "string" && field.trim()) {
      const parsed = Date.parse(field);
      if (!Number.isNaN(parsed) && parsed > 0) return parsed;
      const num = Number(field);
      if (!Number.isNaN(num) && num > 0) return num;
    }
  }
  if (msg._id && typeof msg._id.getTimestamp === "function") {
    try {
      const ms = msg._id.getTimestamp().getTime();
      if (!Number.isNaN(ms) && ms > 0) return ms;
    } catch {}
  }
  return 0;
}

function getSessionCreationTime(sessionKey, agent) {
  const settings = sessionSettings.get(sessionKey);
  if (settings) {
    for (const val of [settings.createdAt, settings.created_at]) {
      if (typeof val === "number" && Number.isFinite(val) && val > 0) return val;
      if (val instanceof Date && !Number.isNaN(val.getTime())) return val.getTime();
      if (typeof val === "string" && val.trim()) {
        const ms = Date.parse(val);
        if (!Number.isNaN(ms) && ms > 0) return ms;
        const num = Number(val);
        if (!Number.isNaN(num) && num > 0) return num;
      }
    }
  }
  if (agent) {
    for (const val of [agent.createdAt, agent.created_at]) {
      if (typeof val === "number" && Number.isFinite(val) && val > 0) return val;
      if (val instanceof Date && !Number.isNaN(val.getTime())) return val.getTime();
      if (typeof val === "string" && val.trim()) {
        const ms = Date.parse(val);
        if (!Number.isNaN(ms) && ms > 0) return ms;
        const num = Number(val);
        if (!Number.isNaN(num) && num > 0) return num;
      }
    }
  }
  return null;
}

function getHistory(sessionKey) {
  if (!conversationHistory.has(sessionKey)) conversationHistory.set(sessionKey, []);
  return conversationHistory.get(sessionKey);
}

function clearHistory(sessionKey) {
  conversationHistory.delete(sessionKey);
  saveHistoryToDisk();
}

function randomId() {
  return require("crypto").randomBytes(8).toString("hex");
}

function redactSecrets(value) {
  if (typeof value !== "string" || !value) return value;
  let redacted = value;
  if (HERMES_API_KEY) {
    redacted = redacted.split(HERMES_API_KEY).join("[REDACTED]");
  }
  redacted = redacted.replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [REDACTED]");
  redacted = redacted.replace(/\b\d{8,12}:[A-Za-z0-9_-]{20,}\b/g, "[REDACTED]");
  return redacted;
}

// ---------------------------------------------------------------------------
// Hermes HTTP API helpers
// ---------------------------------------------------------------------------

function hermesPost(path, body, signal) {
  return new Promise((resolve, reject) => {
    const urlStr = HERMES_API_URL + path;
    let url;
    try { url = new URL(urlStr); } catch { reject(new Error(`Invalid URL: ${urlStr}`)); return; }
    const transport = url.protocol === "https:" ? https : http;
    const bodyStr = JSON.stringify(body);
    const headers = { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(bodyStr) };
    if (HERMES_API_KEY) headers["Authorization"] = `Bearer ${HERMES_API_KEY}`;
    const req = transport.request(
      { hostname: url.hostname, port: url.port ? parseInt(url.port, 10) : (url.protocol === "https:" ? 443 : 80),
        path: url.pathname + (url.search || ""), method: "POST", headers, ...(signal ? { signal } : {}) },
      resolve
    );
    req.on("error", reject);
    req.write(bodyStr);
    req.end();
  });
}

function hermesGet(path) {
  return new Promise((resolve, reject) => {
    const urlStr = HERMES_API_URL + path;
    let url;
    try { url = new URL(urlStr); } catch { reject(new Error(`Invalid URL: ${urlStr}`)); return; }
    const transport = url.protocol === "https:" ? https : http;
    const headers = {};
    if (HERMES_API_KEY) headers["Authorization"] = `Bearer ${HERMES_API_KEY}`;
    const req = transport.request(
      { hostname: url.hostname, port: url.port ? parseInt(url.port, 10) : (url.protocol === "https:" ? 443 : 80),
        path: url.pathname + (url.search || ""), method: "GET", headers },
      resolve
    );
    req.on("error", reject);
    req.end();
  });
}

async function readJsonBody(res) {
  const chunks = [];
  for await (const chunk of res) chunks.push(Buffer.from(chunk));
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw.trim()) return {};
  return JSON.parse(raw);
}

function sanitizeErrorMessage(error) {
  if (!error) return "Unknown error";
  if (typeof error === "string") return redactSecrets(error);
  return redactSecrets(error.message || String(error));
}

function extractOpenAiStyleError(payload, fallbackMessage) {
  if (payload && typeof payload === "object") {
    const message =
      typeof payload?.error?.message === "string"
        ? payload.error.message.trim()
        : "";
    if (message) return message;
  }
  return fallbackMessage;
}

let cachedHermesModels = null;
let cachedHermesModelsAt = 0;

async function fetchHermesModels() {
  const now = Date.now();
  if (cachedHermesModels && now - cachedHermesModelsAt < 30_000) {
    return cachedHermesModels;
  }
  const res = await hermesGet("/v1/models");
  if (res.statusCode >= 400) {
    res.resume();
    throw new Error(`Hermes models API HTTP ${res.statusCode}`);
  }
  const payload = await readJsonBody(res);
  const models = Array.isArray(payload?.data)
    ? payload.data
        .map((entry) => (typeof entry?.id === "string" ? entry.id.trim() : ""))
        .filter(Boolean)
    : [];
  cachedHermesModels = models;
  cachedHermesModelsAt = now;
  return models;
}

async function resolveHermesModel(requestedModel) {
  const trimmed = typeof requestedModel === "string" ? requestedModel.trim() : "";
  const normalized = trimmed.includes("/") ? trimmed.split("/").pop().trim() : trimmed;
  try {
    const models = await fetchHermesModels();
    if (models.length === 0) {
      return normalized || trimmed || HERMES_MODEL;
    }
    const candidates = [trimmed, normalized, HERMES_MODEL]
      .map((value) => (typeof value === "string" ? value.trim() : ""))
      .filter(Boolean);
    for (const candidate of candidates) {
      const exact = models.find((modelId) => modelId === candidate);
      if (exact) return exact;
    }
    for (const candidate of candidates) {
      const suffix = models.find((modelId) => modelId.endsWith(`/${candidate}`));
      if (suffix) return suffix;
    }
    return models[0];
  } catch {
    return normalized || trimmed || HERMES_MODEL;
  }
}

async function completeOneTurn(messages, model, tools) {
  const resolvedModel = await resolveHermesModel(model);
  const body = { model: resolvedModel, messages, stream: false };
  if (tools && tools.length > 0) {
    body.tools = tools;
    body.tool_choice = "auto";
  }
  const res = await hermesPost("/v1/chat/completions", body);
  const payload = await readJsonBody(res);
  if (res.statusCode >= 400) {
    throw new Error(
      extractOpenAiStyleError(payload, `Hermes API HTTP ${res.statusCode}`)
    );
  }
  const choice = Array.isArray(payload?.choices) ? payload.choices[0] : null;
  const message = choice?.message || {};
  const textContent =
    typeof message?.content === "string"
      ? message.content
      : Array.isArray(message?.content)
        ? message.content
            .map((part) => (typeof part?.text === "string" ? part.text : ""))
            .join("")
        : "";
  const finishReason =
    typeof choice?.finish_reason === "string" && choice.finish_reason
      ? choice.finish_reason
      : "stop";
  const toolCalls = Array.isArray(message?.tool_calls)
    ? message.tool_calls.map((tc) => {
        let args = {};
        const rawArgs = tc?.function?.arguments;
        if (typeof rawArgs === "string" && rawArgs.trim()) {
          try {
            args = JSON.parse(rawArgs);
          } catch {
            args = { _raw: rawArgs };
          }
        }
        return {
          id: typeof tc?.id === "string" ? tc.id : randomId(),
          name: typeof tc?.function?.name === "string" ? tc.function.name : "",
          args,
        };
      })
    : [];
  return { textContent, toolCalls, finishReason, resolvedModel };
}

// ---------------------------------------------------------------------------
// SSE streaming — handles both text deltas and tool calls
// ---------------------------------------------------------------------------

/**
 * Stream one LLM turn.
 * @returns {{ textContent: string, toolCalls: Array<{id,name,args}>, finishReason: string }}
 */
async function streamOneTurn(messages, model, tools, onTextDelta, abortCheck, signal) {
  const body = { model, messages, stream: true };
  if (tools && tools.length > 0) { body.tools = tools; body.tool_choice = "auto"; }

  const resolvedModel = await resolveHermesModel(model);
  body.model = resolvedModel;
  const res = await hermesPost("/v1/chat/completions", body, signal);
  if (res.statusCode >= 400) {
    res.resume();
    throw new Error(`Hermes API HTTP ${res.statusCode}`);
  }

  let textContent = "";
  let finishReason = "stop";
  /** @type {Record<number, {id: string, name: string, argsStr: string}>} */
  const toolCallAccum = {};
  let buffer = "";

  await new Promise((resolve, reject) => {
    // destroy() emits "aborted"+"close" but never "end"; settle on close so callers are not left hanging.
    const stop = () => { res.destroy(); resolve(); };
    if (signal) {
      if (signal.aborted) { stop(); return; }
      signal.addEventListener("abort", stop, { once: true });
      res.on("close", () => signal.removeEventListener("abort", stop));
    }
    res.on("close", resolve);
    res.on("data", (chunk) => {
      if (abortCheck && abortCheck()) { res.destroy(); return; }
      buffer += chunk.toString("utf8");
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === "data: [DONE]") continue;
        if (!trimmed.startsWith("data: ")) continue;
        try {
          const data = JSON.parse(trimmed.slice(6));
          const choice = data?.choices?.[0];
          if (!choice) continue;
          if (typeof choice.finish_reason === "string" && choice.finish_reason) {
            finishReason = choice.finish_reason;
          }
          const delta = choice.delta || {};
          // Text content
          if (typeof delta.content === "string" && delta.content) {
            textContent += delta.content;
            if (onTextDelta) onTextDelta(textContent);
          }
          // Tool call accumulation
          if (Array.isArray(delta.tool_calls)) {
            for (const tc of delta.tool_calls) {
              const idx = typeof tc.index === "number" ? tc.index : 0;
              if (!toolCallAccum[idx]) toolCallAccum[idx] = { id: "", name: "", argsStr: "" };
              if (tc.id) toolCallAccum[idx].id = tc.id;
              if (tc.function?.name) toolCallAccum[idx].name += tc.function.name;
              if (tc.function?.arguments) toolCallAccum[idx].argsStr += tc.function.arguments;
            }
          }
        } catch { /* ignore malformed */ }
      }
    });
    res.on("end", resolve);
    res.on("error", reject);
  });

  const toolCalls = Object.values(toolCallAccum).map((tc) => {
    let args = {};
    try { args = JSON.parse(tc.argsStr); } catch { args = { _raw: tc.argsStr }; }
    return { id: tc.id, name: tc.name, args };
  });

  if (signal && signal.aborted) return { textContent, toolCalls, finishReason: "aborted" };

  if (!textContent.trim() && toolCalls.length === 0 && finishReason === "stop") {
    const fallback = await completeOneTurn(messages, resolvedModel, tools);
    return {
      textContent: fallback.textContent,
      toolCalls: fallback.toolCalls,
      finishReason: fallback.finishReason,
    };
  }

  return { textContent, toolCalls, finishReason };
}

// ---------------------------------------------------------------------------
// Broadcast a gateway event to all connected clients
// ---------------------------------------------------------------------------

function broadcastEvent(frame) {
  for (const fn of activeSendEventFns) {
    try { fn(frame); } catch { /* ignore */ }
  }
}

// ---------------------------------------------------------------------------
// Tool executors
// ---------------------------------------------------------------------------

async function execSpawnAgent(args) {
  const name = (typeof args.name === "string" ? args.name : "Agent").trim() || "Agent";
  const role = (typeof args.role === "string" ? args.role : "").trim();
  const instructions = typeof args.instructions === "string" ? args.instructions.trim() : "";
  const boundaries = typeof args.boundaries === "string" ? args.boundaries.trim() : "";
  const model = typeof args.model === "string" && args.model.trim() ? args.model.trim() : HERMES_MODEL;
  const wipe = Boolean(args.wipe);
  const continuity = args.continuity !== false;
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const newId = `${slug}-${randomId().slice(0, 6)}`;

  let systemPrompt = instructions || `You are ${name}, a ${role || "specialist"} agent.`;
  if (boundaries) systemPrompt += `\n\nBoundaries: ${boundaries}`;

  agentRegistry.set(newId, {
    id: newId, name, workspace: `${HOME}/.hermes/workspace-${slug}`,
    role, systemPrompt, settings: { wipe, continuity, model, boundaries, mode: "yolo", yolo: true },
  });
  saveAgentsToDisk();
  mongoDb.upsertAgentRecord(agentRegistry.get(newId)).catch((err) => {
    console.warn(`[hermes-adapter] Could not upsert spawned agent ${newId} to MongoDB:`, sanitizeErrorMessage(err));
  });

  console.log(`[hermes-adapter] Spawned agent: ${name} (${newId})`);

  // Broadcast presence so the 3D office loads the new agent immediately
  broadcastEvent({
    type: "event", event: "presence",
    payload: buildPresencePayload(),
  });

  return JSON.stringify({ ok: true, agent_id: newId, name, role });
}

async function execDelegateTask(args, sendEvent, callerAgentId) {
  const targetId = typeof args.agent_id === "string" ? args.agent_id.trim() : "";
  const message = typeof args.message === "string" ? args.message.trim() : "";
  if (!targetId || !message) return JSON.stringify({ ok: false, error: "agent_id and message required" });

  const agent = agentRegistry.get(targetId);
  if (!agent) return JSON.stringify({ ok: false, error: `Agent ${targetId} not found` });

  const callerId = typeof args.caller_agent_id === "string" ? args.caller_agent_id.trim() : (typeof callerAgentId === "string" ? callerAgentId.trim() : "");
  if (callerId) {
    const callerAgent = agentRegistry.get(callerId);
    if (callerAgent && callerAgent.teamId) {
      const callerTeam = teamRegistry.get(callerAgent.teamId);
      if (callerTeam && !callerTeam.enabled) {
        return JSON.stringify({
          ok: false,
          code: "caller_team_disabled",
          error: "caller_team_disabled",
          message: `Caller agent ${callerAgent.name || callerId} is part of disabled team "${callerTeam.name}". Enable the team first.`,
        });
      }
    }
  }

  if (agent.teamId) {
    const agentTeam = teamRegistry.get(agent.teamId);
    if (agentTeam && !agentTeam.enabled) {
      return JSON.stringify({
        ok: false,
        code: "team_disabled",
        error: "team_disabled",
        message: `Agent ${agent.name || targetId} is part of disabled team "${agentTeam.name}". Enable the team first.`,
      });
    }
  }

  const sessionKey = `agent:${targetId}:${MAIN_KEY}`;
  const history = getHistory(sessionKey);
  const model = agent.settings.model || HERMES_MODEL;

  // Build messages for sub-agent
  const systemMsg = agent.systemPrompt ? [{ role: "system", content: agent.systemPrompt }] : [];
  const contextHistory = agent.settings.wipe ? [] : [...history];
  const messages = [...systemMsg, ...contextHistory, { role: "user", content: message }];

  // Emit chat start event for this sub-agent
  const subRunId = randomId();
  let seqCounter = 0;
  const emitSub = (state, extra) => {
    broadcastEvent({ type: "event", event: "chat", seq: seqCounter++,
      payload: { runId: subRunId, sessionKey, state, ...extra } });
  };

  emitSub("delta", { message: { role: "assistant", content: "…" } });

  const throttledSubDelta = createThrottledDeltaEmitter((partial) => {
    emitSub("delta", { message: { role: "assistant", content: partial } });
  }, CHAT_STREAM_THROTTLE_MS);

  let responseText = "";
  try {
    let round = 0;
    while (round < 4) {
      round++;
      const result = await streamOneTurn(messages, model, [SUBAGENT_SPAWN_TOOL], (partial) => {
        responseText = partial;
        throttledSubDelta(partial);
      }, null);

      if (result.finishReason === "tool_calls" && result.toolCalls.length > 0) {
        throttledSubDelta.flush();
        messages.push({
          role: "assistant",
          content: result.textContent || null,
          tool_calls: result.toolCalls.map((tc) => ({
            id: tc.id,
            type: "function",
            function: { name: tc.name, arguments: JSON.stringify(tc.args) },
          })),
        });

        const toolResults = await Promise.all(
          result.toolCalls.map(async (tc) => {
            const toolRes = await executeToolCall(tc, targetId, broadcastEvent);
            return { role: "tool", tool_call_id: tc.id, content: toolRes };
          })
        );
        messages.push(...toolResults);
        continue;
      }

      responseText = result.textContent;
      break;
    }

    throttledSubDelta.cancel();

    // Persist to sub-agent history
    if (agent.settings.continuity !== false) {
      const nowMs = Date.now();
      history.push({ role: "user", content: message, createdAt: nowMs, timestamp: nowMs });
      history.push({ role: "assistant", content: responseText, createdAt: nowMs, timestamp: nowMs });
      saveHistoryToDisk();
    }

    emitSub("final", { stopReason: "end_turn", message: { role: "assistant", content: responseText } });

    // Presence update for sub-agent session
    broadcastEvent({
      type: "event", event: "presence",
      payload: buildPresencePayload({
        recent: [{ key: sessionKey, updatedAt: Date.now() }],
        byAgent: [{ agentId: targetId, recent: [{ key: sessionKey, updatedAt: Date.now() }] }],
      }),
    });
  } catch (err) {
    throttledSubDelta.cancel();
    const message = sanitizeErrorMessage(err);
    emitSub("error", { errorMessage: message });
    return JSON.stringify({ ok: false, error: message });
  }

  return JSON.stringify({ ok: true, agent_id: targetId, response: responseText });
}

function execListTeam() {
  const members = [...agentRegistry.values()].map((a) => ({
    id: a.id, name: a.name, role: a.role || "",
    settings: a.settings,
  }));
  return JSON.stringify({ team: members });
}

function execConfigureAgent(args) {
  const targetId = typeof args.agent_id === "string" ? args.agent_id.trim() : "";
  const agent = agentRegistry.get(targetId);
  if (!agent) return JSON.stringify({ ok: false, error: `Agent ${targetId} not found` });
  if (typeof args.name === "string" && args.name.trim()) agent.name = args.name.trim();
  if (typeof args.role === "string") agent.role = args.role.trim();
  if (typeof args.instructions === "string") agent.systemPrompt = args.instructions;
  if (typeof args.wipe === "boolean") agent.settings.wipe = args.wipe;
  if (typeof args.continuity === "boolean") agent.settings.continuity = args.continuity;
  if (typeof args.boundaries === "string") {
    agent.settings.boundaries = args.boundaries;
    if (agent.systemPrompt && args.boundaries) {
      agent.systemPrompt = agent.systemPrompt.replace(/\n\nBoundaries:.*$/s, "") + `\n\nBoundaries: ${args.boundaries}`;
    }
  }
  if (typeof args.model === "string" && args.model.trim()) agent.settings.model = args.model.trim();
  saveAgentsToDisk();
  mongoDb.upsertAgentRecord(agent).catch((err) => {
    console.warn(`[hermes-adapter] Could not upsert configured agent ${targetId} to MongoDB:`, sanitizeErrorMessage(err));
  });
  console.log(`[hermes-adapter] Configured agent: ${agent.name} (${targetId})`);
  broadcastEvent({
    type: "event", event: "presence",
    payload: buildPresencePayload(),
  });
  return JSON.stringify({ ok: true, agent_id: targetId, name: agent.name, role: agent.role, settings: agent.settings });
}

function execDismissAgent(args) {
  const targetId = typeof args.agent_id === "string" ? args.agent_id.trim() : "";
  if (!targetId || targetId === AGENT_ID) return JSON.stringify({ ok: false, error: "Cannot dismiss the main orchestrator." });
  const agent = agentRegistry.get(targetId);
  if (!agent) return JSON.stringify({ ok: false, error: `Agent ${targetId} not found` });
  agentRegistry.delete(targetId);
  clearHistory(`agent:${targetId}:${MAIN_KEY}`);
  saveAgentsToDisk();
  mongoDb.deleteAgentRecord(targetId).catch((err) => {
    console.warn(`[hermes-adapter] Could not delete dismissed agent ${targetId} from MongoDB:`, sanitizeErrorMessage(err));
  });
  console.log(`[hermes-adapter] Dismissed agent: ${agent.name} (${targetId})`);
  return JSON.stringify({ ok: true, dismissed: targetId });
}

function execReadAgentContext(args) {
  const targetId = typeof args.agent_id === "string" ? args.agent_id.trim() : "";
  const agent = agentRegistry.get(targetId);
  if (!agent) return JSON.stringify({ ok: false, error: `Agent ${targetId} not found` });
  const lastN = Math.min(40, Math.max(1, typeof args.last_n === "number" ? Math.floor(args.last_n) : 10));
  const sessionKey = `agent:${targetId}:${MAIN_KEY}`;
  const history = getHistory(sessionKey);
  const messages = history.slice(-lastN);
  if (messages.length === 0) {
    return JSON.stringify({ ok: true, agent_id: targetId, name: agent.name, role: agent.role || "", message_count: 0, context: "(no conversation history yet)" });
  }
  const contextLines = messages.map((m) => {
    const role = m.role === "assistant" ? agent.name : "User";
    const content = typeof m.content === "string" ? m.content : JSON.stringify(m.content);
    return `[${role}]: ${content.slice(0, 800)}${content.length > 800 ? "…" : ""}`;
  });
  return JSON.stringify({
    ok: true,
    agent_id: targetId,
    name: agent.name,
    role: agent.role || "",
    message_count: history.length,
    showing_last: messages.length,
    context: contextLines.join("\n\n"),
  });
}

async function execSubagentSpawn(args, callerAgentId) {
  let rawTasks = [];
  if (Array.isArray(args?.tasks)) {
    rawTasks = args.tasks;
  } else if (typeof args?.tasks === "string") {
    rawTasks = [{ goal: args.tasks }];
  } else if (typeof args?.task === "string") {
    rawTasks = [{ goal: args.task }];
  } else if (typeof args?.goal === "string") {
    rawTasks = [{ goal: args.goal }];
  }

  // Cap at 10 subagents per call
  const tasks = rawTasks.slice(0, 10).filter((t) => t && (t.goal || t.task));

  if (tasks.length === 0) {
    return JSON.stringify({
      ok: false,
      error: "No valid tasks provided. Must provide an array of tasks with 'goal' (up to 10).",
    });
  }

  const caller = agentRegistry.get(callerAgentId) || { name: callerAgentId || "Agent" };
  console.log(`[hermes-adapter] ${caller.name} (${callerAgentId}) spawning ${tasks.length} subagent(s)...`);

  const results = await Promise.all(
    tasks.map(async (task, idx) => {
      const name = (typeof task.name === "string" && task.name.trim())
        ? task.name.trim()
        : `Researcher ${idx + 1}`;
      const goal = typeof task.goal === "string" ? task.goal.trim() : (task.task || "");
      const context = typeof task.context === "string" ? task.context.trim() : "";

      const subagentPrompt = [
        `You are ${name}, an autonomous research and task execution subagent spawned by ${caller.name} in Hermes3D.`,
        `Your primary assignment: ${goal}`,
        context ? `Context & Constraints:\n${context}` : "",
        "Be direct, factual, and analytical. Produce clear, actionable conclusions backed by evidence. Do not include conversational filler.",
      ].filter(Boolean).join("\n\n");

      const messages = [
        { role: "system", content: subagentPrompt },
        { role: "user", content: `Execute this task thoroughly and return your findings: ${goal}` },
      ];

      try {
        const turn = await completeOneTurn(messages, HERMES_MODEL, []);
        return {
          name,
          goal,
          status: "completed",
          findings: turn.textContent.trim(),
        };
      } catch (err) {
        return {
          name,
          goal,
          status: "failed",
          error: sanitizeErrorMessage(err),
        };
      }
    })
  );

  return JSON.stringify({
    ok: true,
    caller: caller.name,
    spawned_count: results.length,
    results,
  });
}

// ---------------------------------------------------------------------------
// Team assignment (reached from Hermes via the hermes3d MCP server -> /team/*)
// ---------------------------------------------------------------------------

function buildSystemMessages(agentId, agent) {
  const content = [agent?.systemPrompt || "", buildTeamToolGuide(agentId)].filter(Boolean).join("\n\n");
  return [{ role: "system", content }];
}

// The Hermes API runs its own tool loop server-side and ignores client tools: one call is the whole run.
const runAgentTurn = createRunAgentTurn({
  getAgent: (id) => agentRegistry.get(id) || null,
  getHistory,
  saveHistory: saveHistoryToDisk,
  resolveModel: (sessionKey, agent) =>
    (sessionSettings.get(sessionKey) || {}).model || agent.settings?.model || HERMES_MODEL,
  buildSystemMessages,
  streamOneTurn,
  mainKey: MAIN_KEY,
});

const teamManager = createTeamManager({
  getAgent: (id) => agentRegistry.get(id) || null,
  listAgents: () => [...agentRegistry.values()],
  getTeam: (id) => teamRegistry.get(id) || null,
  isTeamEnabled: (teamId) => {
    const t = teamRegistry.get(teamId);
    return t ? t.enabled !== false : true;
  },
  runAgentTurn,
  broadcast: broadcastEvent,
  randomId,
});
const handleTeamHttp = createTeamHttpHandler({ token: HERMES3D_TEAM_TOKEN, manager: teamManager });

async function executeToolCall(tc, callerAgentId, sendEvent) {
  console.log(`[hermes-adapter] Tool call by ${callerAgentId}: ${tc.name}`, JSON.stringify(tc.args).slice(0, 120));
  switch (tc.name) {
    case "subagent_spawn":       return execSubagentSpawn(tc.args, callerAgentId);
    case "spawn_agent":          return execSpawnAgent(tc.args, sendEvent);
    case "delegate_task":        return execDelegateTask(tc.args, sendEvent, callerAgentId);
    case "list_team":            return execListTeam();
    case "configure_agent":      return execConfigureAgent(tc.args);
    case "dismiss_agent":        return execDismissAgent(tc.args);
    case "read_agent_context":   return execReadAgentContext(tc.args);
    default:                     return JSON.stringify({ ok: false, error: `Unknown tool: ${tc.name}` });
  }
}

// ---------------------------------------------------------------------------
// Agentic loop — handles multi-round tool-calling conversations
// ---------------------------------------------------------------------------

async function runAgenticLoop({ sessionKey, agentId, userMessage, model, tools, emitDelta, abortCheck, sendEvent }) {
  const agent = agentRegistry.get(agentId);
  const systemMsg = buildSystemMessages(agentId, agent);
  const history = getHistory(sessionKey);

  let contextHistory = [];
  if (!agent?.settings?.wipe) {
    const dbHistory = await mongoDb.getLatestMessages(sessionKey, 10);
    if (dbHistory && dbHistory.length > 0) {
      contextHistory = dbHistory.map((m) => ({ role: m.role, content: m.content }));
      if (
        contextHistory.length > 0 &&
        contextHistory[contextHistory.length - 1].role === "user" &&
        contextHistory[contextHistory.length - 1].content === userMessage
      ) {
        contextHistory = contextHistory.slice(0, -1);
      }
    } else {
      contextHistory = history.slice(-10);
    }
  }

  let messages = [...systemMsg, ...contextHistory, { role: "user", content: userMessage }];

  let finalText = "";
  let round = 0;

  while (round < MAX_TOOL_ROUNDS) {
    round++;
    const { textContent, toolCalls, finishReason } = await streamOneTurn(
      messages, model, tools, emitDelta, abortCheck
    );

    if (finishReason === "tool_calls" && toolCalls.length > 0) {
      if (typeof emitDelta?.flush === "function") emitDelta.flush();
      // Inform user that tools are being executed (brief status text)
      const toolNames = toolCalls.map((t) => t.name).join(", ");
      const statusText = textContent || `Executing: ${toolNames}…`;
      if (statusText) emitDelta(statusText);
      if (typeof emitDelta?.flush === "function") emitDelta.flush();

      // Add assistant message with tool_calls to messages
      messages.push({
        role: "assistant",
        content: textContent || null,
        tool_calls: toolCalls.map((tc) => ({
          id: tc.id, type: "function",
          function: { name: tc.name, arguments: JSON.stringify(tc.args) },
        })),
      });

      // Execute all tool calls and collect results
      const toolResults = await Promise.all(
        toolCalls.map(async (tc) => {
          const result = await executeToolCall(tc, agentId, sendEvent);
          return { role: "tool", tool_call_id: tc.id, content: result };
        })
      );
      messages.push(...toolResults);
      continue;
    }

    // finish_reason = "stop" (or length/unknown) — we're done
    finalText = textContent;
    break;
  }

  // Persist to history
  if (agent?.settings?.continuity !== false) {
    const nowMs = Date.now();
    history.push({ role: "user", content: userMessage, createdAt: nowMs, timestamp: nowMs });
    history.push({ role: "assistant", content: finalText, createdAt: nowMs, timestamp: nowMs });
    saveHistoryToDisk();
  }

  return finalText;
}

// ---------------------------------------------------------------------------
// Frame builders
// ---------------------------------------------------------------------------

function resOk(id, payload) { return { type: "res", id, ok: true, payload: payload ?? {} }; }
function resErr(id, code, message) { return { type: "res", id, ok: false, error: { code, message } }; }

// ---------------------------------------------------------------------------
// Method handlers
// ---------------------------------------------------------------------------

async function handleMethod(method, params, id, sendEvent) {
  const p = params || {};

  switch (method) {
    // --- Agent management ---------------------------------------------------

    case "agents.list": {
      try {
        const dbAgents = await mongoDb.getAgentsFromDb();
        if (Array.isArray(dbAgents) && dbAgents.length > 0) {
          for (const a of dbAgents) {
            if (!a || !a.id) continue;
            const existing = agentRegistry.get(a.id);
            agentRegistry.set(a.id, {
              ...(existing || {}),
              ...a,
              settings: { ...(existing?.settings || {}), ...(a.settings || {}) },
            });
          }
        }
      } catch (err) {
        console.warn("[hermes-adapter] Could not refresh agents from MongoDB in agents.list:", sanitizeErrorMessage(err));
      }
      const allAgents = [...agentRegistry.values()].map((agent) => ({
        id: agent.id, name: agent.name, workspace: agent.workspace,
        identity: { name: agent.name, emoji: "🤖" },
        role: agent.role,
        teamId: agent.teamId || null,
      }));
      return resOk(id, { defaultId: AGENT_ID, mainKey: MAIN_KEY, agents: allAgents, teams: [...teamRegistry.values()] });
    }

    case "agents.create": {
      const agentName = (typeof p.name === "string" && p.name.trim()) ? p.name.trim() : "Agent";
      const slug = agentName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      const newId = `${slug}-${randomId().slice(0, 6)}`;
      const workspace = (typeof p.workspace === "string" && p.workspace)
        ? p.workspace : `${HOME}/.hermes/workspace-${slug}`;
      const newAgent = {
        id: newId, name: agentName, workspace,
        role: "", systemPrompt: `You are ${agentName}.`,
        settings: { wipe: false, continuity: true, model: HERMES_MODEL, mode: "yolo", yolo: true },
      };
      agentRegistry.set(newId, newAgent);
      try { fs.mkdirSync(workspace, { recursive: true }); } catch {}
      saveAgentsToDisk();
      try {
        await mongoDb.upsertAgentRecord(newAgent);
      } catch (err) {
        console.warn(`[hermes-adapter] Could not upsert agent ${newId} to MongoDB:`, sanitizeErrorMessage(err));
      }
      return resOk(id, { agentId: newId, name: agentName, workspace });
    }

    case "agents.delete": {
      const delId = typeof p.agentId === "string" ? p.agentId : "";
      if (delId && delId !== AGENT_ID) {
        agentRegistry.delete(delId);
        clearHistory(`agent:${delId}:${MAIN_KEY}`);
        saveAgentsToDisk();
        try {
          await mongoDb.deleteAgentRecord(delId);
        } catch (err) {
          console.warn(`[hermes-adapter] Could not delete agent ${delId} from MongoDB:`, sanitizeErrorMessage(err));
        }
      }
      return resOk(id, { ok: true, removedBindings: 0 });
    }

    case "agents.update": {
      const updId = typeof p.agentId === "string" ? p.agentId : "";
      const existing = agentRegistry.get(updId);
      if (existing) {
        if (typeof p.name === "string" && p.name.trim()) existing.name = p.name.trim();
        if (typeof p.workspace === "string" && p.workspace.trim()) existing.workspace = p.workspace.trim();
        if (typeof p.role === "string") existing.role = p.role.trim();
        if (typeof p.teamId === "string") existing.teamId = p.teamId.trim() || null;
        saveAgentsToDisk();
        try {
          await mongoDb.upsertAgentRecord(existing);
        } catch (err) {
          console.warn(`[hermes-adapter] Could not upsert updated agent ${updId} to MongoDB:`, sanitizeErrorMessage(err));
        }
      }
      return resOk(id, { ok: true, removedBindings: 0 });
    }

    // --- Team management -----------------------------------------------------

    case "teams.list": {
      return resOk(id, { teams: [...teamRegistry.values()] });
    }

    case "teams.create": {
      const teamName = (typeof p.name === "string" && p.name.trim()) ? p.name.trim() : "Team";
      const teamSlug = teamName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      const teamId = `team-${teamSlug}-${randomId().slice(0, 4)}`;
      const team = { id: teamId, name: teamName, enabled: true, createdAt: new Date().toISOString() };
      teamRegistry.set(teamId, team);
      saveTeamsToDisk();
      mongoDb.upsertTeam(team).catch(() => {});
      broadcastEvent({ type: "event", event: "teams", payload: { teams: [...teamRegistry.values()] } });
      return resOk(id, { team });
    }

    case "teams.update": {
      const tid = typeof p.teamId === "string" ? p.teamId : "";
      const team = teamRegistry.get(tid);
      if (!team) return resErr(id, "not_found", `Team ${tid} not found`);
      if (typeof p.name === "string" && p.name.trim()) team.name = p.name.trim();
      if (typeof p.enabled === "boolean") team.enabled = p.enabled;
      saveTeamsToDisk();
      mongoDb.upsertTeam(team).catch(() => {});
      broadcastEvent({ type: "event", event: "teams", payload: { teams: [...teamRegistry.values()] } });
      return resOk(id, { team });
    }

    case "teams.delete": {
      const dtid = typeof p.teamId === "string" ? p.teamId : "";
      teamRegistry.delete(dtid);
      for (const agent of agentRegistry.values()) {
        if (agent.teamId === dtid) agent.teamId = null;
      }
      saveTeamsToDisk();
      saveAgentsToDisk();
      mongoDb.deleteTeam(dtid).catch(() => {});
      broadcastEvent({ type: "event", event: "teams", payload: { teams: [...teamRegistry.values()] } });
      return resOk(id, { ok: true });
    }

    case "teams.toggle": {
      const ttid = typeof p.teamId === "string" ? p.teamId : "";
      const tteam = teamRegistry.get(ttid);
      if (!tteam) return resErr(id, "not_found", `Team ${ttid} not found`);
      tteam.enabled = typeof p.enabled === "boolean" ? p.enabled : !tteam.enabled;
      saveTeamsToDisk();
      mongoDb.upsertTeam(tteam).catch(() => {});
      broadcastEvent({ type: "event", event: "teams", payload: { teams: [...teamRegistry.values()] } });
      broadcastEvent({ type: "event", event: "presence", payload: buildPresencePayload() });
      return resOk(id, { team: tteam });
    }

    case "agents.files.get": {
      const aid = p.agentId || AGENT_ID;
      const name = p.name || "";
      const ws = getAgentWorkspace(aid);
      const targetPath = path.join(ws, name);
      let content = null;
      let filePath = targetPath;
      let missing = true;

      // 1. Fetch from MongoDB first (database is primary source of truth)
      try {
        const dbFile = await mongoDb.getBrainFileFromDb(aid, name);
        if (dbFile && typeof dbFile.content === "string") {
          content = dbFile.content;
          filePath = dbFile.filePath || dbFile.path || targetPath;
          missing = false;
          agentFiles.set(`${aid}/${name}`, content);
        }
      } catch (err) {
        console.warn(`[hermes-adapter] Error getting brain file from MongoDB for ${aid}/${name}:`, sanitizeErrorMessage(err));
      }

      // 2. If not in DB, fallback to workspace disk file and sync to DB
      if (missing) {
        const diskResult = readAgentBrainFile(aid, name);
        if (!diskResult.missing) {
          content = diskResult.content;
          filePath = diskResult.path;
          missing = false;
          agentFiles.set(`${aid}/${name}`, content);
          mongoDb.upsertBrainFile(aid, name, content, filePath).catch(() => {});
        }
      }

      return resOk(id, {
        workspace: ws,
        file: {
          content: content !== null ? content : "",
          path: filePath,
          missing,
        },
      });
    }

    case "agents.files.set": {
      const aid = p.agentId || AGENT_ID;
      const name = p.name || "";
      const content = typeof p.content === "string" ? p.content : "";
      writeAgentBrainFileToDisk(aid, name, content);
      const ws = getAgentWorkspace(aid);
      const targetPath = path.join(ws, name);
      try {
        await mongoDb.upsertBrainFile(aid, name, content, targetPath);
      } catch (err) {
        console.warn(`[hermes-adapter] Could not upsert brain file ${aid}/${name} to MongoDB:`, sanitizeErrorMessage(err));
      }
      return resOk(id, { ok: true });
    }

    // --- Config -------------------------------------------------------------

    case "config.get":
      return resOk(id, { config: { gateway: { reload: { mode: "hot" } } },
        hash: "hermes-adapter", exists: true, path: CONFIG_PATH });

    case "config.patch":
    case "config.set":
      return resOk(id, { hash: "hermes-adapter" });

    // --- Sessions -----------------------------------------------------------

    case "sessions.list": {
      try {
        const dbSessions = await mongoDb.getSessionsFromDb();
        if (Array.isArray(dbSessions)) {
          for (const s of dbSessions) {
            if (s && s.sessionKey) {
              const cur = sessionSettings.get(s.sessionKey) || {};
              sessionSettings.set(s.sessionKey, { ...cur, ...s });
            }
          }
        }
      } catch (err) {
        console.warn("[hermes-adapter] Could not load sessions from MongoDB:", sanitizeErrorMessage(err));
      }
      const sessions = [...agentRegistry.values()].map((agent) => {
        const sessionKey = `agent:${agent.id}:${MAIN_KEY}`;
        const history = getHistory(sessionKey);
        const settings = sessionSettings.get(sessionKey) || {};
        let updatedAt = null;
        if (history.length > 0) {
          const ts = resolveMessageTimestamp(history[history.length - 1]);
          if (ts > 0) updatedAt = ts;
        }
        if (!updatedAt) {
          updatedAt = getSessionCreationTime(sessionKey, agent);
        }
        return {
          key: sessionKey, agentId: agent.id,
          updatedAt,
          displayName: "Main",
          origin: { label: agent.name, provider: "hermes" },
          model: settings.model || agent.settings?.model || HERMES_MODEL,
          modelProvider: "hermes",
          execHost: settings.execHost || "gateway",
          execSecurity: settings.execSecurity || "full",
          execAsk: settings.execAsk || "off",
          yolo: true,
        };
      });
      return resOk(id, { sessions });
    }

    case "sessions.preview": {
      const keys = Array.isArray(p.keys) ? p.keys : [];
      const limit = typeof p.limit === "number" ? p.limit : 8;
      const maxChars = typeof p.maxChars === "number" ? p.maxChars : 240;
      const previews = await Promise.all(
        keys.map(async (key) => {
          let history = getHistory(key);
          if (history.length === 0) {
            try {
              const dbMsgs = await mongoDb.getLatestMessages(key, limit);
              if (Array.isArray(dbMsgs) && dbMsgs.length > 0) {
                history = dbMsgs;
              }
            } catch {}
          }
          if (history.length === 0) return { key, status: "empty", items: [] };
          const items = history.slice(-limit).map((msg) => ({
            role: msg.role === "assistant" ? "assistant" : "user",
            text: String(msg.content || "").slice(0, maxChars),
            timestamp: resolveMessageTimestamp(msg),
          }));
          return { key, status: "ok", items };
        })
      );
      return resOk(id, { ts: Date.now(), previews });
    }

    case "sessions.patch": {
      const key = typeof p.key === "string" ? p.key : MAIN_SESSION_KEY;
      const current = sessionSettings.get(key) || {};
      const next = { ...current };
      if (p.model !== undefined) next.model = typeof p.model === "string" ? p.model.trim() : p.model;
      if (p.thinkingLevel !== undefined) next.thinkingLevel = p.thinkingLevel;
      if (p.execHost !== undefined) next.execHost = p.execHost;
      if (p.execSecurity !== undefined) next.execSecurity = p.execSecurity;
      if (p.execAsk !== undefined) next.execAsk = p.execAsk;
      sessionSettings.set(key, next);
      saveSessionsToDisk();
      try {
        await mongoDb.upsertSessionRecord(key, next);
      } catch (err) {
        console.warn(`[hermes-adapter] Could not upsert session ${key} to MongoDB:`, sanitizeErrorMessage(err));
      }
      const resolvedModel = await resolveHermesModel(next.model || HERMES_MODEL);
      return resOk(id, { ok: true, key, entry: { thinkingLevel: next.thinkingLevel },
        resolved: { model: resolvedModel, modelProvider: "hermes" } });
    }

    case "sessions.reset": {
      const key = typeof p.key === "string" ? p.key : (typeof p.sessionKey === "string" ? p.sessionKey : MAIN_SESSION_KEY);
      clearHistory(key);
      await mongoDb.deleteChatMessages(key);
      try {
        await mongoDb.deleteSessionRecord(key);
      } catch (err) {
        console.warn(`[hermes-adapter] Could not delete session ${key} from MongoDB:`, sanitizeErrorMessage(err));
      }
      return resOk(id, { ok: true, sessionKey: key });
    }

    case "chat.clear": {
      const key = typeof p.sessionKey === "string" ? p.sessionKey : (typeof p.key === "string" ? p.key : MAIN_SESSION_KEY);
      clearHistory(key);
      await mongoDb.deleteChatMessages(key);
      broadcastEvent({
        type: "event",
        event: "chat.cleared",
        payload: { sessionKey: key }
      });
      return resOk(id, { ok: true, sessionKey: key });
    }

    // --- Chat ---------------------------------------------------------------

    case "chat.send": {
      const sessionKey = typeof p.sessionKey === "string" ? p.sessionKey : MAIN_SESSION_KEY;
      const userMessage = typeof p.message === "string" ? p.message.trim() : String(p.message || "").trim();
      const runId = (typeof p.idempotencyKey === "string" && p.idempotencyKey) ? p.idempotencyKey : randomId();

      if (!userMessage) return resOk(id, { status: "no-op", runId });

      // Resolve which agent owns this session
      const sessionAgentId = sessionKey.startsWith("agent:") ? sessionKey.split(":")[1] : AGENT_ID;
      const agent = agentRegistry.get(sessionAgentId);
      const isOrchestrator = sessionAgentId === AGENT_ID;

      {
        const sendAgent = agentRegistry.get(sessionAgentId);
        if (sendAgent && sendAgent.teamId) {
          const agentTeam = teamRegistry.get(sendAgent.teamId);
          if (agentTeam && !agentTeam.enabled) {
            return resErr(id, "team_disabled", `Agent ${sendAgent.name} is part of disabled team "${agentTeam.name}". Enable the team first.`);
          }
        }
      }

      await mongoDb.saveChatMessage({ sessionKey, agentId: sessionAgentId, role: "user", content: userMessage, runId });

      let aborted = false;
      let onTextDelta = null;
      activeRuns.set(runId, {
        runId,
        sessionKey,
        agentId: sessionAgentId,
        abort() {
          aborted = true;
          if (onTextDelta?.cancel) onTextDelta.cancel();
        },
      });
      teamManager.markBusy(sessionAgentId, runId);

      setImmediate(async () => {
        const model = (sessionSettings.get(sessionKey) || {}).model
          || agent?.settings?.model || HERMES_MODEL;
        let seqCounter = 0;

        const emitChat = (state, extra) => {
          sendEvent({ type: "event", event: "chat", seq: seqCounter++,
            payload: { runId, sessionKey, state, ...extra } });
        };

        onTextDelta = createThrottledDeltaEmitter((partial) => {
          if (!aborted) emitChat("delta", { message: { role: "assistant", content: partial } });
        }, CHAT_STREAM_THROTTLE_MS);

        try {
          // Tool availability: every agent gets subagent_spawn; orchestrator gets full team tools
          const tools = isOrchestrator ? TEAM_TOOLS : SPECIALIST_TOOLS;

          const finalText = await runAgenticLoop({
            sessionKey, agentId: sessionAgentId, userMessage,
            model, tools, emitDelta: onTextDelta,
            abortCheck: () => aborted, sendEvent,
          });

          onTextDelta.cancel();

          if (aborted) {
            emitChat("aborted", {});
          } else {
            const finalContent = finalText;
            await mongoDb.saveChatMessage({ sessionKey, agentId: sessionAgentId, role: "assistant", content: finalContent, runId });
            emitChat("final", { stopReason: "end_turn",
              message: { role: "assistant", content: finalText } });
            sendEvent({ type: "event", event: "presence", seq: seqCounter++,
              payload: buildPresencePayload({
                recent: [{ key: sessionKey, updatedAt: Date.now() }],
                byAgent: [{ agentId: sessionAgentId, recent: [{ key: sessionKey, updatedAt: Date.now() }] }],
              }) });
          }
        } catch (err) {
          if (onTextDelta?.cancel) onTextDelta.cancel();
          if (!aborted) emitChat("error", { errorMessage: sanitizeErrorMessage(err) || "Hermes API error" });
          else emitChat("aborted", {});
        } finally {
          if (onTextDelta?.cancel) onTextDelta.cancel();
          activeRuns.delete(runId);
          teamManager.clearBusy(sessionAgentId, runId);
        }
      });

      return resOk(id, { status: "started", runId });
    }

    case "chat.abort": {
      const runId = typeof p.runId === "string" ? p.runId.trim() : "";
      const sessionKey = typeof p.sessionKey === "string" ? p.sessionKey.trim() : "";
      let aborted = 0;
      if (runId) {
        const handle = activeRuns.get(runId);
        if (handle) {
          handle.abort();
          activeRuns.delete(runId);
          aborted += 1;
        }
      } else if (sessionKey) {
        for (const [activeRunId, handle] of activeRuns.entries()) {
          if (handle.sessionKey !== sessionKey) continue;
          handle.abort();
          activeRuns.delete(activeRunId);
          aborted += 1;
        }
      }
      return resOk(id, { ok: true, aborted });
    }

    case "chat.history": {
      const histKey = typeof p.sessionKey === "string" ? p.sessionKey : MAIN_SESSION_KEY;
      const limit = typeof p.limit === "number" && p.limit > 0 ? p.limit : 10;
      const dbMessages = await mongoDb.getLatestMessages(histKey, limit);
      const messages = dbMessages !== null ? dbMessages : getHistory(histKey).slice(-limit);
      return resOk(id, { sessionKey: histKey, messages });
    }

    case "agent.wait": {
      const { runId, timeoutMs = 30000 } = p;
      const start = Date.now();
      while (activeRuns.has(runId) && Date.now() - start < timeoutMs) {
        await new Promise((r) => setTimeout(r, 100));
      }
      return resOk(id, { status: activeRuns.has(runId) ? "running" : "done" });
    }

    // --- Approvals ----------------------------------------------------------

    case "exec.approvals.get": {
      const agentsMap = {};
      for (const aid of agentRegistry.keys()) {
        agentsMap[aid] = { security: "full", ask: "off" };
      }
      return resOk(id, {
        path: "", exists: true, hash: "hermes-approvals",
        file: {
          version: 1,
          defaults: { security: "full", ask: "off", autoAllowSkills: true },
          agents: agentsMap,
        },
      });
    }

    case "exec.approvals.set":
      return resOk(id, { hash: "hermes-approvals" });

    case "exec.approval.resolve":
      return resOk(id, { ok: true });

    // --- Status & heartbeat -------------------------------------------------

    case "status": {
      const recent = [...agentRegistry.keys()].flatMap((aid) => {
        const sessionKey = `agent:${aid}:${MAIN_KEY}`;
        const h = getHistory(sessionKey);
        let updatedAt = null;
        if (h.length > 0) {
          const ts = resolveMessageTimestamp(h[h.length - 1]);
          if (ts > 0) updatedAt = ts;
        }
        if (!updatedAt) {
          updatedAt = getSessionCreationTime(sessionKey, agentRegistry.get(aid));
        }
        return updatedAt ? [{ key: sessionKey, updatedAt }] : [];
      });
      return resOk(id, { sessions: { recent,
        byAgent: [...agentRegistry.keys()].map((aid) => ({
          agentId: aid,
          recent: recent.filter((r) => r.key.includes(`:${aid}:`)),
        })) } });
    }

    case "wake":
      return resOk(id, { ok: true });

    // --- Skills & models ----------------------------------------------------

    case "skills.status": {
      const targetAgentId = (typeof p.agentId === "string" && p.agentId.trim()) ? p.agentId.trim() : AGENT_ID;
      const ws = getAgentWorkspace(targetAgentId);
      const managedSkillsDir = path.join(ws, "skills");
      return resOk(id, {
        workspaceDir: ws,
        managedSkillsDir,
        skills: [],
      });
    }

    case "skills.writePackaged": {
      const targetAgentId = (typeof p.agentId === "string" && p.agentId.trim()) ? p.agentId.trim() : AGENT_ID;
      const ws = getAgentWorkspace(targetAgentId);
      const skillKey = typeof p.skillKey === "string" ? p.skillKey.trim() : "";
      const files = Array.isArray(p.files) ? p.files : [];
      if (!skillKey) {
        return resErr(id, "invalid_params", "skillKey is required.");
      }
      const targetSkillDir = path.join(ws, "skills", skillKey);
      try {
        fs.mkdirSync(targetSkillDir, { recursive: true });
        for (const file of files) {
          if (!file || typeof file.relativePath !== "string" || typeof file.content !== "string") continue;
          const filePath = path.join(targetSkillDir, file.relativePath);
          fs.mkdirSync(path.dirname(filePath), { recursive: true });
          fs.writeFileSync(filePath, file.content, "utf8");
        }
        return resOk(id, { ok: true, skillKey, installedPath: targetSkillDir });
      } catch (err) {
        return resErr(id, "write_error", sanitizeErrorMessage(err));
      }
    }

    case "skills.update":
      return resOk(id, { ok: true, skillKey: p.skillKey });

    case "skills.install":
      return resOk(id, { ok: true, message: "installed", stdout: "", stderr: "", code: 0 });

    case "models.list":
      try {
        const models = await fetchHermesModels();
        return resOk(id, {
          models: (models.length > 0 ? models : [HERMES_MODEL]).map((modelId) => ({
            id: modelId,
            name: modelId,
          })),
        });
      } catch {
        return resOk(id, { models: [{ id: HERMES_MODEL, name: HERMES_MODEL }] });
      }

    case "tasks.list":
      return resOk(id, { tasks: teamManager.listTasks() });

    // --- Cron jobs ----------------------------------------------------------

    case "cron.list": {
      const includeDisabled = p.includeDisabled !== false;
      const jobs = [...cronJobs.values()];
      return resOk(id, { jobs: includeDisabled ? jobs : jobs.filter((j) => j.enabled) });
    }

    case "cron.add": {
      const jobId = randomId();
      const job = {
        id: jobId, name: typeof p.name === "string" ? p.name : "Cron Job",
        agentId: typeof p.agentId === "string" ? p.agentId : AGENT_ID,
        sessionKey: typeof p.sessionKey === "string" ? p.sessionKey : MAIN_SESSION_KEY,
        description: typeof p.description === "string" ? p.description : "",
        enabled: p.enabled !== false, deleteAfterRun: Boolean(p.deleteAfterRun),
        updatedAtMs: Date.now(), schedule: p.schedule || { kind: "every", everyMs: 3600000 },
        sessionTarget: p.sessionTarget || "main", wakeMode: p.wakeMode || "next-heartbeat",
        payload: p.payload || { kind: "systemEvent", text: "tick" }, state: {},
      };
      cronJobs.set(jobId, job);
      return resOk(id, job);
    }

    case "cron.remove": {
      const jobId = typeof p.id === "string" ? p.id : "";
      return resOk(id, { ok: true, removed: cronJobs.delete(jobId) });
    }

    case "cron.patch": {
      const jobId = typeof p.id === "string" ? p.id : "";
      const job = cronJobs.get(jobId);
      if (!job) return resOk(id, { ok: false, error: "not_found" });
      const updated = { ...job };
      if (p.enabled !== undefined) updated.enabled = Boolean(p.enabled);
      if (p.name !== undefined) updated.name = String(p.name);
      if (p.schedule !== undefined) updated.schedule = p.schedule;
      if (p.payload !== undefined) updated.payload = p.payload;
      updated.updatedAtMs = Date.now();
      cronJobs.set(jobId, updated);
      return resOk(id, { ok: true, job: updated });
    }

    case "cron.run": {
      const jobId = typeof p.id === "string" ? p.id : "";
      const job = cronJobs.get(jobId);
      if (!job) return resOk(id, { ok: false });
      cronJobs.set(jobId, { ...job, state: { ...job.state, runningAtMs: Date.now() } });
      setTimeout(() => {
        const current = cronJobs.get(jobId);
        if (!current) return;
        const done = { ...current, state: { ...current.state, runningAtMs: undefined, lastRunAtMs: Date.now(), lastStatus: "ok" } };
        cronJobs.set(jobId, done);
        broadcastEvent({ type: "event", event: "cron", payload: { action: "finished", jobId, status: "ok", summary: done } });
      }, 3000);
      return resOk(id, { ok: true, ran: true });
    }

    default:
      console.warn(`[hermes-adapter] Unhandled method: ${method}`);
      return resOk(id, {});
  }
}

// ---------------------------------------------------------------------------
// WebSocket server
// ---------------------------------------------------------------------------

function startAdapter() {
  const httpServer = http.createServer(async (req, res) => {
    try {
      if (await handleTeamHttp(req, res)) return;
    } catch (err) {
      console.error("[hermes-adapter] team http error:", sanitizeErrorMessage(err));
      if (!res.headersSent) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end('{"ok":false,"error":"internal"}');
      }
      return;
    }
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("Hermes Gateway Adapter – OK\n");
  });

  const wss = new WebSocketServer({ server: httpServer });
  wss.on("error", (err) => {
    if (err.code !== "EADDRINUSE") console.error("[hermes-adapter] Server error:", sanitizeErrorMessage(err));
  });

  wss.on("connection", (ws) => {
    let connected = false;
    let globalSeq = 0;

    const send = (frame) => {
      if (ws.readyState === ws.OPEN) {
        try { ws.send(JSON.stringify(frame)); }
        catch (e) { console.error("[hermes-adapter] send error:", sanitizeErrorMessage(e)); }
      }
    };

    // Register this connection's send function for broadcasts
    const sendEventFn = (frame) => {
      if (frame.type === "event" && typeof frame.seq !== "number") frame.seq = globalSeq++;
      send(frame);
    };
    activeSendEventFns.add(sendEventFn);

    send({ type: "event", event: "connect.challenge", payload: { nonce: randomId() } });

    ws.on("message", async (raw) => {
      let frame;
      try { frame = JSON.parse(raw.toString("utf8")); } catch { return; }
      if (!frame || typeof frame !== "object" || frame.type !== "req") return;
      const { id, method, params } = frame;
      if (typeof id !== "string" || typeof method !== "string") return;

      if (method === "connect") {
        connected = true;
        const allAgents = [...agentRegistry.values()].map((a) => ({ agentId: a.id, name: a.name, isDefault: a.id === AGENT_ID }));
        send({
          type: "res", id, ok: true,
          payload: {
            type: "hello-ok", protocol: 3,
            adapterType: "hermes",
            features: { methods: ["agents.list","agents.create","agents.delete","agents.update",
              "teams.list","teams.create","teams.update","teams.delete","teams.toggle",
              "sessions.list","sessions.preview","sessions.patch","sessions.reset",
              "chat.send","chat.abort","chat.history","chat.clear","agent.wait",
              "status","config.get","config.set","config.patch",
              "agents.files.get","agents.files.set",
              "exec.approvals.get","exec.approvals.set","exec.approval.resolve",
              "wake","skills.status","models.list",
              "tasks.list",
              "cron.list","cron.add","cron.remove","cron.patch","cron.run"],
              events: ["chat","presence","heartbeat","cron","chat.cleared","teams"] },
            snapshot: { health: { agents: allAgents, defaultAgentId: AGENT_ID },
              sessionDefaults: { mainKey: MAIN_KEY } },
            auth: { role: "operator", scopes: ["operator.admin","operator.approvals"] },
            policy: { tickIntervalMs: 30000 },
          },
        });
        return;
      }

      if (!connected) { send(resErr(id, "not_connected", "Send connect first.")); return; }

      try {
        const response = await handleMethod(method, params, id, sendEventFn);
        send(response);
      } catch (err) {
        const message = sanitizeErrorMessage(err);
        console.error(`[hermes-adapter] Error handling ${method}:`, message);
        send(resErr(id, "internal_error", message || "Internal error"));
      }
    });

    ws.on("close", () => activeSendEventFns.delete(sendEventFn));
    ws.on("error", (err) => {
      console.error("[hermes-adapter] WebSocket error:", sanitizeErrorMessage(err));
      activeSendEventFns.delete(sendEventFn);
    });
  });

  httpServer.listen(ADAPTER_PORT, "127.0.0.1", () => {
    console.log(`\n[hermes-adapter] ✓ Listening on ws://localhost:${ADAPTER_PORT}`);
    console.log(`[hermes-adapter] ✓ Forwarding to Hermes API at ${HERMES_API_URL}`);
    console.log(`[hermes-adapter] ✓ Model: ${HERMES_MODEL}`);
    console.log(`[hermes-adapter] ✓ Multi-agent orchestration: ENABLED`);
    console.log(`[hermes-adapter] ✓ Team API: ${HERMES3D_TEAM_TOKEN ? "enabled" : "DISABLED (HERMES3D_TEAM_TOKEN unset)"}`);
    console.log(`\nOpen Hermes3D → ws://localhost:${ADAPTER_PORT}\n`);
  });

  httpServer.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.error(`[hermes-adapter] Port ${ADAPTER_PORT} in use. Set HERMES_ADAPTER_PORT to change it.`);
    } else {
      console.error("[hermes-adapter] Server error:", sanitizeErrorMessage(err));
    }
    process.exit(1);
  });
}

if (require.main === module) {
  (async () => {
    loadHistoryFromDisk();
    if (closeDanglingTurns(conversationHistory) > 0) saveHistoryToDisk();
    try {
      await loadBrainSettingsFromDisk();
    } catch (err) {
      console.warn("[hermes-adapter] Error synchronizing brain settings with MongoDB:", sanitizeErrorMessage(err));
    }
    startAdapter();
  })();
}

module.exports = {
  createThrottledDeltaEmitter,
  CHAT_STREAM_THROTTLE_MS,
  startAdapter,
  handleMethod,
  streamOneTurn,
  execDelegateTask,
  executeToolCall,
  agentRegistry,
  teamRegistry,
  DEFAULT_TEAM_IT_ID,
  DEFAULT_TEAM_IT_AGENT_IDS,
  seedTeamItIfNeeded,
  loadBrainSettingsFromDisk,
  saveTeamsToDisk,
  saveAgentsToDisk,
};
