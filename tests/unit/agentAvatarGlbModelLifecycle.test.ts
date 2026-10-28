import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import * as THREE from "three";
import { useAnimations } from "@react-three/drei";
import { AgentAvatarGlbModel } from "@/features/agents/components/AgentAvatarGlbModel";

const mockMixer = {
  stopAllAction: vi.fn(),
  uncacheRoot: vi.fn(),
};

const mockActions: Record<string, unknown> = {};

let mockScene: THREE.Group;
let mockOriginalMaterial: THREE.MeshStandardMaterial;
let mockStaticTexture: THREE.Texture;

vi.mock("@react-three/drei", () => ({
  useGLTF: Object.assign(
    vi.fn(() => ({
      scene: mockScene,
      animations: [],
    })),
    { preload: vi.fn() },
  ),
  useAnimations: vi.fn(() => ({
    actions: mockActions,
    mixer: mockMixer,
  })),
  useTexture: Object.assign(
    vi.fn(() => mockStaticTexture),
    { preload: vi.fn() },
  ),
}));

vi.mock("@react-three/fiber", () => ({
  useFrame: vi.fn(),
}));

vi.mock("@/lib/avatars/glbPaletteTexture", () => ({
  applyColorsToPaletteCanvas: vi.fn(),
}));

describe("AgentAvatarGlbModel lifecycle and optimizations", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockOriginalMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff });
    vi.spyOn(mockOriginalMaterial, "dispose");

    const geometry = new THREE.BufferGeometry();
    const mesh = new THREE.Mesh(geometry, mockOriginalMaterial);
    mockScene = new THREE.Group();
    mockScene.add(mesh);

    mockStaticTexture = new THREE.Texture();
    mockStaticTexture.image = { width: 512, height: 2048 } as unknown as HTMLImageElement;
  });

  afterEach(() => {
    cleanup();
  });

  it("clones materials independently on clonedScene and disposes them on unmount", () => {
    let capturedClonedMaterial: THREE.Material | null = null;

    const { unmount } = render(
      createElement(AgentAvatarGlbModel, {
        modelUrl: "/models/agent.glb",
      }),
    );

    // useAnimations receives (smoothedAnimations, clonedScene)
    const clonedScene = vi.mocked(useAnimations).mock.calls[0]?.[1] as THREE.Group;
    expect(clonedScene).toBeDefined();

    clonedScene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh && mesh.material) {
        // Material should be cloned, not shared with gltf.scene
        expect(mesh.material).not.toBe(mockOriginalMaterial);
        capturedClonedMaterial = mesh.material as THREE.Material;
      }
    });

    expect(capturedClonedMaterial).not.toBeNull();
    const disposeSpy = vi.spyOn(capturedClonedMaterial!, "dispose");

    unmount();

    expect(disposeSpy).toHaveBeenCalled();
  });

  it("uncaches the root in useAnimations cleanup so skeleton does not leak in Three.js", () => {
    const { unmount } = render(
      createElement(AgentAvatarGlbModel, {
        modelUrl: "/models/agent.glb",
      }),
    );

    expect(mockMixer.uncacheRoot).not.toHaveBeenCalled();

    unmount();

    expect(mockMixer.stopAllAction).toHaveBeenCalled();
    expect(mockMixer.uncacheRoot).toHaveBeenCalledWith(expect.any(THREE.Group));
  });

  it("creates dynamic canvas 512x2048 lazily only when colors prop is non-null", () => {
    const createElementSpy = vi.spyOn(document, "createElement");

    // Case 1: colors is null/omitted -> no canvas allocated
    const { unmount: unmountStatic } = render(
      createElement(AgentAvatarGlbModel, {
        modelUrl: "/models/agent.glb",
        colors: null,
      }),
    );

    const canvasCallsStatic = createElementSpy.mock.calls.filter(
      (args) => args[0]?.toLowerCase() === "canvas",
    );
    expect(canvasCallsStatic.length).toBe(0);

    unmountStatic();

    // Case 2: colors is provided -> dynamic canvas allocated
    const customColors = {
      skin: "#fcd0a1",
      hair: "#222222",
      top: "#3b82f6",
      bottom: "#1e293b",
      shoes: "#000000",
      accent: "#ef4444",
    };

    const { unmount: unmountDynamic } = render(
      createElement(AgentAvatarGlbModel, {
        modelUrl: "/models/agent.glb",
        colors: customColors,
      }),
    );

    const canvasCallsDynamic = createElementSpy.mock.calls.filter(
      (args) => args[0]?.toLowerCase() === "canvas",
    );
    expect(canvasCallsDynamic.length).toBeGreaterThanOrEqual(1);

    unmountDynamic();
  });

  it("does not flag needsUpdate repeatedly on static customTexture in useLayoutEffect traverse", () => {
    const textureNeedsUpdateSetter = vi.fn();
    Object.defineProperty(mockStaticTexture, "needsUpdate", {
      set: textureNeedsUpdateSetter,
      get: () => false,
      configurable: true,
    });

    const { rerender } = render(
      createElement(AgentAvatarGlbModel, {
        modelUrl: "/models/agent.glb",
        colors: null,
      }),
    );

    // For static customTexture, activeTexture.needsUpdate must not be set
    expect(textureNeedsUpdateSetter).not.toHaveBeenCalled();

    const clonedScene = vi.mocked(useAnimations).mock.calls[0]?.[1] as THREE.Group;
    let clonedMeshMat: THREE.MeshStandardMaterial | null = null;
    clonedScene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh) {
        clonedMeshMat = mesh.material as THREE.MeshStandardMaterial;
      }
    });

    expect(clonedMeshMat).not.toBeNull();
    const materialNeedsUpdateSetter = vi.fn();
    Object.defineProperty(clonedMeshMat!, "needsUpdate", {
      set: materialNeedsUpdateSetter,
      get: () => false,
      configurable: true,
    });

    // Re-rendering with unchanged static texture does not set material.needsUpdate repeatedly
    rerender(
      createElement(AgentAvatarGlbModel, {
        modelUrl: "/models/agent.glb",
        colors: null,
        animationName: "walk",
      }),
    );

    expect(materialNeedsUpdateSetter).not.toHaveBeenCalled();
    expect(textureNeedsUpdateSetter).not.toHaveBeenCalled();
  });
});
