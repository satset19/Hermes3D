"use strict";

/**
 * Server-side agent movement & pathfinding simulation engine.
 * Computes grid-based A* paths and updates agent positions (x, y) across ticks
 * so agent movement continues uninterrupted on the backend.
 */

// Grid constants
const DEFAULT_CELL_SIZE = 8;
const DEFAULT_PAD = 4;

const BLOCKING_ASSET_IDS = new Set([
  "desk_modern",
  "meeting_table",
  "wall_block",
  "arcade_machine",
  "coffee_station",
  "tv_wall",
]);

const BLOCKING_TAGS = new Set(["wall", "desk", "table", "obstacle"]);
const BLOCKING_LAYERS = new Set(["walls", "furniture"]);

const ASSET_SIZE = {
  desk_modern: [64, 32],
  meeting_table: [160, 80],
  wall_block: [32, 32],
  arcade_machine: [32, 48],
  coffee_station: [64, 32],
  tv_wall: [80, 10],
  floor_tile: [32, 32],
  plant_potted: [32, 32],
};

function isBlocking(obj) {
  if (!obj) return false;
  if (BLOCKING_LAYERS.has(obj.layerId)) return true;
  if (BLOCKING_ASSET_IDS.has(obj.assetId)) return true;
  if (Array.isArray(obj.tags)) {
    for (const tag of obj.tags) {
      if (BLOCKING_TAGS.has(tag)) return true;
    }
  }
  return false;
}

function getAssetSize(assetId) {
  return ASSET_SIZE[assetId] || [32, 32];
}

function pointInPolygon(px, py, vertices) {
  let inside = false;
  for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
    const xi = vertices[i].x;
    const yi = vertices[i].y;
    const xj = vertices[j].x;
    const yj = vertices[j].y;
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function buildNavGrid2D(map, cellSize = DEFAULT_CELL_SIZE, pad = DEFAULT_PAD) {
  const width = map?.canvas?.width || 800;
  const height = map?.canvas?.height || 600;
  const cols = Math.ceil(width / cellSize);
  const rows = Math.ceil(height / cellSize);
  const cells = new Uint8Array(cols * rows);

  if (Array.isArray(map?.objects)) {
    for (const obj of map.objects) {
      if (!isBlocking(obj)) continue;
      const [w, h] = getAssetSize(obj.assetId);
      const x1 = (obj.x || 0) - w / 2 - pad;
      const y1 = (obj.y || 0) - h / 2 - pad;
      const x2 = (obj.x || 0) + w / 2 + pad;
      const y2 = (obj.y || 0) + h / 2 + pad;

      const c1 = Math.max(0, Math.floor(x1 / cellSize));
      const c2 = Math.min(cols - 1, Math.floor(x2 / cellSize));
      const r1 = Math.max(0, Math.floor(y1 / cellSize));
      const r2 = Math.min(rows - 1, Math.floor(y2 / cellSize));

      for (let r = r1; r <= r2; r++) {
        for (let c = c1; c <= c2; c++) {
          cells[r * cols + c] = 1;
        }
      }
    }
  }

  if (Array.isArray(map?.collisions)) {
    for (const collision of map.collisions) {
      if (!collision.blocked || !collision.shape || !Array.isArray(collision.shape.points)) continue;
      const points = collision.shape.points;
      if (points.length < 3) continue;
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const p of points) {
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
      }
      minX -= pad; minY -= pad; maxX += pad; maxY += pad;
      const c1 = Math.max(0, Math.floor(minX / cellSize));
      const c2 = Math.min(cols - 1, Math.floor(maxX / cellSize));
      const r1 = Math.max(0, Math.floor(minY / cellSize));
      const r2 = Math.min(rows - 1, Math.floor(maxY / cellSize));

      for (let r = r1; r <= r2; r++) {
        for (let c = c1; c <= c2; c++) {
          const px = c * cellSize + cellSize / 2;
          const py = r * cellSize + cellSize / 2;
          if (pointInPolygon(px, py, points)) {
            cells[r * cols + c] = 1;
          }
        }
      }
    }
  }

  return { cells, cols, rows, cellSize };
}

