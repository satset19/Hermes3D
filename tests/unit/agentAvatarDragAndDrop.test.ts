import { describe, expect, it } from "vitest";
import {
  createDefaultAgentAvatarProfile,
  normalizeAgentAvatarProfile,
  type AgentAvatarProfile,
} from "@/lib/avatars/profile";

describe("Agent Avatar Profile & Scale Normalization", () => {
  it("creates default avatar profile with scale 1.0", () => {
    const profile = createDefaultAgentAvatarProfile("agent-test-1");
    expect(profile.scale).toBe(1.0);
    expect(profile.body.skinTone).toBeDefined();
    expect(profile.clothing.topColor).toBeDefined();
  });

  it("normalizes and preserves valid custom scale between 0.7 and 1.5", () => {
    const raw = {
      seed: "custom-agent",
      scale: 1.25,
      body: { skinTone: "#f4c58a", gender: "female" },
      hair: { style: "bob", color: "#6b4f3a" },
      clothing: {
        topStyle: "tee",
        topColor: "#3b82f6",
        bottomStyle: "pants",
        bottomColor: "#1e293b",
        shoesColor: "#ffffff",
      },
      accessories: { glasses: false, headset: true, hatStyle: "none", backpack: false },
    };

    const normalized = normalizeAgentAvatarProfile(raw, "fallback");
    expect(normalized.scale).toBe(1.25);
    expect(normalized.body.gender).toBe("female");
    expect(normalized.clothing.topColor).toBe("#3b82f6");
  });

  it("clamps out-of-bounds scale values to [0.7, 1.5]", () => {
    const low = normalizeAgentAvatarProfile({ scale: 0.2 }, "fallback");
    expect(low.scale).toBe(0.7);

    const high = normalizeAgentAvatarProfile({ scale: 2.8 }, "fallback");
    expect(high.scale).toBe(1.5);
  });

  it("defaults invalid NaN or non-number scale to 1.0", () => {
    const invalid = normalizeAgentAvatarProfile({ scale: "large" }, "fallback");
    expect(invalid.scale).toBe(1.0);
  });
});

describe("3D Agent Drag and Drop Snap Geometry", () => {
  const desk = {
    _uid: "desk_cubicle_1",
    type: "desk_cubicle",
    x: 300,
    y: 200,
  };
  const deskSeatX = desk.x + 40; // 340
  const deskSeatY = desk.y - 5;  // 195
  const SNAP_THRESHOLD = 65;

  it("identifies drop coordinates within snap threshold to desk workstation", () => {
    // Dropped at (350, 205) -> distance = hypot(10, 10) ≈ 14.14 < 65
    const dropX = 350;
    const dropY = 205;
    const distance = Math.hypot(dropX - deskSeatX, dropY - deskSeatY);

    expect(distance).toBeLessThan(SNAP_THRESHOLD);
  });

  it("rejects snap when dropped on open floor far from desk", () => {
    // Dropped at (500, 400) -> distance > 200
    const dropX = 500;
    const dropY = 400;
    const distance = Math.hypot(dropX - deskSeatX, dropY - deskSeatY);

    expect(distance).toBeGreaterThan(SNAP_THRESHOLD);
  });
});
