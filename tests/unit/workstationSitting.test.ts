import { describe, expect, it } from "vitest";
import { getDeskLocations } from "@/features/retro-office/core/navigation";
import { materializeDefaults } from "@/features/retro-office/core/furnitureDefaults";
import type { FurnitureItem } from "@/features/retro-office/core/types";

describe("Workstation sitting alignment and chair coordinates", () => {
  it("aligns getDeskLocations target coordinates with chair cushion center when chair is present", () => {
    const furniture: FurnitureItem[] = [
      { id: "desk_test", _uid: "desk_test", type: "desk_cubicle", x: 100, y: 500 },
      { id: "chair_test", _uid: "chair_test", type: "chair", x: 120, y: 490, facing: 180 },
    ];

    const locations = getDeskLocations(furniture);
    expect(locations).toHaveLength(1);
    expect(locations[0]).toEqual({
      x: 120 + 13,
      y: 490 + 10,
      facing: Math.PI,
    });
  });

  it("falls back to desk center coordinates when chair is missing", () => {
    const furniture: FurnitureItem[] = [
      { id: "desk_test", _uid: "desk_test", type: "desk_cubicle", x: 100, y: 500 },
    ];

    const locations = getDeskLocations(furniture);
    expect(locations).toHaveLength(1);
    expect(locations[0]).toEqual({
      x: 100 + 33,
      y: 500 - 15,
      facing: Math.PI,
    });
  });

  it("verifies default furniture includes chair for desk_4 and corrected chair for desk_5", () => {
    const defaults = materializeDefaults("office");

    const desk4 = defaults.find(
      (item) => item.type === "desk_cubicle" && item.id === "desk_4",
    );
    expect(desk4).toBeDefined();

    const chair4 = defaults.find(
      (item) => item.type === "chair" && item.x === 120 && item.y === 490,
    );
    expect(chair4).toBeDefined();
    expect(chair4?.facing).toBe(180);

    const desk5 = defaults.find(
      (item) => item.type === "desk_cubicle" && item.id === "desk_5",
    );
    expect(desk5).toBeDefined();

    const chair5 = defaults.find(
      (item) => item.type === "chair" && item.x === 320 && item.y === 490,
    );
    expect(chair5).toBeDefined();
    expect(chair5?.facing).toBe(180);

    const oldTypoChair = defaults.find(
      (item) => item.type === "chair" && item.x === 310 && item.y === 490,
    );
    expect(oldTypoChair).toBeUndefined();
  });

  it("verifies all 8 default cubicle desks have chair cushion targets facing Math.PI", () => {
    const defaults = materializeDefaults("office");

    const desks = defaults.filter((item) => item.type === "desk_cubicle");
    expect(desks).toHaveLength(8);

    const locations = getDeskLocations(defaults);
    expect(locations).toHaveLength(8);

    locations.forEach((loc) => {
      expect(loc.facing).toBe(Math.PI);
      expect(typeof loc.x).toBe("number");
      expect(typeof loc.y).toBe("number");
    });
  });
});
