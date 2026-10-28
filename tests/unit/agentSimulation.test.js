const { AgentSimulationEngine } = require("../../server/agent-simulation");

const mockMap = {
  workspaceId: "test",
  officeVersionId: "1",
  canvas: { width: 400, height: 400 },
  objects: [
    { assetId: "desk_modern", layerId: "furniture", x: 200, y: 200, tags: ["desk"] }
  ],
  collisions: [],
  zones: [
    { type: "desk_zone", shape: { points: [{ x: 100, y: 100 }] } },
    { type: "meeting_room", shape: { points: [{ x: 300, y: 300 }] } },
    { type: "hallway", shape: { points: [{ x: 50, y: 50 }] } }
  ]
};

const engine = new AgentSimulationEngine();
const agents = [
  { agentId: "agent-1", name: "Alice", state: "working" }
];

const positions = engine.update(agents, mockMap, 100);
console.log("Agent 1 coords:", agents[0].x, agents[0].y);

if (typeof agents[0].x === "number" && typeof agents[0].y === "number") {
  console.log("SUCCESS: AgentSimulationEngine runs correctly.");
} else {
  console.error("FAILURE: Invalid coordinates generated.");
  process.exit(1);
}