function findFreeCell(c, r, cells, cols, rows) {
  if (!cells[r * cols + c]) return { c, r };
  for (let dist = 1; dist < 12; dist++) {
    for (let dr = -dist; dr <= dist; dr++) {
      for (let dc = -dist; dc <= dist; dc++) {
        if (Math.abs(dr) !== dist && Math.abs(dc) !== dist) continue;
        const nr = r + dr;
        const nc = c + dc;
        if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
        if (!cells[nr * cols + nc]) return { c: nc, r: nr };
      }
    }
  }
  return null;
}

function heapPush(heap, entry) {
  heap.push(entry);
  let i = heap.length - 1;
  while (i > 0) {
    const pi = Math.floor((i - 1) / 2);
    if (heap[pi][1] <= entry[1]) break;
    heap[i] = heap[pi];
    i = pi;
  }
  heap[i] = entry;
}

function heapPop(heap) {
  if (heap.length === 0) return null;
  const first = heap[0];
  const last = heap.pop();
  if (!last || heap.length === 0) return first;
  let i = 0;
  while (true) {
    const li = i * 2 + 1;
    const ri = li + 1;
    if (li >= heap.length) break;
    let si = li;
    if (ri < heap.length && heap[ri][1] < heap[li][1]) si = ri;
    if (heap[si][1] >= last[1]) break;
    heap[i] = heap[si];
    i = si;
  }
  heap[i] = last;
  return first;
}

function astar2D(sx, sy, ex, ey, grid) {
  const { cells, cols, rows, cellSize } = grid;
  const toCell = (x, y) => ({
    c: Math.min(cols - 1, Math.max(0, Math.floor(x / cellSize))),
    r: Math.min(rows - 1, Math.max(0, Math.floor(y / cellSize))),
  });
  const cellCenter = (c, r) => ({
    x: c * cellSize + cellSize / 2,
    y: r * cellSize + cellSize / 2,
  });

  let { c: sc, r: sr } = toCell(sx, sy);
  let { c: ec, r: er } = toCell(ex, ey);

  const startFree = findFreeCell(sc, sr, cells, cols, rows);
  const endFree = findFreeCell(ec, er, cells, cols, rows);
  if (!startFree || !endFree) return [];
  sc = startFree.c; sr = startFree.r;
  ec = endFree.c; er = endFree.r;

  if (sc === ec && sr === er) return [{ x: ex, y: ey }];

  const nodeCount = cols * rows;
  const gCost = new Float32Array(nodeCount).fill(Infinity);
  const parent = new Int32Array(nodeCount).fill(-1);
  const visited = new Uint8Array(nodeCount);
  const startIdx = sr * cols + sc;
  const endIdx = er * cols + ec;
  gCost[startIdx] = 0;

  const open = [];
  const heuristic = (c1, r1, c2, r2) => Math.hypot(c2 - c1, r2 - r1);
  heapPush(open, [startIdx, heuristic(sc, sr, ec, er)]);

  const DIRS = [
    [1, 0, 1],
    [-1, 0, 1],
    [0, 1, 1],
    [0, -1, 1],
    [1, 1, 1.414],
    [1, -1, 1.414],
    [-1, 1, 1.414],
    [-1, -1, 1.414],
  ];

  while (open.length > 0) {
    const entry = heapPop(open);
    if (!entry) break;
    const [current] = entry;
    if (visited[current]) continue;
    visited[current] = 1;

    if (current === endIdx) {
      const path = [];
      let node = current;
      while (node !== startIdx) {
        const c = node % cols;
        const r = Math.floor(node / cols);
        path.push(cellCenter(c, r));
        node = parent[node];
      }
      path.reverse();
      if (path.length > 0) {
        path[path.length - 1] = { x: ex, y: ey };
      } else {
        path.push({ x: ex, y: ey });
      }
      return path;
    }

    const cc = current % cols;
    const cr = Math.floor(current / cols);

    for (const [dc, dr, cost] of DIRS) {
      const nc = cc + dc;
      const nr = cr + dr;
      if (nc < 0 || nc >= cols || nr < 0 || nr >= rows) continue;
      const ni = nr * cols + nc;
      if (visited[ni] || cells[ni]) continue;

      if (dc !== 0 && dr !== 0) {
        if (cells[cr * cols + (cc + dc)] || cells[(cr + dr) * cols + cc]) {
          continue;
        }
      }

      const ng = gCost[current] + cost;
      if (ng < gCost[ni]) {
        gCost[ni] = ng;
        parent[ni] = current;
        heapPush(open, [ni, ng + heuristic(nc, nr, ec, er)]);
      }
    }
  }

  return [];
}

