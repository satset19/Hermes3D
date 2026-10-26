import { describe, expect, it } from "vitest";

import {
  BEDROOM_DOOR_Y,
  BEDROOM_ROOM_END_X,
  BEDROOM_ROOM_WIDTH,
  BEDROOM_ROOM_X,
  CANVAS_H,
  CANVAS_W,
  DOOR_LENGTH,
  DOOR_THICKNESS,
  WALL_THICKNESS,
} from "@/features/retro-office/core/constants";
import {
  ITEM_FOOTPRINT,
  ITEM_METADATA,
  getItemBounds,
} from "@/features/retro-office/core/geometry";
import {
  DEFAULT_BEDROOM_ITEMS,
  ensureOfficeBedroom,
  materializeDefaults,
} from "@/features/retro-office/core/furnitureDefaults";
import {
  astar,
  buildNavGrid,
  isNavPointFree,
} from "@/features/retro-office/core/navigation";
import type { FurnitureItem } from "@/features/retro-office/core/types";

const GRID_CELL = 25;
const GRID_COLS = Math.ceil(CANVAS_W / GRID_CELL);
const GRID_ROWS = Math.ceil(CANVAS_H / GRID_CELL);

const isPointBlockedInGrid = (
  grid: Uint8Array,
  x: number,
  y: number,
): boolean => {
  const col = Math.floor(x / GRID_CELL);
  const row = Math.floor(y / GRID_CELL);
  if (col < 0 || col >= GRID_COLS || row < 0 || row >= GRID_ROWS) return true;
  return grid[row * GRID_COLS + col] === 1;
};

/**
 * Memeriksa apakah segmen-segmen jalur yang memotong garis vertikal x = wallX
 * hanya melintas pada rentang bukaan pintu [doorMinY, doorMaxY].
 */
const crossesWallOnlyThroughDoor = (
  path: { x: number; y: number }[],
  wallX: number,
  doorMinY: number,
  doorMaxY: number,
): boolean => {
  if (path.length < 2) return false;
  let crossed = false;

  for (let i = 0; i < path.length - 1; i++) {
    const p1 = path[i];
    const p2 = path[i + 1];

    const crosses =
      (p1.x <= wallX && p2.x >= wallX) || (p1.x >= wallX && p2.x <= wallX);

    if (crosses) {
      crossed = true;
      const t = p1.x === p2.x ? 0.5 : (wallX - p1.x) / (p2.x - p1.x);
      const crossingY = p1.y + t * (p2.y - p1.y);

      // Berikan toleransi margin 1 cell (25 unit) untuk transisi diagonal grid
      if (crossingY < doorMinY - GRID_CELL || crossingY > doorMaxY + GRID_CELL) {
        return false;
      }
    }
  }

  return crossed;
};

