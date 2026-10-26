"use client";

import type { ReactNode } from "react";
import type {
  AgentAvatarBottomStyle,
  AgentAvatarHairStyle,
} from "@/lib/avatars/profile";

// Hair geometry is authored for a 0.16 head centered at the origin and scaled to fit.
const BASE_HEAD_SIZE = 0.16;
const LASH_COLOR = "#111827";

type Vec3 = [number, number, number];

const Box = ({
  size,
  position,
  rotation,
  color,
}: {
  size: Vec3;
  position: Vec3;
  rotation?: Vec3;
  color: string;
}) => (
  <mesh position={position} rotation={rotation}>
    <boxGeometry args={size} />
    <meshLambertMaterial color={color} />
  </mesh>
);

export const AvatarFeminineHair = ({
  style,
  color,
  headY,
  headSize,
}: {
  style: AgentAvatarHairStyle;
  color: string;
  headY: number;
  headSize: number;
}) => {
  const s = headSize / BASE_HEAD_SIZE;
  let parts: ReactNode = null;
  if (style === "long") {
    parts = (
      <>
        <Box size={[0.17, 0.05, 0.15]} position={[0, 0.085, 0]} color={color} />
        <Box size={[0.17, 0.22, 0.03]} position={[0, -0.03, -0.075]} color={color} />
        <Box size={[0.025, 0.18, 0.12]} position={[-0.085, -0.01, -0.01]} color={color} />
        <Box size={[0.025, 0.18, 0.12]} position={[0.085, -0.01, -0.01]} color={color} />
      </>
    );
  } else if (style === "ponytail") {
    parts = (
      <>
        <Box size={[0.17, 0.045, 0.15]} position={[0, 0.08, 0]} color={color} />
        <mesh position={[0, 0.05, -0.085]}>
          <sphereGeometry args={[0.025, 12, 12]} />
          <meshLambertMaterial color={color} />
        </mesh>
        <Box
          size={[0.04, 0.14, 0.04]}
          position={[0, -0.03, -0.1]}
          rotation={[0.25, 0, 0]}
          color={color}
        />
      </>
    );
  } else if (style === "bob") {
    parts = (
      <>
        <Box size={[0.172, 0.05, 0.152]} position={[0, 0.08, 0]} color={color} />
        <Box size={[0.025, 0.1, 0.13]} position={[-0.087, 0.02, -0.005]} color={color} />
        <Box size={[0.025, 0.1, 0.13]} position={[0.087, 0.02, -0.005]} color={color} />
        <Box size={[0.17, 0.11, 0.03]} position={[0, 0.02, -0.075]} color={color} />
        <Box size={[0.15, 0.03, 0.02]} position={[0, 0.06, 0.075]} color={color} />
      </>
    );
  }
  if (!parts) return null;
  return (
    <group position={[0, headY, 0]} scale={[s, s, s]}>
      {parts}
    </group>
  );
};

export const AvatarLashes = ({ eyeY, faceZ }: { eyeY: number; faceZ: number }) => (
  <>
    <mesh position={[-0.06, eyeY + 0.016, faceZ + 0.002]} rotation={[0, 0, 0.5]}>
      <boxGeometry args={[0.014, 0.008, 0.008]} />
      <meshBasicMaterial color={LASH_COLOR} />
    </mesh>
    <mesh position={[0.06, eyeY + 0.016, faceZ + 0.002]} rotation={[0, 0, -0.5]}>
      <boxGeometry args={[0.014, 0.008, 0.008]} />
      <meshBasicMaterial color={LASH_COLOR} />
    </mesh>
  </>
);

export const AvatarSkirt = ({ color, y }: { color: string; y: number }) => (
  <mesh position={[0, y, 0]}>
    <cylinderGeometry args={[0.085, 0.11, 0.1, 8]} />
    <meshLambertMaterial color={color} />
  </mesh>
);

/** Clothing on one leg above the shoe; the shoe stays with the caller. */
export const AvatarLegClothing = ({
  bottomStyle,
  bottomColor,
  skin,
}: {
  bottomStyle: AgentAvatarBottomStyle;
  bottomColor: string;
  skin: string;
}) => {
  if (bottomStyle === "skirt") {
    return <Box size={[0.05, 0.14, 0.05]} position={[0, 0, 0]} color={skin} />;
  }
  if (bottomStyle === "shorts") {
    return (
      <>
        <Box size={[0.07, 0.08, 0.08]} position={[0, 0.03, 0]} color={bottomColor} />
        <Box size={[0.05, 0.06, 0.05]} position={[0, -0.045, 0]} color={skin} />
      </>
    );
  }
  return (
    <>
      <Box size={[0.07, 0.14, 0.08]} position={[0, 0, 0]} color={bottomColor} />
      {bottomStyle === "cuffed" ? (
        <Box size={[0.074, 0.022, 0.084]} position={[0, -0.05, 0]} color="#d1d5db" />
      ) : null}
    </>
  );
};