class AgentSimulationEngine {
  constructor() {
    this.agentPositions = new Map(); // agentId -> { x, y, path, pathIndex, lastTargetKey }
    this.navGrid = null;
    this.navGridMapVersion = "";
  }

  resolveTarget(state, zonesByType) {
    const fallback = { x: 120, y: 120 };
    const pickFrom = (zoneType) => {
      const zone = zonesByType.get(zoneType);
      if (!zone || !Array.isArray(zone.shape?.points) || zone.shape.points.length === 0) return fallback;
      const point = zone.shape.points[0];
      return { x: point.x, y: point.y };
    };
    if (state === "working") return pickFrom("desk_zone");
    if (state === "meeting") return pickFrom("meeting_room");
    if (state === "error") return pickFrom("desk_zone");
    return pickFrom("hallway");
  }

  update(agents, map, elapsedMs = 100) {
    if (!map) return this.agentPositions;

    const mapKey = `${map.workspaceId || "default"}:${map.officeVersionId || "1"}`;
    if (mapKey !== this.navGridMapVersion) {
      this.navGrid = buildNavGrid2D(map);
      this.navGridMapVersion = mapKey;
      for (const entry of this.agentPositions.values()) {
        entry.path = [];
        entry.pathIndex = 0;
        entry.lastTargetKey = "";
      }
    }

    const keep = new Set();
    const zonesByType = new Map(
      (map.zones || []).map((zone) => [zone.type, zone])
    );

    for (const agent of agents) {
      const agentId = agent.agentId || agent.id;
      if (!agentId) continue;
      keep.add(agentId);

      let entry = this.agentPositions.get(agentId);
      if (!entry) {
        entry = {
          x: 100 + Math.random() * 50,
          y: 100 + Math.random() * 50,
          path: [],
          pathIndex: 0,
          lastTargetKey: "",
        };
        this.agentPositions.set(agentId, entry);
      }

      const target = this.resolveTarget(agent.state, zonesByType);
      const targetKey = `${target.x}:${target.y}`;

      if (targetKey !== entry.lastTargetKey) {
        entry.lastTargetKey = targetKey;
        if (this.navGrid) {
          entry.path = astar2D(entry.x, entry.y, target.x, target.y, this.navGrid);
        } else {
          entry.path = [];
        }
        entry.pathIndex = 0;
      }

      // Step along path
      this.stepAlongPath(entry, elapsedMs);

      // Attach current simulated position back onto the agent object
      agent.x = entry.x;
      agent.y = entry.y;
    }

    for (const agentId of this.agentPositions.keys()) {
      if (!keep.has(agentId)) {
        this.agentPositions.delete(agentId);
      }
    }

    return this.agentPositions;
  }

  stepAlongPath(entry, elapsedMs) {
    if (!entry.path || entry.path.length === 0 || entry.pathIndex >= entry.path.length) return;
    const wp = entry.path[entry.pathIndex];
    const dx = wp.x - entry.x;
    const dy = wp.y - entry.y;
    const dist = Math.hypot(dx, dy);
    const maxSpeed = 0.05 * elapsedMs;

    if (dist <= maxSpeed) {
      entry.x = wp.x;
      entry.y = wp.y;
      entry.pathIndex += 1;
    } else {
      const step = Math.min(maxSpeed, dist);
      entry.x += (dx / dist) * step;
      entry.y += (dy / dist) * step;
    }
  }
}

module.exports = {
  AgentSimulationEngine,
  buildNavGrid2D,
  astar2D,
};