describe("officeDoorCollision – collision, bukaan pintu, dan layout kamar tidur", () => {
  describe("1. Pathfinding respects walls (Navigasi mematuhi dinding & anti-tembus)", () => {
    it("tidak dapat menembus dinding solid tanpa bukaan pintu (mengembalikan array kosong)", () => {
      // Ruangan tertutup rapat 4 sisi tanpa pintu
      const sealedRoom: FurnitureItem[] = [
        { _uid: "w_top", type: "wall", x: 400, y: 200, w: 300, h: WALL_THICKNESS },
        { _uid: "w_bottom", type: "wall", x: 400, y: 500, w: 300, h: WALL_THICKNESS },
        { _uid: "w_left", type: "wall", x: 400, y: 200, w: WALL_THICKNESS, h: 300 },
        { _uid: "w_right", type: "wall", x: 700, y: 200, w: WALL_THICKNESS, h: 300 },
      ];

      const grid = buildNavGrid(sealedRoom);

      const outsideX = 300;
      const outsideY = 350;
      const insideX = 550;
      const insideY = 350;

      const path = astar(outsideX, outsideY, insideX, insideY, grid);
      expect(path).toEqual([]);
    });

    it("tidak menembus dinding secara langsung dan wajib memutar melewati bukaan pintu", () => {
      // Dinding vertikal di x = 400 dari y = 25 sampai 600, dengan bukaan pintu di y = 200..275
      const wallX = 400;
      const doorYStart = 200;
      const doorYEnd = 275;

      const items: FurnitureItem[] = [
        {
          _uid: "wall_top",
          type: "wall",
          x: wallX,
          y: 25,
          w: WALL_THICKNESS,
          h: doorYStart - 25,
        },
        {
          _uid: "door_main",
          type: "door",
          x: wallX,
          y: doorYStart,
          w: WALL_THICKNESS,
          h: doorYEnd - doorYStart,
        },
        {
          _uid: "wall_bottom",
          type: "wall",
          x: wallX,
          y: doorYEnd,
          w: WALL_THICKNESS,
          h: 350,
        },
      ];

      const grid = buildNavGrid(items);

      // Start dan target berada di ketinggian y = 100 (berseberangan langsung melewati wall_top)
      const startX = 300;
      const startY = 100;
      const targetX = 500;
      const targetY = 100;

      const path = astar(startX, startY, targetX, targetY, grid);
      expect(path.length).toBeGreaterThan(0);

      // Semua waypoint jalur harus berada pada sel bebas (tidak boleh mengenai dinding)
      for (const waypoint of path) {
        expect(isNavPointFree(grid, waypoint.x, waypoint.y)).toBe(true);
      }

      // Verifikasi bahwa jalur memotong sumbu wallX HANYA melalui rentang bukaan pintu
      const crossesThroughDoor = crossesWallOnlyThroughDoor(
        path,
        wallX,
        doorYStart,
        doorYEnd,
      );
      expect(crossesThroughDoor).toBe(true);
    });

    it("memastikan sel dinding terdeteksi sebagai impassable (grid = 1)", () => {
      const testWall: FurnitureItem = {
        _uid: "test_wall",
        type: "wall",
        x: 300,
        y: 200,
        w: 100,
        h: WALL_THICKNESS,
      };

      const grid = buildNavGrid([testWall]);
      expect(isPointBlockedInGrid(grid, 350, 204)).toBe(true);
    });
  });

  describe("2. Bedroom layout (Layout kamar tidur 9 kasur & pintu masuk)", () => {
    it("memverifikasi tepat 9 kasur dispawn pada layout default office dan lobby", () => {
      const officeItems = materializeDefaults("office");
      const lobbyItems = materializeDefaults("lobby");

      const officeBeds = officeItems.filter((item) => item.type === "bed");
      const lobbyBeds = lobbyItems.filter((item) => item.type === "bed");

      expect(officeBeds).toHaveLength(9);
      expect(lobbyBeds).toHaveLength(9);
    });

    it("memverifikasi 9 kasur tersusun rapi dalam konfigurasi grid 3x3 (3 kolom x 3 baris)", () => {
      const beds = DEFAULT_BEDROOM_ITEMS.filter((item) => item.type === "bed");
      const distinctX = new Set(beds.map((b) => b.x));
      const distinctY = new Set(beds.map((b) => b.y));

      expect(distinctX.size).toBe(3);
      expect(distinctY.size).toBe(3);
    });

    it("memverifikasi setiap kasur memiliki blocksNavigation: true", () => {
      expect(ITEM_METADATA.bed).toBeDefined();
      expect(ITEM_METADATA.bed.blocksNavigation).toBe(true);

      const defaultBeds = DEFAULT_BEDROOM_ITEMS.filter(
        (item) => item.type === "bed",
      );
      expect(defaultBeds).toHaveLength(9);

      for (const bed of defaultBeds) {
        expect(ITEM_METADATA[bed.type]?.blocksNavigation).toBe(true);
      }
    });

    it("memverifikasi footprint kasur terdaftar pada ITEM_FOOTPRINT", () => {
      expect(ITEM_FOOTPRINT.bed).toBeDefined();
      expect(ITEM_FOOTPRINT.bed[0]).toBeGreaterThan(0);
      expect(ITEM_FOOTPRINT.bed[1]).toBeGreaterThan(0);
    });

    it("memverifikasi seluruh kasur berada dalam batas ruangan kamar tidur", () => {
      const beds = DEFAULT_BEDROOM_ITEMS.filter((item) => item.type === "bed");
      const [bedWidth, bedHeight] = ITEM_FOOTPRINT.bed;

      for (const bed of beds) {
        expect(bed.x).toBeGreaterThanOrEqual(BEDROOM_ROOM_X);
        expect(bed.x + bedWidth).toBeLessThanOrEqual(BEDROOM_ROOM_END_X);
        expect(bed.y).toBeGreaterThan(40);
        expect(bed.y + bedHeight).toBeLessThan(680);
      }
    });

    it("memverifikasi kasur memblokir sel navigasi pada buildNavGrid", () => {
      const bedroomItems: FurnitureItem[] = DEFAULT_BEDROOM_ITEMS.map(
        (item, idx) => ({
          ...item,
          _uid: `bedroom_test_${idx}`,
        }),
      );

      const grid = buildNavGrid(bedroomItems);
      const beds = bedroomItems.filter((item) => item.type === "bed");

      for (const bed of beds) {
        const bounds = getItemBounds(bed);
        const centerBx = bounds.x + bounds.w / 2;
        const centerBy = bounds.y + bounds.h / 2;
        expect(isPointBlockedInGrid(grid, centerBx, centerBy)).toBe(true);
      }
    });

    it("memverifikasi kamar tidur memiliki pintu yang dapat diakses pada dinding barat", () => {
      const bedroomDoors = DEFAULT_BEDROOM_ITEMS.filter(
        (item) => item.type === "door",
      );
      expect(bedroomDoors).toHaveLength(1);

      const door = bedroomDoors[0];
      expect(door.x).toBe(BEDROOM_ROOM_X);
      expect(door.y).toBe(BEDROOM_DOOR_Y);
      expect(ITEM_METADATA.door?.blocksNavigation).toBe(false);
    });

    it("memverifikasi fungsi migrasi ensureOfficeBedroom bersifat idempoten", () => {
      const emptyItems = ensureOfficeBedroom([]);
      const bedsFirst = emptyItems.filter((item) => item.type === "bed");
      expect(bedsFirst).toHaveLength(9);

      const idempotentItems = ensureOfficeBedroom(emptyItems);
      const bedsSecond = idempotentItems.filter((item) => item.type === "bed");
      expect(bedsSecond).toHaveLength(9);
      expect(idempotentItems).toHaveLength(emptyItems.length);
    });
  });

  describe("3. Doorway navigability (Navigasi melintasi bukaan pintu ke dalam ruangan)", () => {
    // Ruangan uji dengan dinding perimeter dan sebuah bukaan pintu
    const roomLeft = 600;
    const roomRight = 850;
    const roomTop = 200;
    const roomBottom = 450;
    const doorY = 275;
    const doorSize = 75; // 3 grid cells (75 unit) menjamin minimal 1 sel tengah (row 12) bebas dari padding

    const createTestRoomWithDoor = (doorBlocked = false): FurnitureItem[] => {
      const items: FurnitureItem[] = [
        // Dinding utara
        {
          _uid: "r_north",
          type: "wall",
          x: roomLeft,
          y: roomTop,
          w: roomRight - roomLeft + WALL_THICKNESS,
          h: WALL_THICKNESS,
        },
        // Dinding selatan
        {
          _uid: "r_south",
          type: "wall",
          x: roomLeft,
          y: roomBottom,
          w: roomRight - roomLeft + WALL_THICKNESS,
          h: WALL_THICKNESS,
        },
        // Dinding timur
        {
          _uid: "r_east",
          type: "wall",
          x: roomRight,
          y: roomTop,
          w: WALL_THICKNESS,
          h: roomBottom - roomTop + WALL_THICKNESS,
        },
        // Dinding barat segmen atas
        {
          _uid: "r_west_top",
          type: "wall",
          x: roomLeft,
          y: roomTop,
          w: WALL_THICKNESS,
          h: doorY - roomTop,
        },
        // Bukaan pintu barat (atau dinding jika doorBlocked = true)
        doorBlocked
          ? {
              _uid: "r_door_blocked",
              type: "wall",
              x: roomLeft,
              y: doorY,
              w: WALL_THICKNESS,
              h: doorSize,
            }
          : {
              _uid: "r_door",
              type: "door",
              x: roomLeft,
              y: doorY,
              w: WALL_THICKNESS,
              h: doorSize,
            },
        // Dinding barat segmen bawah
        {
          _uid: "r_west_bottom",
          type: "wall",
          x: roomLeft,
          y: doorY + doorSize,
          w: WALL_THICKNESS,
          h: roomBottom - (doorY + doorSize),
        },
      ];
      return items;
    };

    it("memverifikasi astar merutekan agent melewati pintu luar untuk masuk ke dalam ruangan", () => {
      const items = createTestRoomWithDoor(false);
      const grid = buildNavGrid(items);

      const outsideX = roomLeft - 80;
      const outsideY = doorY + doorSize / 2;
      const insideTargetX = roomLeft + 120;
      const insideTargetY = roomTop + 80;

      const path = astar(outsideX, outsideY, insideTargetX, insideTargetY, grid);
      expect(path.length).toBeGreaterThan(0);

      // Verifikasi seluruh waypoint bebas rintangan
      for (const wp of path) {
        expect(isNavPointFree(grid, wp.x, wp.y)).toBe(true);
      }

      // Verifikasi jalur menembus batas barat HANYA pada segmen pintu
      const traversedDoor = crossesWallOnlyThroughDoor(
        path,
        roomLeft,
        doorY,
        doorY + doorSize,
      );
      expect(traversedDoor).toBe(true);
    });

    it("memverifikasi astar merutekan agent keluar dari dalam ruangan melewati pintu", () => {
      const items = createTestRoomWithDoor(false);
      const grid = buildNavGrid(items);

      const insideX = roomLeft + 120;
      const insideY = roomBottom - 60;
      const outsideTargetX = roomLeft - 100;
      const outsideTargetY = roomBottom - 60;

      const path = astar(insideX, insideY, outsideTargetX, outsideTargetY, grid);
      expect(path.length).toBeGreaterThan(0);

      for (const wp of path) {
        expect(isNavPointFree(grid, wp.x, wp.y)).toBe(true);
      }

      const traversedDoor = crossesWallOnlyThroughDoor(
        path,
        roomLeft,
        doorY,
        doorY + doorSize,
      );
      expect(traversedDoor).toBe(true);
    });

    it("gagal merutekan jika pintu ditutup oleh dinding solid", () => {
      const items = createTestRoomWithDoor(true);
      const grid = buildNavGrid(items);

      const outsideX = roomLeft - 80;
      const outsideY = doorY + doorSize / 2;
      const insideTargetX = roomLeft + 120;
      const insideTargetY = roomTop + 80;

      const path = astar(outsideX, outsideY, insideTargetX, insideTargetY, grid);
      expect(path).toEqual([]);
    });

    it("memverifikasi navigasi antar dua ruangan bersebelahan wajib melalui pintu pada partisi pemisah", () => {
      // Dua ruangan bersebelahan dengan dinding pemisah vertikal di x = 700
      const partitionX = 700;
      const partDoorY = 275;
      const partDoorSize = 75;

      const twoRooms: FurnitureItem[] = [
        // Dinding luar atas dan bawah
        { _uid: "tw_top", type: "wall", x: 400, y: 150, w: 600, h: WALL_THICKNESS },
        { _uid: "tw_bottom", type: "wall", x: 400, y: 450, w: 600, h: WALL_THICKNESS },
        // Dinding luar kiri dan kanan
        { _uid: "tw_left", type: "wall", x: 400, y: 150, w: WALL_THICKNESS, h: 300 },
        { _uid: "tw_right", type: "wall", x: 1000, y: 150, w: WALL_THICKNESS, h: 300 },
        // Partisi pemisah vertikal atas
        {
          _uid: "p_top",
          type: "wall",
          x: partitionX,
          y: 150,
          w: WALL_THICKNESS,
          h: partDoorY - 150,
        },
        // Pintu pada partisi pemisah
        {
          _uid: "p_door",
          type: "door",
          x: partitionX,
          y: partDoorY,
          w: WALL_THICKNESS,
          h: partDoorSize,
        },
        // Partisi pemisah vertikal bawah
        {
          _uid: "p_bottom",
          type: "wall",
          x: partitionX,
          y: partDoorY + partDoorSize,
          w: WALL_THICKNESS,
          h: 450 - (partDoorY + partDoorSize),
        },
      ];

      const grid = buildNavGrid(twoRooms);

      // Start di Room 1 (kiri), Target di Room 2 (kanan)
      const startX = 550;
      const startY = 200;
      const targetX = 850;
      const targetY = 200;

      const path = astar(startX, startY, targetX, targetY, grid);
      expect(path.length).toBeGreaterThan(0);

      // Seluruh waypoint harus di area bebas
      for (const wp of path) {
        expect(isNavPointFree(grid, wp.x, wp.y)).toBe(true);
      }

      // Harus melintasi partisi hanya melalui bukaan pintu partisi
      const crossedPartitionThroughDoor = crossesWallOnlyThroughDoor(
        path,
        partitionX,
        partDoorY,
        partDoorY + partDoorSize,
      );
      expect(crossedPartitionThroughDoor).toBe(true);
    });
  });
});
