"use client";

// Atmosphere and cinematic rendering systems for the immersive office:
// image-based lighting from a bundled CC0 HDRI sky, a physically-plausible
// sun rig with soft shadows, depth fog, a slow daylight drift, exterior
// grounds (plaza apron, lawn, trees), drifting dust motes, and the
// post-processing chain (ambient occlusion, bloom, vignette, filmic tone
// mapping, SMAA, follow-cam depth of field).

import { Environment } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import {
  Bloom,
  DepthOfField,
  EffectComposer,
  N8AO,
  SMAA,
  ToneMapping,
  Vignette,
} from "@react-three/postprocessing";
import type { DepthOfFieldEffect } from "postprocessing";
import { ToneMappingMode } from "postprocessing";
import { Suspense, useEffect, useMemo, useRef, type MutableRefObject } from "react";
import * as THREE from "three";
import type { GraphicsQualityConfig } from "@/features/retro-office/core/graphicsQuality";
import {
  CANVAS_H,
  CANVAS_W,
  SCALE,
  WORLD_H,
  WORLD_W,
} from "@/features/retro-office/core/constants";
import {
  LOCAL_OFFICE_CANVAS_HEIGHT,
  LOCAL_OFFICE_CANVAS_WIDTH,
} from "@/features/retro-office/core/district";
import { toWorld } from "@/features/retro-office/core/geometry";
import {
  getConcreteTextures,
  withRepeat,
} from "@/features/retro-office/core/proceduralTextures";

export const OFFICE_ENVIRONMENT_HDR = "/office-assets/env/office_env_1k.hdr";

/** Half-extent of the sun shadow frustum — covers the whole district. */
const SHADOW_EXTENT = Math.max(WORLD_W, WORLD_H) * 0.72;

/** Period of the subtle daylight drift, in seconds. */
const DAYLIGHT_DRIFT_PERIOD = 480;

const SUN_BASE_POSITION = new THREE.Vector3(16, 24, 13);
const SUN_WARM = new THREE.Color("#ffe3bd");
const SUN_NEUTRAL = new THREE.Color("#fff4e4");

/** Deterministic hash so the exterior looks identical across sessions. */
const hash1 = (n: number) => {
  let h = (n + 1) * 374761393;
  h = (h ^ (h >> 13)) * 1274126177;
  h ^= h >> 16;
  return (h >>> 0) / 4294967295;
};

/**
 * Slowly drifts the sun between a warm golden tone and neutral daylight so
 * the office feels alive without ever leaving flattering light. Kept subtle
 * on purpose — hard day/night swings fight the fixed HDRI sky.
 */
function DaylightDrift({
  sunRef,
}: {
  sunRef: MutableRefObject<THREE.DirectionalLight | null>;
}) {
  const elapsedRef = useRef(0);
  const lastPositionPhaseRef = useRef(-1);

  useFrame((_, delta) => {
    const sun = sunRef.current;
    if (!sun) return;
    elapsedRef.current += delta;
    const phase =
      (Math.sin((elapsedRef.current / DAYLIGHT_DRIFT_PERIOD) * Math.PI * 2) + 1) / 2;
    sun.intensity = 3.05 + phase * 0.5;
    sun.color.copy(SUN_WARM).lerp(SUN_NEUTRAL, phase);
    // Sun swings a few degrees across the sky over the drift period.
    // Avoid mutating sun.position every frame unless phase changes significantly (>0.005)
    // so directional light's shadow map matrix is not dirtied on every frame.
    if (Math.abs(phase - lastPositionPhaseRef.current) > 0.005) {
      lastPositionPhaseRef.current = phase;
      const sway = (phase - 0.5) * 6;
      sun.position.set(
        SUN_BASE_POSITION.x + sway,
        SUN_BASE_POSITION.y,
        SUN_BASE_POSITION.z - sway * 0.5,
      );
    }
  });

  return null;
}

const CANOPY_COLORS = ["#4d7038", "#5a7f40", "#446331"];

type TreeData = {
  position: [number, number, number];
  scale: number;
  seed: number;
};

/**
 * Instanced park trees ringing the campus: 1 instancedMesh for trunks
 * and 1 instancedMesh for 3 canopy layers per tree (reducing 72 individual meshes to 2 instanced meshes).
 */
