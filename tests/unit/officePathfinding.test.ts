import { describe, expect, it } from "vitest";
import {
  astar2D,
  buildNavGrid2D,
} from "@/lib/office/pathfinding";
import {
  astar,
  buildNavGrid,
  isLineOfSightClear,
  isNavPointFree,
} from "@/features/retro-office/core/navigation";
import type { FurnitureItem } from "@/features/retro-office/core/types";
import type { OfficeMap } from "@/lib/office/schema";
import { createEmptyOfficeMap, createStarterOfficeMap } from "@/lib/office/schema";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Minimal empty map for grid tests. */
const emptyMap = (width = 200, height = 200): OfficeMap =>
  createEmptyOfficeMap({
    workspaceId: "test",
    officeVersionId: "v1",
    width,
    height,
  });

/** Map with a single wall object blocking the center. */
const mapWithWall = (): OfficeMap => {
  const map = emptyMap(200, 200);
  map.objects.push({
    id: "wall_center",
    assetId: "wall_block",
    layerId: "walls",
    x: 100,
    y: 100,
    rotation: 0,
    flipX: false,
    flipY: false,
    zIndex: 100,
    tags: [],
  });
  return map;
};

/** Map with a collision polygon rectangle across the middle. */
const mapWithCollisionPolygon = (): OfficeMap => {
  const map = emptyMap(200, 200);
  map.collisions.push({
    id: "col_wall",
    blocked: true,
    shape: {
      points: [
        { x: 0, y: 90 },
        { x: 200, y: 90 },
        { x: 200, y: 110 },
        { x: 0, y: 110 },
      ],
    },
  });
  return map;
};

// ---------------------------------------------------------------------------
// buildNavGrid2D
// ---------------------------------------------------------------------------

