import { describe, expect, it } from "vitest";
import {
  calculateSmoothedFps,
  downgradeGraphicsQuality,
  getNextLowerGraphicsQuality,
  resolveTargetDprStep,
  LOW_FPS_DOWNGRADE_THRESHOLD,
  LOW_FPS_SUSTAIN_DURATION_MS,
  MIN_DPR_COOLDOWN_MS,
} from "@/features/retro-office/systems/performance";

describe("performance controller constants and rules", () => {
  it("enforces minimum 10s cooldown to prevent GPU backbuffer stalls", () => {
    expect(MIN_DPR_COOLDOWN_MS).toBeGreaterThanOrEqual(10_000);
  });

  it("sets low FPS threshold to 30 FPS", () => {
    expect(LOW_FPS_DOWNGRADE_THRESHOLD).toBe(30);
  });

  it("requires 3s continuous drop before downgrade", () => {
    expect(LOW_FPS_SUSTAIN_DURATION_MS).toBe(3_000);
  });
});

describe("calculateSmoothedFps", () => {
  it("uses instant FPS when initial smoothed FPS is 0 or uninitialized", () => {
    const fps = calculateSmoothedFps(0, 60, 0.016);
    expect(fps).toBe(60);
  });

  it("smooths FPS over time without sudden discontinuous jumps", () => {
    let smoothed = 60;
    // Simulate drop to 20 FPS for 1 frame
    smoothed = calculateSmoothedFps(smoothed, 20, 0.016);
    // Should smoothly dampen the single drop instead of jumping directly to 20
    expect(smoothed).toBeLessThan(60);
    expect(smoothed).toBeGreaterThan(50);
  });
});

describe("graphics quality downgrade helpers", () => {
  it("downgrades ultra to balanced and balanced to low", () => {
    expect(getNextLowerGraphicsQuality("ultra")).toBe("balanced");
    expect(getNextLowerGraphicsQuality("balanced")).toBe("low");
    expect(getNextLowerGraphicsQuality("low")).toBeNull();
  });

  it("downgradeGraphicsQuality handles floor boundary at low", () => {
    expect(downgradeGraphicsQuality("ultra")).toBe("balanced");
    expect(downgradeGraphicsQuality("balanced")).toBe("low");
    expect(downgradeGraphicsQuality("low")).toBe("low");
  });
});

describe("resolveTargetDprStep", () => {
  it("drops DPR to lower step when FPS is severely degraded (< 45)", () => {
    const nextDpr = resolveTargetDprStep(25, 1.15, 0.75, 1.15);
    expect(nextDpr).toBeLessThan(1.15);
    expect(nextDpr).toBeGreaterThanOrEqual(0.75);
  });

  it("recovers DPR step when FPS is consistently high (> 58)", () => {
    const nextDpr = resolveTargetDprStep(60, 1.0, 0.75, 1.15);
    expect(nextDpr).toBe(1.15);
  });

  it("maintains current DPR when FPS is in normal operating range", () => {
    const nextDpr = resolveTargetDprStep(50, 1.0, 0.75, 1.15);
    expect(nextDpr).toBe(1.0);
  });

  it("respects minDpr and maxDpr bounds", () => {
    const lowest = resolveTargetDprStep(15, 0.75, 0.75, 1.15);
    expect(lowest).toBe(0.75);

    const highest = resolveTargetDprStep(120, 1.15, 0.75, 1.15);
    expect(highest).toBe(1.15);
  });
});