function ParkTreesInstanced({ trees }: { trees: TreeData[] }) {
  const trunkRef = useRef<THREE.InstancedMesh>(null);
  const canopyRef = useRef<THREE.InstancedMesh>(null);

  useEffect(() => {
    const trunkMesh = trunkRef.current;
    const canopyMesh = canopyRef.current;
    if (
      !trunkMesh ||
      !canopyMesh ||
      typeof trunkMesh.setMatrixAt !== "function" ||
      typeof canopyMesh.setMatrixAt !== "function"
    ) {
      return;
    }

    const groupObj = new THREE.Object3D();
    const localObj = new THREE.Object3D();
    const tempMatrix = new THREE.Matrix4();
    const tempColor = new THREE.Color();

    trees.forEach((tree, treeIndex) => {
      const { position, scale, seed } = tree;
      const lean = (hash1(seed * 7) - 0.5) * 0.14;

      groupObj.position.set(position[0], position[1], position[2]);
      groupObj.rotation.set(0, 0, lean);
      groupObj.scale.set(scale, scale, scale);
      groupObj.updateMatrix();

      // Trunk
      localObj.position.set(0, 0.8, 0);
      localObj.rotation.set(0, 0, 0);
      localObj.scale.set(1, 1, 1);
      localObj.updateMatrix();

      tempMatrix.multiplyMatrices(groupObj.matrix, localObj.matrix);
      trunkMesh.setMatrixAt(treeIndex, tempMatrix);

      // Canopy 3 layers per tree
      for (let layerIndex = 0; layerIndex < 3; layerIndex += 1) {
        const instanceIndex = treeIndex * 3 + layerIndex;
        const angle = hash1(seed * 13 + layerIndex) * Math.PI * 2;
        const spread = 0.28 + hash1(seed * 17 + layerIndex) * 0.2;
        const r = 0.85 - layerIndex * 0.16;

        localObj.position.set(
          Math.cos(angle) * spread * 0.6,
          1.7 + layerIndex * 0.34,
          Math.sin(angle) * spread * 0.6,
        );
        localObj.rotation.set(0, 0, 0);
        localObj.scale.set(r, r, r);
        localObj.updateMatrix();

        tempMatrix.multiplyMatrices(groupObj.matrix, localObj.matrix);
        canopyMesh.setMatrixAt(instanceIndex, tempMatrix);

        tempColor.set(CANOPY_COLORS[(seed + layerIndex) % CANOPY_COLORS.length]);
        canopyMesh.setColorAt(instanceIndex, tempColor);
      }
    });

    trunkMesh.instanceMatrix.needsUpdate = true;
    canopyMesh.instanceMatrix.needsUpdate = true;
    if (canopyMesh.instanceColor) {
      canopyMesh.instanceColor.needsUpdate = true;
    }
  }, [trees]);

  if (trees.length === 0) return null;

  return (
    <group>
      <instancedMesh
        ref={trunkRef}
        args={[undefined, undefined, trees.length]}
      >
        <cylinderGeometry args={[0.09, 0.14, 1.6, 8]} />
        <meshStandardMaterial color="#5d4a36" roughness={0.95} />
      </instancedMesh>
      <instancedMesh
        ref={canopyRef}
        args={[undefined, undefined, trees.length * 3]}
      >
        <sphereGeometry args={[1, 12, 10]} />
        <meshStandardMaterial roughness={1} />
      </instancedMesh>
    </group>
  );
}

const DUST_COUNT = 60;

const dustMotesVertexShader = /* glsl */ `
  uniform float uTime;
  attribute float aSpeed;
  attribute float aPhase;

  void main() {
    vec3 pos = position;
    pos.y = 0.15 + mod(pos.y - 0.15 + aSpeed * uTime, 2.25);
    pos.x += sin(uTime * 0.3 + aPhase) * 0.08;
    pos.z += cos(uTime * 0.24 + aPhase) * 0.08;

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    bool isPerspective = projectionMatrix[2][3] != 0.0;
    if (isPerspective) {
      gl_PointSize = clamp(24.0 / -mvPosition.z, 1.5, 6.0);
    } else {
      gl_PointSize = 3.0;
    }
  }
`;

const dustMotesFragmentShader = /* glsl */ `
  void main() {
    float dist = length(gl_PointCoord - vec2(0.5));
    if (dist > 0.5) discard;
    float alpha = smoothstep(0.5, 0.0, dist) * 0.32;
    gl_FragColor = vec4(vec3(1.0, 0.914, 0.769), alpha);
  }
`;

/**
 * Faint warm dust motes drifting through the office air — GPU vertex shader
 * animated so BufferAttribute is not mutated CPU-to-GPU every frame.
 */
