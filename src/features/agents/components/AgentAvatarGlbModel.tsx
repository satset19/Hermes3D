"use client";

import { useGLTF, useAnimations, useTexture } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from "react";
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
import {
  createDanceAnimationClips,
  createSittingAnimationClip,
} from "@/lib/avatars/danceAnimations";

export type AgentAvatarGlbAnimation =
  | "idle"
  | "walk"
  | "run"
  | "attack"
  | "hit"
  | "death"
  | "special"
  | "sitting"
  | "dance_disco"
  | "dance_wave"
  | "dance_spin"
  | "dance_rock"
  | "dance_cheer";

type Props = {
  modelUrl: string;
  animationName?: AgentAvatarGlbAnimation;
  animationRef?: React.RefObject<string | AgentAvatarGlbAnimation>;
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
  sitting: ["sitting", "Sit", "sit"],
  dance_disco: ["dance_disco", "dance-disco", "disco"],
  dance_wave: ["dance_wave", "dance-wave", "wave"],
  dance_spin: ["dance_spin", "dance-spin", "spin"],
  dance_rock: ["dance_rock", "dance-rock", "rock"],
  dance_cheer: ["dance_cheer", "dance-cheer", "cheer", "Special", "special"],
};

export const AgentAvatarGlbModel = ({
  modelUrl,
  animationName = "idle",
  animationRef,
  targetHeight = 1.6,
  palette,
  colors,
}: Props) => {
  const groupRef = useRef<THREE.Group>(null);
  const gltf = useGLTF(modelUrl);
  const clonedScene = useMemo(() => {
    const scene = cloneSkeleton(gltf.scene) as THREE.Group;
    scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      if (Array.isArray(mesh.material)) {
        mesh.material = mesh.material.map((m) => m.clone());
      } else if (mesh.material) {
        mesh.material = mesh.material.clone();
      }
    });
    return scene;
  }, [gltf.scene]);

  useEffect(() => {
    return () => {
      clonedScene.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (!mesh.isMesh) return;
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const m of mats) {
          m?.dispose();
        }
      });
    };
  }, [clonedScene]);

  // Smooth out any stepped/discrete keyframe tracks from low-fps or retro exports,
  // and merge synthetic sitting and multi-style dance animation clips.
  const smoothedAnimations = useMemo(() => {
    const clips = gltf.animations.map((clip) => {
      const cloned = clip.clone();
      for (const track of cloned.tracks) {
        if (track.getInterpolation() === THREE.InterpolateDiscrete) {
          track.setInterpolation(THREE.InterpolateLinear);
        }
      }
      return cloned;
    });

    const hasSit = clips.some((c) => /sit/i.test(c.name));
    if (!hasSit) {
      clips.push(createSittingAnimationClip());
    }

    const danceClips = createDanceAnimationClips();
    clips.push(...danceClips);

    return clips;
  }, [gltf.animations]);

  const { actions, mixer } = useAnimations(smoothedAnimations, clonedScene);
  const currentActionRef = useRef<THREE.AnimationAction | null>(null);

  const charId = useMemo(
    () => modelUrl.replace(/^.*\/|\.[^.]+$/g, "").toLowerCase(),
    [modelUrl],
  );
  const customTexture = useTexture(
    `/office-assets/models/avatars/textures/${charId}.png`,
  );

  const hasColors = Boolean(colors);

  const dynamic = useMemo(() => {
    if (!hasColors || typeof document === "undefined") return null;
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 2048;
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.flipY = false;
    return { canvas, tex };
  }, [hasColors]);

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
    const isDynamic = Boolean(dynamic && activeTexture === dynamic.tex);

    activeTexture.colorSpace = THREE.SRGBColorSpace;
    activeTexture.flipY = false;
    if (isDynamic) {
      activeTexture.needsUpdate = true;
    }

    clonedScene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const m of mats) {
        const std = m as THREE.MeshStandardMaterial;
        const mapChanged = std.map !== activeTexture;
        if (mapChanged) {
          std.map = activeTexture;
        }
        if ("roughness" in std) std.roughness = 0.4;
        if ("metalness" in std) std.metalness = 0.0;
        if (mapChanged || isDynamic) {
          std.needsUpdate = true;
        }
      }
    });
  }, [clonedScene, activeTexture, dynamic]);

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

  const playAnimation = useCallback(
    (anim: AgentAvatarGlbAnimation) => {
      const names = CANDIDATES[anim] ?? [];
      let nextAction: THREE.AnimationAction | null = null;
      for (const name of names) {
        if (actions[name]) {
          nextAction = actions[name];
          break;
        }
      }
      if (!nextAction) {
        nextAction =
          actions.Idle ??
          actions.idle ??
          Object.values(actions).find((a): a is THREE.AnimationAction => Boolean(a)) ??
          null;
      }
      if (!nextAction) return;

      const prevAction = currentActionRef.current;
      if (prevAction === nextAction) {
        if (!nextAction.isRunning()) {
          nextAction.play();
        }
        return;
      }

      nextAction.reset();
      nextAction.enabled = true;
      nextAction.setEffectiveTimeScale(1);
      nextAction.setEffectiveWeight(1);

      if (prevAction && prevAction.isRunning()) {
        prevAction.crossFadeTo(nextAction, 0.25, true);
      } else {
        nextAction.fadeIn(0.2);
      }
      nextAction.play();
      currentActionRef.current = nextAction;
    },
    [actions],
  );

  useEffect(() => {
    if (!animationRef) {
      playAnimation(animationName);
    }
  }, [animationName, animationRef, playAnimation]);

  const lastAnimRef = useRef<string>("");
  useFrame(() => {
    if (!animationRef?.current) return;
    const raw = animationRef.current;
    if (raw === lastAnimRef.current) return;
    lastAnimRef.current = raw;

    let mapped: AgentAvatarGlbAnimation;
    if (raw === "walking" || raw === "walk") {
      mapped = "walk";
    } else if (raw === "sitting" || raw === "sit") {
      mapped = "sitting";
    } else if (raw.startsWith("dancing:") || raw.startsWith("dance:")) {
      const style = raw.split(":")[1];
      if (style === "disco") mapped = "dance_disco";
      else if (style === "wave") mapped = "dance_wave";
      else if (style === "spin") mapped = "dance_spin";
      else if (style === "rock") mapped = "dance_rock";
      else mapped = "dance_cheer";
    } else if (raw === "dancing" || raw === "special" || raw === "cheer") {
      mapped = "dance_cheer";
    } else if (raw === "disco") {
      mapped = "dance_disco";
    } else if (raw === "wave") {
      mapped = "dance_wave";
    } else if (raw === "spin") {
      mapped = "dance_spin";
    } else if (raw === "rock") {
      mapped = "dance_rock";
    } else if (raw === "working_out" || raw === "attack") {
      mapped = "attack";
    } else if (raw === "run") {
      mapped = "run";
    } else if (raw === "death" || raw === "dead") {
      mapped = "death";
    } else if (raw === "hit") {
      mapped = "hit";
    } else {
      mapped = "idle";
    }
    playAnimation(mapped);
  });

  useEffect(() => {
    return () => {
      mixer.stopAllAction();
      mixer.uncacheRoot(clonedScene);
      currentActionRef.current = null;
    };
  }, [mixer, clonedScene]);

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
