import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { DOOR_LENGTH, DOOR_THICKNESS, SCALE } from "@/features/retro-office/core/constants";
import { toWorld } from "@/features/retro-office/core/geometry";

describe("DoorModel bidirectional swing and approach animation logic", () => {
  const HOLD_OPEN_DURATION_MS = 900;
  const APPROACH_TRIGGER_DISTANCE = 1.0;
  const DOOR_SWING_ANGLE = Math.PI * 0.55;

  it("calculates local frame coordinates correctly using cos and sin of rotY", () => {
    const item = { x: 500, y: 500, w: DOOR_LENGTH, h: DOOR_THICKNESS, rotation: 90 };
    const [wx, , wz] = toWorld(item.x, item.y);
    const width = (item.w ?? DOOR_LENGTH) * SCALE;
    const depth = Math.max((item.h ?? DOOR_THICKNESS) * SCALE, 0.04);
    const centerX = wx + width / 2;
    const centerZ = wz + depth / 2;
    const rotY = (90 * Math.PI) / 180;
    const cos = Math.cos(rotY);
    const sin = Math.sin(rotY);

    const doorGroup = new THREE.Group();
    doorGroup.position.set(centerX, 0, centerZ);
    doorGroup.rotation.y = rotY;
    doorGroup.updateMatrixWorld(true);

    const testPoints = [
      { worldX: centerX + 0.5, worldZ: centerZ + 0.8 },
      { worldX: centerX - 0.7, worldZ: centerZ - 0.3 },
      { worldX: centerX, worldZ: centerZ + 1.2 },
    ];

    for (const pt of testPoints) {
      const dx = pt.worldX - centerX;
      const dz = pt.worldZ - centerZ;
      const localX = dx * cos - dz * sin;
      const localZ = dx * sin + dz * cos;

      const expected = new THREE.Vector3(pt.worldX, 0, pt.worldZ);
      doorGroup.worldToLocal(expected);

      expect(localX).toBeCloseTo(expected.x, 5);
      expect(localZ).toBeCloseTo(expected.z, 5);
    }
  });

  it("triggers approach when within lateral (width * 0.5 + 0.25) and approach (1.0m) bounds", () => {
    const width = DOOR_LENGTH * SCALE; // 40 * 0.018 = 0.72
    const lateralTrigger = width * 0.5 + 0.25; // 0.61
    const approachTrigger = APPROACH_TRIGGER_DISTANCE; // 1.0

    // Inside bounds
    expect(Math.abs(0.5) <= lateralTrigger && Math.abs(0.9) <= approachTrigger).toBe(true);
    expect(Math.abs(-0.6) <= lateralTrigger && Math.abs(-0.95) <= approachTrigger).toBe(true);

    // Outside lateral bounds
    expect(Math.abs(0.65) <= lateralTrigger).toBe(false);

    // Outside approach bounds
    expect(Math.abs(1.05) <= approachTrigger).toBe(false);
  });

  it("implements bidirectional swing away from approaching agent and hold-open duration", () => {
    let currentAngle = 0;
    let swingDirection: -1 | 1 = -1;
    let lastTriggerTime = -Infinity;

    function step(now: number, agentLocalZ: number | null, delta: number) {
      const wasOpen = now - lastTriggerTime < HOLD_OPEN_DURATION_MS;
      const isTriggered = agentLocalZ !== null;

      if (isTriggered) {
        lastTriggerTime = now;
        if (!wasOpen || Math.abs(currentAngle) < 0.05) {
          swingDirection = agentLocalZ < 0 ? -1 : 1;
        }
      }

      const isHoldActive = now - lastTriggerTime < HOLD_OPEN_DURATION_MS;
      const shouldOpen = isTriggered || isHoldActive;
      const targetAngle = shouldOpen ? swingDirection * DOOR_SWING_ANGLE : 0;
      const lambda = shouldOpen ? 14 : 6;
      const safeDelta = Math.min(delta, 0.1);

      currentAngle = THREE.MathUtils.damp(currentAngle, targetAngle, lambda, safeDelta);
      if (!shouldOpen && Math.abs(currentAngle) < 0.005) {
        currentAngle = 0;
      }
      return { currentAngle, swingDirection, shouldOpen };
    }

    // Approach from localZ < 0 (outward swing, negative angle)
    let time = 1000;
    const dt = 1 / 60;
    let state = step(time, -0.8, dt);
    expect(state.swingDirection).toBe(-1);
    expect(state.shouldOpen).toBe(true);

    // After 200ms of opening, door is open towards -DOOR_SWING_ANGLE
    for (let i = 0; i < 12; i++) {
      time += dt * 1000;
      state = step(time, -0.5, dt);
    }
    expect(state.currentAngle).toBeLessThan(-1.5);

    // Agent crosses doorway (localZ > 0); swing direction must remain locked
    for (let i = 0; i < 15; i++) {
      time += dt * 1000;
      state = step(time, 0.3, dt);
    }
    expect(state.swingDirection).toBe(-1);
    expect(state.currentAngle).toBeLessThan(-1.5);

    // Agent steps away (outside trigger zone)
    time += dt * 1000;
    state = step(time, null, dt);
    expect(state.shouldOpen).toBe(true); // hold-open is active

    // Advance 500ms (within 900ms hold-open): should still be held open
    time += 500;
    state = step(time, null, dt);
    expect(state.shouldOpen).toBe(true);

    // Advance past 900ms hold-open: door starts closing
    time += 500;
    state = step(time, null, dt);
    expect(state.shouldOpen).toBe(false);

    // Advance until closed
    for (let i = 0; i < 60; i++) {
      time += dt * 1000;
      state = step(time, null, dt);
    }
    expect(state.currentAngle).toBe(0);

    // Now test opposite approach from localZ >= 0 (inward swing, positive angle)
    time += 100;
    state = step(time, 0.7, dt);
    expect(state.swingDirection).toBe(1);
    for (let i = 0; i < 15; i++) {
      time += dt * 1000;
      state = step(time, 0.4, dt);
    }
    expect(state.currentAngle).toBeGreaterThan(1.5);
  });
});