function DustMotes({
  centerX,
  centerZ,
  extentX,
  extentZ,
}: {
  centerX: number;
  centerZ: number;
  extentX: number;
  extentZ: number;
}) {
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), []);

  const { positions, speeds, phases } = useMemo(() => {
    const positionsArray = new Float32Array(DUST_COUNT * 3);
    const speedsArray = new Float32Array(DUST_COUNT);
    const phasesArray = new Float32Array(DUST_COUNT);
    for (let index = 0; index < DUST_COUNT; index += 1) {
      positionsArray[index * 3] = centerX + (hash1(index * 3 + 1) - 0.5) * extentX;
      positionsArray[index * 3 + 1] = 0.15 + hash1(index * 3 + 2) * 2.1;
      positionsArray[index * 3 + 2] = centerZ + (hash1(index * 3 + 3) - 0.5) * extentZ;
      speedsArray[index] = 0.02 + hash1(index * 5 + 4) * 0.05;
      phasesArray[index] = hash1(index * 7 + 5) * Math.PI * 2;
    }
    return { positions: positionsArray, speeds: speedsArray, phases: phasesArray };
  }, [centerX, centerZ, extentX, extentZ]);

  useFrame((_, delta) => {
    if (document.visibilityState !== "visible") return;
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value += delta;
    }
  });

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-aSpeed" args={[speeds, 1]} />
        <bufferAttribute attach="attributes-aPhase" args={[phases, 1]} />
      </bufferGeometry>
      <shaderMaterial
        ref={materialRef}
        uniforms={uniforms}
        vertexShader={dustMotesVertexShader}
        fragmentShader={dustMotesFragmentShader}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

