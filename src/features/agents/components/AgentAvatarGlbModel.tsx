"use client";

import { useGLTF, useAnimations, useTexture } from "@react-three/drei";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import { ANIME_AVATAR_PRESETS } from "@/lib/avatars/animePresets";
import {
  getCharacterColorPalette,
  type CharacterColorPalette,
} from "@/lib/avatars/colorPalettes";
import {
  type CustomAvatarColors,
  applyColorsToPaletteCanvas,
} from "@/lib/avatars/glbPaletteTexture";

export type AgentAvatarGlbAnimation =
  | "idle"
  | "walk"
  | "run"
  | "attack"
  | "hit"
  | "death"
  | "special";

type Props = {
  modelUrl: string;
  animationName?: AgentAvatarGlbAnimation;
  targetHeight?: number;
  palette?: CharacterColorPalette | null;
  colors?: CustomAvatarColors | null;
};

const CANDIDATES: Record<AgentAvatarGlbAnimation, string[]> = {
  idle: ["Idle", "idle"],
  walk: ["Walk", "walk"],
  run: ["Run", "run"],
  attack: ["Attack", "attack"],
  hit: ["Hit", "hit"],
  death: ["Death", "death", "Dead", "dead"],
  special: ["Special", "special"],
};

export const AgentAvatarGlbModel = ({
  modelUrl,
  animationName = "idle",
  targetHeight = 1.6,
  palette,
  colors,
}: Props) => {
  const groupRef = useRef<THREE.Group>(null);
  const gltf = useGLTF(modelUrl);
  const clonedScene = useMemo(
    () => cloneSkeleton(gltf.scene) as THREE.Group,
    [gltf.scene],
  );
  const { actions, mixer } = useAnimations(gltf.animations, clonedScene);

  const charId = useMemo(
    () => modelUrl.replace(/^.*\/|\.[^.]+$/g, "").toLowerCase(),
    [modelUrl],
  );
  const customTexture = useTexture(
    `/office-assets/models/avatars/textures/${charId}.png`,
  );

  const dynamic = useMemo(() => {
    if (typeof document === "undefined") return null;
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 2048;
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.flipY = false;
    return { canvas, tex };
  }, []);

  useEffect(() => {
    return () => {
      dynamic?.tex.dispose();
    };
  }, [dynamic]);

  const colorsKey = useMemo(() => {
    if (!colors) return "";
    return `${colors.skin ?? ""}_${colors.hair ?? ""}_${colors.top ?? ""}_${colors.bottom ?? ""}_${colors.shoes ?? ""}_${colors.accent ?? ""}`;
  }, [colors?.skin, colors?.hair, colors?.top, colors?.bottom, colors?.shoes, colors?.accent]);

  const activeTexture = useMemo(() => {
    if (!colors || !dynamic || !customTexture?.image) {
      return customTexture;
    }
    applyColorsToPaletteCanvas(dynamic.canvas, customTexture.image as HTMLImageElement, colors);
    dynamic.tex.needsUpdate = true;
    return dynamic.tex;
  }, [colors, colorsKey, customTexture, dynamic]);

  useLayoutEffect(() => {
    if (!activeTexture) return;
    activeTexture.colorSpace = THREE.SRGBColorSpace;
    activeTexture.flipY = false;
    activeTexture.needsUpdate = true;

    clonedScene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const m of mats) {
        const std = m as THREE.MeshStandardMaterial;
        std.map = activeTexture;
        std.map.colorSpace = THREE.SRGBColorSpace;
        std.map.flipY = false;
        std.map.needsUpdate = true;
        if ("roughness" in std) std.roughness = 0.4;
        if ("metalness" in std) std.metalness = 0.0;
        std.needsUpdate = true;
      }
    });
  }, [clonedScene, activeTexture]);

  useLayoutEffect(() => {
    clonedScene.position.set(0, 0, 0);
    clonedScene.scale.set(1, 1, 1);
    clonedScene.updateMatrixWorld(true);

    const box = new THREE.Box3().setFromObject(clonedScene);
    const size = new THREE.Vector3();
    box.getSize(size);
    const scale = size.y > 0 ? targetHeight / size.y : 1;
    if (size.y > 0 && Number.isFinite(scale)) {
      clonedScene.scale.setScalar(scale);
      clonedScene.updateMatrixWorld(true);

      const scaledBox = new THREE.Box3().setFromObject(clonedScene);
      const center = new THREE.Vector3();
      scaledBox.getCenter(center);
      if (Number.isFinite(center.x) && Number.isFinite(scaledBox.min.y)) {
        clonedScene.position.x = -center.x;
        clonedScene.position.z = -center.z;
        clonedScene.position.y = -scaledBox.min.y;
        clonedScene.updateMatrixWorld(true);
      }
    }
  }, [clonedScene, targetHeight]);

  useEffect(() => {
    const names = CANDIDATES[animationName] ?? [];
    let action: THREE.AnimationAction | null = null;
    for (const name of names) {
      if (actions[name]) {
        action = actions[name];
        break;
      }
    }
    if (!action) {
      action =
        actions.Idle ??
        actions.idle ??
        Object.values(actions).find((a): a is THREE.AnimationAction => Boolean(a)) ??
        null;
    }
    if (!action) return;
    action.reset().fadeIn(0.2).play();
    return () => {
      action!.fadeOut(0.2);
    };
  }, [actions, animationName]);

  useEffect(() => {
    return () => {
      mixer.stopAllAction();
    };
  }, [mixer]);

  return (
    <group ref={groupRef}>
      <primitive object={clonedScene} />
    </group>
  );
};

for (const preset of ANIME_AVATAR_PRESETS) {
  useGLTF.preload(preset.modelUrl);
  useTexture.preload(`/office-assets/models/avatars/textures/${preset.id}.png`);
}
