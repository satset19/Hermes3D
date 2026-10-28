import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import * as THREE from "three";
import type { RenderAgent } from "@/features/retro-office/core/types";

let frameCallback: (() => void) | null = null;

vi.mock("@react-three/fiber", () => ({
  useFrame: (cb: () => void) => {
    frameCallback = cb;
  },
}));

vi.mock("@react-three/drei", () => ({
  Billboard: ({ children }: { children: React.ReactNode }) => children,
  Text: ({ children }: { children: React.ReactNode }) => children,
}));

import { TrailSystem, type TrailPoint } from "@/features/retro-office/systems/visualSystems";

type MockMeshTarget = {
  count: number;
  instanceMatrix: { needsUpdate: boolean };
  instanceColor: { needsUpdate: boolean };
  setMatrixAt: ReturnType<typeof vi.fn>;
  setColorAt: ReturnType<typeof vi.fn>;
};

const createMockAgent = (overrides?: Partial<RenderAgent>): RenderAgent =>
  ({
    id: "agent-1",
    name: "Agent 1",
    x: 100,
    y: 100,
    targetX: 100,
    targetY: 100,
    path: [],
    facing: 0,
    frame: 0,
    walkSpeed: 1,
    phaseOffset: 0,
    state: "standing",
    color: "#3b82f6",
    ...overrides,
  }) as unknown as RenderAgent;

describe("TrailSystem optimization", () => {
  let mockMesh: MockMeshTarget;

  beforeEach(() => {
    frameCallback = null;
    mockMesh = {
      count: 0,
      instanceMatrix: { needsUpdate: false },
      instanceColor: { needsUpdate: false },
      setMatrixAt: vi.fn(),
      setColorAt: vi.fn(),
    };
  });

  const setupTrailSystem = (agents: RenderAgent[], colorMap: Map<string, string>) => {
    const agentsRef = { current: agents };
    const result = render(
      React.createElement(TrailSystem, {
        agentsRef,
        colorMap,
      })
    );

    const meshEl = result.container.querySelector("instancedmesh") as unknown as MockMeshTarget;
    if (meshEl) {
      Object.assign(meshEl, mockMesh);
    }

    return { agentsRef, meshEl, ...result };
  };

  it("tidak memicu instanceMatrix.needsUpdate jika instanceIdx === 0 dan count sebelumnya 0", () => {
    const agents: RenderAgent[] = [
      createMockAgent({
        id: "agent-1",
        state: "standing",
        color: "#ff0000",
      }),
    ];
    const colorMap = new Map([["agent-1", "#ff0000"]]);

    const { meshEl } = setupTrailSystem(agents, colorMap);
    expect(frameCallback).toBeDefined();

    meshEl.count = 0;
    meshEl.instanceMatrix.needsUpdate = false;
    meshEl.instanceColor.needsUpdate = false;

    // Frame 1: tidak ada agen walking, instanceIdx === 0 dan prevCount === 0
    frameCallback!();

    expect(meshEl.count).toBe(0);
    expect(meshEl.instanceMatrix.needsUpdate).toBe(false);
    expect(meshEl.instanceColor.needsUpdate).toBe(false);
  });

  it("mengalokasikan koordinat primitif x, y, z dan memperbarui instanceMatrix saat agen berjalan", () => {
    const agents: RenderAgent[] = [
      createMockAgent({
        id: "agent-1",
        state: "walking",
        color: "#3b82f6",
      }),
    ];
    const colorMap = new Map([["agent-1", "#3b82f6"]]);

    const { meshEl } = setupTrailSystem(agents, colorMap);

    // Jalankan 12 frame agar unshift trail point dipicu
    for (let frame = 1; frame <= 12; frame += 1) {
      meshEl.instanceMatrix.needsUpdate = false;
      frameCallback!();
    }

    // Pada frame 12, point dibuat dan diunggah ke instancedMesh
    expect(meshEl.count).toBe(1);
    expect(meshEl.instanceMatrix.needsUpdate).toBe(true);
    expect(meshEl.instanceColor.needsUpdate).toBe(true);
    expect(meshEl.setMatrixAt).toHaveBeenCalledTimes(1);

    // Ambil matrix yang dipassing ke setMatrixAt dan periksa posisinya
    const matrixArg: THREE.Matrix4 = meshEl.setMatrixAt.mock.calls[0][1];
    const extractedPos = new THREE.Vector3();
    extractedPos.setFromMatrixPosition(matrixArg);
    expect(extractedPos.y).toBeCloseTo(0.01, 4);
  });

  it("membatasi panjang trail maksimal 6 titik per agen tanpa alokasi berlebih", () => {
    const agents: RenderAgent[] = [
      createMockAgent({
        id: "agent-1",
        state: "walking",
        color: "#10b981",
      }),
    ];
    const colorMap = new Map([["agent-1", "#10b981"]]);

    const { meshEl } = setupTrailSystem(agents, colorMap);

    // Jalankan 120 frame (10 interval 12 frame)
    for (let frame = 1; frame <= 120; frame += 1) {
      frameCallback!();
    }

    // Maksimal 6 titik trail per agen yang dipertahankan
    expect(meshEl.count).toBeLessThanOrEqual(6);
  });

  it("membersihkan trail yang sudah berumur >= 48 frame dan menonaktifkan needsUpdate di frame berikutnya", () => {
    const agents: RenderAgent[] = [
      createMockAgent({
        id: "agent-1",
        state: "walking",
        color: "#f59e0b",
      }),
    ];
    const colorMap = new Map([["agent-1", "#f59e0b"]]);

    const { meshEl } = setupTrailSystem(agents, colorMap);

    // Jalankan 12 frame agar titik dibuat
    for (let frame = 1; frame <= 12; frame += 1) {
      frameCallback!();
    }
    expect(meshEl.count).toBe(1);

    // Hentikan jalan agen
    agents[0].state = "standing";

    // Jalankan 48 frame tambahan agar titik menua >= 48
    for (let frame = 1; frame <= 48; frame += 1) {
      frameCallback!();
    }

    // Pada frame saat count transisi dari 1 ke 0, needsUpdate dipicu untuk membersihkan buffer
    expect(meshEl.count).toBe(0);
    expect(meshEl.instanceMatrix.needsUpdate).toBe(true);

    // Reset flag needsUpdate
    meshEl.instanceMatrix.needsUpdate = false;
    meshEl.instanceColor.needsUpdate = false;

    // Frame berikutnya: count sudah 0 dan instanceIdx === 0
    frameCallback!();

    expect(meshEl.count).toBe(0);
    // Tidak boleh memicu upload buffer kosong lagi
    expect(meshEl.instanceMatrix.needsUpdate).toBe(false);
    expect(meshEl.instanceColor.needsUpdate).toBe(false);
  });

  it("memastikan tipe TrailPoint memiliki struktur koordinat primitif", () => {
    const samplePoint: TrailPoint = {
      x: 1.5,
      y: 0.01,
      z: 2.5,
      age: 0,
      color: "#dc2626",
    };
    expect(samplePoint.x).toBe(1.5);
    expect(samplePoint.y).toBe(0.01);
    expect(samplePoint.z).toBe(2.5);
    expect(samplePoint.age).toBe(0);
    expect(samplePoint.color).toBe("#dc2626");
  });
});
