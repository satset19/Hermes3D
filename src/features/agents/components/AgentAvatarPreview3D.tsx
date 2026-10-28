"use client";

import { Environment, OrbitControls } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import {
  type AgentAvatarProfile,
  createDefaultAgentAvatarProfile,
} from "@/lib/avatars/profile";
import { RunningAvatarLoader } from "@/features/agents/components/RunningAvatarLoader";
import { getAvatarBodyShape } from "@/lib/avatars/bodyShape";
import {
  AvatarFeminineHair,
  AvatarLashes,
  AvatarLegClothing,
  AvatarSkirt,
} from "@/features/agents/components/avatar3d/AvatarGenderParts";
import { AgentAvatarGlbModel } from "@/features/agents/components/AgentAvatarGlbModel";
import { findAnimePresetModelUrl } from "@/lib/avatars/animePresets";

const PreviewFigure = ({
  profile,
}: {
  profile: AgentAvatarProfile;
}) => {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!groupRef.current) return;
    groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.45) * 0.35 + 0.25;
  });

  const rawUrl = profile.imageUrl?.trim() ?? "";
  const isDirect3DModel =
    rawUrl.startsWith("blob:") ||
    rawUrl.endsWith(".glb") ||
    rawUrl.endsWith(".gltf") ||
    rawUrl.endsWith(".vrm");
  const presetModelUrl = isDirect3DModel ? rawUrl : findAnimePresetModelUrl(profile.imageUrl);
  const figureScale = profile.scale ?? 1.0;
  const avatarColors = useMemo(
    () => ({
      skin: profile.body.skinTone,
      hair: profile.hair.color,
      top: profile.clothing.topColor,
      bottom: profile.clothing.bottomColor,
      shoes: profile.clothing.shoesColor,
    }),
    [
      profile.body.skinTone,
      profile.hair.color,
      profile.clothing.topColor,
      profile.clothing.bottomColor,
      profile.clothing.shoesColor,
    ],
  );

  if (presetModelUrl) {
    return (
      <group
        ref={groupRef}
        position={[0, 0, 0]}
        scale={[figureScale, figureScale, figureScale]}
      >
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
          <circleGeometry args={[0.28, 24]} />
          <meshBasicMaterial color="#000000" transparent opacity={0.16} />
        </mesh>
        <Suspense fallback={null}>
          <AgentAvatarGlbModel
            modelUrl={presetModelUrl}
            animationName="idle"
            targetHeight={1.2}
            colors={avatarColors}
          />
        </Suspense>
      </group>
    );
  }

  const skin = profile.body.skinTone;
  const topColor = profile.clothing.topColor;
  const bottomColor = profile.clothing.bottomColor;
  const shoeColor = profile.clothing.shoesColor;
  const hairColor = profile.hair.color;
  const accessoryColor = topColor;
  const sleeveColor = profile.clothing.topStyle === "jacket" ? "#dbe4ff" : topColor;
  const cuffColor = profile.clothing.topStyle === "hoodie" ? "#d1d5db" : sleeveColor;
  const shape = getAvatarBodyShape(profile.body.gender);
  const bottomStyle = profile.clothing.bottomStyle;

  return (
    <group
      ref={groupRef}
      position={[0, 0, 0]}
      scale={[1.4 * figureScale, 1.4 * figureScale, 1.4 * figureScale]}
    >
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <circleGeometry args={[0.22, 24]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.16} />
      </mesh>

      {profile.accessories.backpack ? (
        <group position={[0, 0.31, -0.08]}>
          <mesh>
            <boxGeometry args={[0.16, 0.2, 0.06]} />
            <meshLambertMaterial color={accessoryColor} />
          </mesh>
        </group>
      ) : null}

      <group position={[-0.05, 0.12, 0]}>
        <AvatarLegClothing bottomStyle={bottomStyle} bottomColor={bottomColor} skin={skin} />
        <mesh position={[0, -0.09, 0]}>
          <boxGeometry args={[0.07, 0.05, 0.12]} />
          <meshLambertMaterial color={shoeColor} />
        </mesh>
      </group>
      <group position={[0.05, 0.12, 0]}>
        <AvatarLegClothing bottomStyle={bottomStyle} bottomColor={bottomColor} skin={skin} />
        <mesh position={[0, -0.09, 0]}>
          <boxGeometry args={[0.07, 0.05, 0.12]} />
          <meshLambertMaterial color={shoeColor} />
        </mesh>
      </group>
      {bottomStyle === "skirt" ? <AvatarSkirt color={bottomColor} y={0.15} /> : null}

      <mesh position={[0, 0.3, 0]}>
        <boxGeometry args={[0.2 * shape.torsoWidthScale, 0.22, 0.1 * shape.torsoDepthScale]} />
        <meshLambertMaterial color={topColor} />
      </mesh>
      {profile.clothing.topStyle === "hoodie" ? (
        <>
          <mesh position={[0, 0.37, -0.045]}>
            <boxGeometry args={[0.18 * shape.torsoWidthScale, 0.1, 0.03]} />
            <meshLambertMaterial color={topColor} />
          </mesh>
          <mesh position={[0, 0.23, 0.056]}>
            <boxGeometry args={[0.11, 0.03, 0.012]} />
            <meshLambertMaterial color={cuffColor} />
          </mesh>
        </>
      ) : null}
      {profile.clothing.topStyle === "jacket" ? (
        <>
          <mesh position={[0, 0.3, 0.056]}>
            <boxGeometry args={[0.202 * shape.torsoWidthScale, 0.23, 0.012]} />
            <meshLambertMaterial color="#1f2937" />
          </mesh>
          <mesh position={[0, 0.3, 0.063]}>
            <boxGeometry args={[0.038, 0.21, 0.01]} />
            <meshLambertMaterial color="#f8fafc" />
          </mesh>
        </>
      ) : null}

      <group position={[-0.13 * shape.armOffsetScale, 0.3, 0]}>
        <mesh position={[0, -0.08, 0]}>
          <boxGeometry args={[0.06, 0.16, 0.06]} />
          <meshLambertMaterial color={sleeveColor} />
        </mesh>
        {profile.clothing.topStyle === "hoodie" ? (
          <mesh position={[0, -0.145, 0]}>
            <boxGeometry args={[0.064, 0.03, 0.064]} />
            <meshLambertMaterial color={cuffColor} />
          </mesh>
        ) : null}
        <mesh position={[0, -0.17, 0]}>
          <boxGeometry args={[0.05, 0.05, 0.05]} />
          <meshLambertMaterial color={skin} />
        </mesh>
      </group>
      <group position={[0.13 * shape.armOffsetScale, 0.3, 0]}>
        <mesh position={[0, -0.08, 0]}>
          <boxGeometry args={[0.06, 0.16, 0.06]} />
          <meshLambertMaterial color={sleeveColor} />
        </mesh>
        {profile.clothing.topStyle === "hoodie" ? (
          <mesh position={[0, -0.145, 0]}>
            <boxGeometry args={[0.064, 0.03, 0.064]} />
            <meshLambertMaterial color={cuffColor} />
          </mesh>
        ) : null}
        <mesh position={[0, -0.17, 0]}>
          <boxGeometry args={[0.05, 0.05, 0.05]} />
          <meshLambertMaterial color={skin} />
        </mesh>
      </group>

      <mesh position={[0, 0.42, 0]}>
        <boxGeometry args={[0.07, 0.05, 0.07]} />
        <meshLambertMaterial color={skin} />
      </mesh>
      <mesh position={[0, 0.5, 0]}>
        <boxGeometry args={[0.17, 0.17, 0.15]} />
        <meshLambertMaterial color={skin} />
      </mesh>

      {profile.hair.style === "short" ? (
        <mesh position={[0, 0.59, 0]}>
          <boxGeometry args={[0.18, 0.05, 0.15]} />
          <meshLambertMaterial color={hairColor} />
        </mesh>
      ) : null}
      {profile.hair.style === "parted" ? (
        <>
          <mesh position={[0, 0.585, 0]}>
            <boxGeometry args={[0.18, 0.045, 0.15]} />
            <meshLambertMaterial color={hairColor} />
          </mesh>
          <mesh position={[-0.03, 0.62, 0.01]} rotation={[0.1, 0, -0.2]}>
            <boxGeometry args={[0.12, 0.03, 0.08]} />
            <meshLambertMaterial color={hairColor} />
          </mesh>
        </>
      ) : null}
      {profile.hair.style === "spiky" ? (
        <>
          <mesh position={[0, 0.58, 0]}>
            <boxGeometry args={[0.17, 0.035, 0.14]} />
            <meshLambertMaterial color={hairColor} />
          </mesh>
          <mesh position={[-0.05, 0.62, 0]} rotation={[0, 0, -0.2]}>
            <boxGeometry args={[0.04, 0.06, 0.04]} />
            <meshLambertMaterial color={hairColor} />
          </mesh>
          <mesh position={[0, 0.635, 0]}>
            <boxGeometry args={[0.04, 0.08, 0.04]} />
            <meshLambertMaterial color={hairColor} />
          </mesh>
          <mesh position={[0.05, 0.62, 0]} rotation={[0, 0, 0.2]}>
            <boxGeometry args={[0.04, 0.06, 0.04]} />
            <meshLambertMaterial color={hairColor} />
          </mesh>
        </>
      ) : null}
      {profile.hair.style === "bun" ? (
        <>
          <mesh position={[0, 0.58, 0]}>
            <boxGeometry args={[0.18, 0.04, 0.15]} />
            <meshLambertMaterial color={hairColor} />
          </mesh>
          <mesh position={[0, 0.63, -0.03]}>
            <sphereGeometry args={[0.045, 16, 16]} />
            <meshLambertMaterial color={hairColor} />
          </mesh>
        </>
      ) : null}
      <AvatarFeminineHair
        style={profile.hair.style}
        color={hairColor}
        headY={0.5}
        headSize={0.17}
      />

      {profile.accessories.hatStyle === "cap" ? (
        <>
          <mesh position={[0, 0.63, 0]}>
            <boxGeometry args={[0.18, 0.03, 0.16]} />
            <meshLambertMaterial color={accessoryColor} />
          </mesh>
          <mesh position={[0, 0.615, 0.07]}>
            <boxGeometry args={[0.09, 0.012, 0.05]} />
            <meshLambertMaterial color={accessoryColor} />
          </mesh>
        </>
      ) : null}
      {profile.accessories.hatStyle === "beanie" ? (
        <mesh position={[0, 0.63, 0]}>
          <boxGeometry args={[0.19, 0.06, 0.17]} />
          <meshLambertMaterial color={accessoryColor} />
        </mesh>
      ) : null}

      {profile.accessories.headset ? (
        <>
          <mesh position={[0, 0.6, 0]} rotation={[0, 0, Math.PI / 2]}>
            <torusGeometry args={[0.095, 0.008, 8, 24, Math.PI]} />
            <meshLambertMaterial color="#94a3b8" />
          </mesh>
          <mesh position={[-0.105, 0.51, 0]}>
            <boxGeometry args={[0.018, 0.05, 0.028]} />
            <meshLambertMaterial color="#475569" />
          </mesh>
          <mesh position={[0.105, 0.51, 0]}>
            <boxGeometry args={[0.018, 0.05, 0.028]} />
            <meshLambertMaterial color="#475569" />
          </mesh>
        </>
      ) : null}

      <mesh position={[-0.04, 0.505, 0.078]}>
        <boxGeometry args={[0.03, 0.03, 0.01]} />
        <meshBasicMaterial color="#111827" />
      </mesh>
      <mesh position={[0.04, 0.505, 0.078]}>
        <boxGeometry args={[0.03, 0.03, 0.01]} />
        <meshBasicMaterial color="#111827" />
      </mesh>
      {profile.accessories.glasses ? (
        <>
          <mesh position={[-0.04, 0.505, 0.084]}>
            <boxGeometry args={[0.05, 0.05, 0.01]} />
            <meshBasicMaterial color="#111827" wireframe />
          </mesh>
          <mesh position={[0.04, 0.505, 0.084]}>
            <boxGeometry args={[0.05, 0.05, 0.01]} />
            <meshBasicMaterial color="#111827" wireframe />
          </mesh>
          <mesh position={[0, 0.505, 0.084]}>
            <boxGeometry args={[0.02, 0.008, 0.01]} />
            <meshBasicMaterial color="#111827" />
          </mesh>
        </>
      ) : null}
      {shape.showLashes ? <AvatarLashes eyeY={0.505} faceZ={0.078} /> : null}
      <mesh position={[0, 0.46, 0.079]}>
        <boxGeometry args={[0.05, 0.014, 0.01]} />
        <meshBasicMaterial color={shape.mouthColor} />
      </mesh>
    </group>
  );
};

export const AgentAvatarPreview3D = ({
  profile,
  className = "",
}: {
  profile: AgentAvatarProfile | null | undefined;
  className?: string;
}) => {
  const resolvedProfile = useMemo(
    () => profile ?? createDefaultAgentAvatarProfile("preview"),
    [profile]
  );
  return (
    <div className={`relative ${className}`}>
      <Canvas
        gl={{ preserveDrawingBuffer: true, alpha: true }}
        camera={{ position: [0, 0.6, 3.2], fov: 34 }}
      >
        <ambientLight intensity={1.4} />
        <directionalLight position={[3, 4, 5]} intensity={2.4} />
        <directionalLight position={[-4, 2, 3]} intensity={0.9} color="#89a6ff" />
        <PreviewFigure profile={resolvedProfile} />
        <OrbitControls
          target={[0, 0.6, 0]}
          enablePan={false}
          enableZoom={false}
          maxPolarAngle={1.8}
          minPolarAngle={1.1}
        />
      </Canvas>
    </div>
  );
};