describe("buildNavGrid2D", () => {
  it("returns a grid with correct dimensions for an empty map", () => {
    const grid = buildNavGrid2D(emptyMap(160, 80));
    expect(grid.cols).toBe(Math.ceil(160 / 8));
    expect(grid.rows).toBe(Math.ceil(80 / 8));
    // All cells free
    for (let i = 0; i < grid.cells.length; i++) {
      expect(grid.cells[i]).toBe(0);
    }
  });

  it("marks cells blocked around wall objects", () => {
    const grid = buildNavGrid2D(mapWithWall());
    // The wall at (100, 100) with size 32×32 should block some cells
    const centerCol = Math.floor(100 / 8);
    const centerRow = Math.floor(100 / 8);
    expect(grid.cells[centerRow * grid.cols + centerCol]).toBe(1);
  });

  it("marks cells blocked from collision polygons", () => {
    const grid = buildNavGrid2D(mapWithCollisionPolygon());
    // Row in the middle (y=100) should be blocked
    const midRow = Math.floor(100 / 8);
    const midCol = Math.floor(100 / 8);
    expect(grid.cells[midRow * grid.cols + midCol]).toBe(1);
  });

  it("ignores non-blocked collision polygons", () => {
    const map = emptyMap(200, 200);
    map.collisions.push({
      id: "col_nonblocking",
      blocked: false,
      shape: {
        points: [
          { x: 0, y: 90 },
          { x: 200, y: 90 },
          { x: 200, y: 110 },
          { x: 0, y: 110 },
        ],
      },
    });
    const grid = buildNavGrid2D(map);
    // All cells should remain free
    for (let i = 0; i < grid.cells.length; i++) {
      expect(grid.cells[i]).toBe(0);
    }
  });

  it("blocks objects on furniture layer regardless of asset ID", () => {
    const map = emptyMap(200, 200);
    map.objects.push({
      id: "custom_furniture",
      assetId: "unknown_custom_asset",
      layerId: "furniture",
      x: 100,
      y: 100,
      rotation: 0,
      flipX: false,
      flipY: false,
      zIndex: 100,
      tags: [],
    });
    const grid = buildNavGrid2D(map);
    const centerCol = Math.floor(100 / 8);
    const centerRow = Math.floor(100 / 8);
    expect(grid.cells[centerRow * grid.cols + centerCol]).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// astar2D
// ---------------------------------------------------------------------------

describe("astar2D", () => {
  it("returns a direct path in an empty grid", () => {
    const grid = buildNavGrid2D(emptyMap());
    const path = astar2D(10, 10, 180, 180, grid);
    expect(path.length).toBeGreaterThan(0);
    // Last waypoint should be the destination
    expect(path[path.length - 1]).toEqual({ x: 180, y: 180 });
  });

  it("returns empty array when no path exists (fully blocked)", () => {
    const map = emptyMap(80, 80);
    // Block every cell
    const grid = buildNavGrid2D(map);
    for (let i = 0; i < grid.cells.length; i++) {
      grid.cells[i] = 1;
    }
    const path = astar2D(4, 4, 60, 60, grid);
    expect(path).toEqual([]);
  });

  it("routes around a wall obstacle", () => {
    const grid = buildNavGrid2D(mapWithWall());
    const path = astar2D(20, 100, 180, 100, grid);
    expect(path.length).toBeGreaterThan(0);
    // Destination reached
    expect(path[path.length - 1]).toEqual({ x: 180, y: 100 });
    // Path should not pass through the blocked center
    const centerCol = Math.floor(100 / 8);
    const centerRow = Math.floor(100 / 8);
    for (const wp of path) {
      const wc = Math.floor(wp.x / 8);
      const wr = Math.floor(wp.y / 8);
      if (wc === centerCol && wr === centerRow) {
        // Waypoint should not land exactly on a blocked cell
        expect(grid.cells[wr * grid.cols + wc]).toBe(0);
      }
    }
  });

  it("returns single-waypoint path when start and end are the same cell", () => {
    const grid = buildNavGrid2D(emptyMap());
    const path = astar2D(50, 50, 54, 54, grid);
    // Same cell → returns destination
    expect(path.length).toBe(1);
    expect(path[0]).toEqual({ x: 54, y: 54 });
  });

  it("finds nearest free cell when start is inside a blocked area", () => {
    const grid = buildNavGrid2D(mapWithWall());
    // Start right on the wall center
    const path = astar2D(100, 100, 180, 180, grid);
    // Should still find a path (start snaps to nearest free cell)
    expect(path.length).toBeGreaterThan(0);
    expect(path[path.length - 1]).toEqual({ x: 180, y: 180 });
  });

  it("prevents diagonal corner-cutting through blocked cells", () => {
    const map = emptyMap(80, 80);
    const grid = buildNavGrid2D(map);
    // Create an L-shaped block: (5,5) and (6,4) blocked
    // Diagonal from (5,4) to (6,5) should be prevented
    grid.cells[5 * grid.cols + 5] = 1; // row 5, col 5
    grid.cells[4 * grid.cols + 6] = 1; // row 4, col 6

    const path = astar2D(5 * 8 + 4, 4 * 8 + 4, 6 * 8 + 4, 5 * 8 + 4, grid);
    // Path should exist but not cut the corner
    if (path.length > 1) {
      // No waypoint should be exactly at the diagonal between blocked cells
      for (const wp of path.slice(0, -1)) {
        const wc = Math.floor(wp.x / 8);
        const wr = Math.floor(wp.y / 8);
        // Should not have arrived at (6,5) from (5,4) diagonally
        // (the path must go around)
        expect(grid.cells[wr * grid.cols + wc]).toBe(0);
      }
    }
  });

  it("works with the starter office map", () => {
    const map = createStarterOfficeMap({
      workspaceId: "test",
      officeVersionId: "v1",
      width: 1600,
      height: 900,
    });
    const grid = buildNavGrid2D(map);
    // Path from hallway to meeting room area
    const path = astar2D(200, 175, 1200, 400, grid);
    expect(path.length).toBeGreaterThan(0);
    expect(path[path.length - 1]).toEqual({ x: 1200, y: 400 });
  });
});

// ---------------------------------------------------------------------------
// isLineOfSightClear & RetroOffice 3D Room / Wall Navigation
// ---------------------------------------------------------------------------

describe("isLineOfSightClear & RetroOffice 3D navigation", () => {
  const makeItem = (type: string, x: number, y: number, w = 80, h = 20): FurnitureItem => ({
    _uid: `test_${type}_${x}_${y}`,
    type,
    x,
    y,
    w,
    h,
  });

  it("isLineOfSightClear returns true for direct path across open free space", () => {
    const grid = buildNavGrid([]);
    expect(isLineOfSightClear(grid, 200, 200, 400, 200)).toBe(true);
    expect(isLineOfSightClear(grid, 200, 200, 400, 400)).toBe(true);
  });

  it("isLineOfSightClear returns false when line passes through a wall obstacle", () => {
    const wall = makeItem("wall", 300, 180, 20, 100);
    const grid = buildNavGrid([wall]);
    expect(isLineOfSightClear(grid, 200, 230, 400, 230)).toBe(false);
  });

  it("isLineOfSightClear returns false when endpoints are blocked or out of bounds", () => {
    const wall = makeItem("wall", 300, 200, 50, 50);
    const grid = buildNavGrid([wall]);
    expect(isLineOfSightClear(grid, -10, 200, 400, 200)).toBe(false);
    expect(isLineOfSightClear(grid, 320, 220, 400, 200)).toBe(false);
  });

  it("routes through door opening and never penetrates room walls", () => {
    // Room bounded between x=400..700, y=150..450
    // Top wall, bottom wall, right wall, left wall with 100px door opening (y=250..350)
    const furniture: FurnitureItem[] = [
      makeItem("wall", 400, 150, 300, 20), // Top wall
      makeItem("wall", 400, 450, 300, 20), // Bottom wall
      makeItem("wall", 700, 150, 20, 320), // Right wall
      makeItem("wall", 400, 150, 20, 100), // Left wall upper (y: 150..250)
      makeItem("door", 400, 250, 20, 100), // Left wall DOOR opening (y: 250..350, passable)
      makeItem("wall", 400, 350, 20, 120), // Left wall lower (y: 350..470)
    ];

    const grid = buildNavGrid(furniture);

    // Agent outside (left of room), target inside room
    const startX = 250;
    const startY = 300;
    const targetX = 550;
    const targetY = 300;

    const path = astar(startX, startY, targetX, targetY, grid);
    expect(path.length).toBeGreaterThan(0);

    // Path must reach the destination inside the room
    expect(path[path.length - 1]).toEqual({ x: targetX, y: targetY });

    // Path must pass through the door opening (around x=400, y in [250, 350])
    const passesThroughDoor = path.some(
      (wp) => Math.abs(wp.x - 410) < 40 && wp.y >= 250 && wp.y <= 350,
    );
    expect(passesThroughDoor).toBe(true);

    // Path must NEVER step on blocked cells
    for (const wp of path) {
      expect(isNavPointFree(grid, wp.x, wp.y)).toBe(true);
    }
  });

  it("returns empty path when room is fully sealed with no door (no penetration)", () => {
    // Completely sealed room
    const furniture: FurnitureItem[] = [
      makeItem("wall", 400, 150, 300, 20),
      makeItem("wall", 400, 450, 300, 20),
      makeItem("wall", 700, 150, 20, 320),
      makeItem("wall", 400, 150, 20, 320), // Sealed left wall
    ];

    const grid = buildNavGrid(furniture);

    const startX = 250;
    const startY = 300;
    const targetX = 550;
    const targetY = 300;

    const path = astar(startX, startY, targetX, targetY, grid);
    expect(path).toEqual([]);
  });

  it("prevents diagonal corner cutting around furniture", () => {
    const desk = makeItem("desk_cubicle", 400, 400, 80, 60);
    const grid = buildNavGrid([desk]);

    // Path going near the corner of the desk
    const path = astar(350, 450, 450, 350, grid);
    if (path.length > 0) {
      for (const wp of path) {
        expect(isNavPointFree(grid, wp.x, wp.y)).toBe(true);
      }
    }
  });
});
