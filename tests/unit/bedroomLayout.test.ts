import { describe, expect, it } from "vitest";
import {
  BEDROOM_DOOR_Y,
  BEDROOM_ROOM_END_X,
  BEDROOM_ROOM_WIDTH,
  BEDROOM_ROOM_X,
  CANVAS_H,
  CANVAS_W,
} from "@/features/retro-office/core/constants";
import {
  ITEM_FOOTPRINT,
  ITEM_METADATA,
} from "@/features/retro-office/core/geometry";
import {
  DEFAULT_BEDROOM_ITEMS,
  ensureOfficeBedroom,
  materializeDefaults,
} from "@/features/retro-office/core/furnitureDefaults";
import { buildNavGrid } from "@/features/retro-office/core/navigation";
import type { FurnitureItem } from "@/features/retro-office/core/types";

const isPointBlocked = (grid: Uint8Array, x: number, y: number): boolean => {
  const GRID_CELL = 25;
  const GRID_COLS = Math.ceil(CANVAS_W / GRID_CELL);
  const GRID_ROWS = Math.ceil(CANVAS_H / GRID_CELL);
  const col = Math.floor(x / GRID_CELL);
  const row = Math.floor(y / GRID_CELL);
  if (col < 0 || col >= GRID_COLS || row < 0 || row >= GRID_ROWS) return true;
  return grid[row * GRID_COLS + col] === 1;
};

describe("Bedroom Suite Layout & Navigation", () => {
  it("defines bedroom constants correctly", () => {
    expect(BEDROOM_ROOM_X).toBe(1540);
    expect(BEDROOM_ROOM_WIDTH).toBe(250);
    expect(BEDROOM_ROOM_END_X).toBe(1790);
    expect(BEDROOM_DOOR_Y).toBe(280);
  });

  it("registers bed footprint and navigation metadata", () => {
    expect(ITEM_FOOTPRINT.bed).toEqual([48, 76]);
    expect(ITEM_METADATA.bed).toBeDefined();
    expect(ITEM_METADATA.bed.blocksNavigation).toBe(true);
  });

  it("contains exactly 9 beds in DEFAULT_BEDROOM_ITEMS", () => {
    const beds = DEFAULT_BEDROOM_ITEMS.filter((item) => item.type === "bed");
    expect(beds).toHaveLength(9);
  });

  it("places all 9 beds inside bedroom room bounds", () => {
    const beds = DEFAULT_BEDROOM_ITEMS.filter((item) => item.type === "bed");
    for (const bed of beds) {
      expect(bed.x).toBeGreaterThanOrEqual(BEDROOM_ROOM_X);
      expect(bed.x + 48).toBeLessThanOrEqual(BEDROOM_ROOM_END_X);
      expect(bed.y).toBeGreaterThan(40);
      expect(bed.y).toBeLessThan(680);
    }
  });

  it("encloses bedroom with perimeter walls and a door on the west wall", () => {
    const walls = DEFAULT_BEDROOM_ITEMS.filter((item) => item.type === "wall");
    const doors = DEFAULT_BEDROOM_ITEMS.filter((item) => item.type === "door");
    expect(walls.length).toBeGreaterThanOrEqual(4);
    expect(doors).toHaveLength(1);
    expect(doors[0]).toMatchObject({
      type: "door",
      x: BEDROOM_ROOM_X,
      y: BEDROOM_DOOR_Y,
      facing: 90,
    });
  });

  it("blocks navigation for all 9 beds in buildNavGrid", () => {
    const bedroomFurniture: FurnitureItem[] = DEFAULT_BEDROOM_ITEMS.map((item, index) => ({
      ...item,
      _uid: `bed_test_${index}`,
    }));
    const grid = buildNavGrid(bedroomFurniture);
    const beds = bedroomFurniture.filter((item) => item.type === "bed");

    for (const bed of beds) {
      const centerCellX = bed.x + 24;
      const centerCellY = bed.y + 38;
      expect(isPointBlocked(grid, centerCellX, centerCellY)).toBe(true);
    }
  });

  it("ensures bedroom layout idempotence in ensureOfficeBedroom", () => {
    const initialItems = ensureOfficeBedroom([]);
    const beds = initialItems.filter((item) => item.type === "bed");
    expect(beds).toHaveLength(9);

    const secondCall = ensureOfficeBedroom(initialItems);
    expect(secondCall).toHaveLength(initialItems.length);
    expect(secondCall.filter((item) => item.type === "bed")).toHaveLength(9);
  });

  it("includes 9 beds in materializeDefaults", () => {
    const officeItems = materializeDefaults("office");
    const lobbyItems = materializeDefaults("lobby");
    expect(officeItems.filter((item) => item.type === "bed")).toHaveLength(9);
    expect(lobbyItems.filter((item) => item.type === "bed")).toHaveLength(9);
  });
});