export function SceneAtmosphere({
  config,
  remoteOfficeEnabled = true,
}: {
  config: GraphicsQualityConfig;
  remoteOfficeEnabled?: boolean;
}) {
  const sunRef = useRef<THREE.DirectionalLight | null>(null);
  const apronConcrete = useMemo(
    () => withRepeat(getConcreteTextures(), 12, 12),
    [],
  );

  // The active grounds match the district when the remote office is shown,
  // otherwise just the local office footprint.
  const [districtCenterX, , districtCenterZ] = toWorld(CANVAS_W / 2, CANVAS_H / 2);
  const [localCenterX, , localCenterZ] = toWorld(
    LOCAL_OFFICE_CANVAS_WIDTH / 2,
    LOCAL_OFFICE_CANVAS_HEIGHT / 2,
  );
  const groundCenterX = remoteOfficeEnabled ? districtCenterX : localCenterX;
  const groundCenterZ = remoteOfficeEnabled ? districtCenterZ : localCenterZ;
  const groundWidth = remoteOfficeEnabled ? CANVAS_W * SCALE : LOCAL_OFFICE_CANVAS_WIDTH * SCALE;
  const groundHeight = remoteOfficeEnabled
    ? CANVAS_H * SCALE
    : LOCAL_OFFICE_CANVAS_HEIGHT * SCALE;

  const trees = useMemo(() => {
    const halfWidth = groundWidth / 2;
    const halfHeight = groundHeight / 2;
    const list: Array<{ position: [number, number, number]; scale: number; seed: number }> = [];
    const count = 18;
    for (let index = 0; index < count; index += 1) {
      const angle = ((index + 0.5) / count) * Math.PI * 2;
      const ringX = halfWidth + 6 + hash1(index * 11) * 10;
      const ringZ = halfHeight + 6 + hash1(index * 19) * 10;
      list.push({
        position: [
          groundCenterX + Math.cos(angle) * ringX,
          0,
          groundCenterZ + Math.sin(angle) * ringZ,
        ],
        scale: 0.85 + hash1(index * 23) * 0.7,
        seed: index + 1,
      });
    }
    return list;
  }, [groundCenterX, groundCenterZ, groundWidth, groundHeight]);

  return (
    <>
      {/* Depth fog — pushes the far grounds into soft haze for scale. */}
      <fog attach="fog" args={["#c3cedb", 58, 165]} />

      {/* Sky + image-based lighting from the bundled CC0 HDRI. */}
      <Suspense fallback={null}>
        <Environment
          files={OFFICE_ENVIRONMENT_HDR}
          background
          backgroundBlurriness={0.04}
          backgroundIntensity={1}
          environmentIntensity={0.55}
          backgroundRotation={[0, Math.PI * 0.85, 0]}
          environmentRotation={[0, Math.PI * 0.85, 0]}
        />
      </Suspense>

      {/* Sky/ground bounce fill. */}
      <hemisphereLight args={["#cfe0f4", "#8a6b4d", 0.38]} />

      {/* Warm key sun with tight, high-resolution soft shadows. */}
      <directionalLight
        ref={sunRef}
        position={SUN_BASE_POSITION.toArray()}
        intensity={3.3}
        color="#ffedd2"
        castShadow
        shadow-mapSize={[config.shadowMapSize, config.shadowMapSize]}
        shadow-bias={-0.00015}
        shadow-normalBias={0.025}
        shadow-radius={4}
        shadow-camera-left={-SHADOW_EXTENT}
        shadow-camera-right={SHADOW_EXTENT}
        shadow-camera-top={SHADOW_EXTENT}
        shadow-camera-bottom={-SHADOW_EXTENT}
        shadow-camera-near={1}
        shadow-camera-far={90}
      />

      {/* Cool sky fill from the opposite side — lifts shadowed faces. */}
      <directionalLight position={[-14, 12, -10]} intensity={0.55} color="#a7c4ef" />

      {/* Concrete plaza apron directly around the building. */}
      <mesh
        position={[groundCenterX, -0.045, groundCenterZ]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[groundWidth + 9, groundHeight + 9]} />
        <meshStandardMaterial
          color="#9a998f"
          map={apronConcrete.map}
          roughnessMap={apronConcrete.roughnessMap}
          normalMap={apronConcrete.normalMap}
          normalScale={[0.5, 0.5]}
          roughness={1}
          metalness={0}
        />
      </mesh>

      {/* Vast lawn so the office sits on land instead of floating in the
          sky — the fog fades it into the horizon. */}
      <mesh position={[0, -0.06, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[420, 48]} />
        <meshStandardMaterial color="#55654a" roughness={1} metalness={0} />
      </mesh>

      {/* Park trees ringing the campus. */}
      <ParkTreesInstanced trees={trees} />

      {/* Drifting dust motes over the office interior. */}
      <DustMotes
        centerX={groundCenterX}
        centerZ={groundCenterZ}
        extentX={groundWidth * 0.9}
        extentZ={groundHeight * 0.9}
      />

      <DaylightDrift sunRef={sunRef} />
    </>
  );
}

/**
 * Keeps the depth-of-field focus locked on the followed agent by measuring
 * the camera-to-focus-point distance each frame.
 */
function FollowFocusUpdater({
  dofRef,
  focusPointRef,
}: {
  dofRef: MutableRefObject<DepthOfFieldEffect | null>;
  focusPointRef: MutableRefObject<THREE.Vector3>;
}) {
  useFrame(({ camera }) => {
    const dof = dofRef.current;
    if (!dof) return;
    const distance = camera.position.distanceTo(focusPointRef.current);
    dof.cocMaterial.focusDistance = distance;
  });
  return null;
}

export function ScenePostFx({
  config,
  followActive,
  followFocusPointRef,
}: {
  config: GraphicsQualityConfig;
  followActive: boolean;
  followFocusPointRef: MutableRefObject<THREE.Vector3>;
}) {
  const dofRef = useRef<DepthOfFieldEffect | null>(null);
  const showDof = followActive && config.followDepthOfField;

  if (!config.postProcessing) return null;

  return (
    <>
      {showDof ? (
        <FollowFocusUpdater dofRef={dofRef} focusPointRef={followFocusPointRef} />
      ) : null}
      <EffectComposer multisampling={0}>
        {config.ambientOcclusion ? (
          <N8AO
            halfRes
            depthAwareUpsampling
            quality={config.aoQuality}
            aoRadius={0.5}
            distanceFalloff={0.8}
            intensity={2.4}
          />
        ) : (
          <></>
        )}
        {config.bloom ? (
          <Bloom
            mipmapBlur
            intensity={0.5}
            luminanceThreshold={1.05}
            luminanceSmoothing={0.25}
          />
        ) : (
          <></>
        )}
        <DepthOfField
          ref={dofRef}
          focusDistance={2.2}
          focusRange={1.6}
          bokehScale={showDof ? 4 : 0}
          focalLength={0.06}
        />
        <Vignette eskil={false} offset={0.26} darkness={0.55} />
        <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
        {config.smaa ? <SMAA /> : <></>}
      </EffectComposer>
    </>
  );
}
