"use client";

import { memo, useMemo } from "react";
import * as THREE from "three";
import { useGLTF } from "@react-three/drei";
import { SCALE } from "@/features/retro-office/core/constants";
import { toWorld } from "@/features/retro-office/core/geometry";

// Layered foliage clumps sitting on top of a planter box: slightly offset
// flattened spheres in varied greens instead of a flat green slab.
export function PlanterFoliage({
  position,
  spread = 1,
}: {
  position: [number, number, number];
  spread?: number;
}) {
  const clumps: {
    offset: [number, number, number];
    scale: [number, number, number];
    color: string;
  }[] = [
    { offset: [-0.14 * spread, 0, 0.015], scale: [0.13, 0.06, 0.075], color: "#4e7a2f" },
    { offset: [0.02 * spread, 0.012, -0.02], scale: [0.15, 0.07, 0.085], color: "#5f8f38" },
    { offset: [0.15 * spread, 0.004, 0.02], scale: [0.12, 0.055, 0.07], color: "#6da345" },
  ];
  return (
    <group position={position}>
      {clumps.map((clump, index) => (
        <mesh
          key={`foliage-${index}`}
          position={clump.offset}
          scale={clump.scale}
          castShadow
        >
          <sphereGeometry args={[1, 12, 10]} />
          <meshStandardMaterial color={clump.color} roughness={0.98} metalness={0} />
        </mesh>
      ))}
    </group>
  );
}

function RoundTable({
  position,
  rotation = 0,
}: {
  position: [number, number, number];
  rotation?: number;
}) {
  const { scene } = useGLTF("/office-assets/models/furniture/tableRound.glb");
  const model = useMemo(() => {
    const c = scene.clone(true);
    c.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    return c;
  }, [scene]);

  // Centering offset: tableRound min y is -0.27, center is (0.3464, -0.0866, -0.4)
  // Scale is 2.0 (diameter ~1.4m, height ~0.73m)
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <group scale={[2.0, 2.0, 2.0]}>
        <primitive object={model} position={[-0.3464, 0.27, 0.4]} />
      </group>
    </group>
  );
}

function ModernChair({
  position,
  rotation = 0,
}: {
  position: [number, number, number];
  rotation?: number;
}) {
  const { scene } = useGLTF("/office-assets/models/furniture/chairModernCushion.glb");
  const model = useMemo(() => {
    const c = scene.clone(true);
    c.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    return c;
  }, [scene]);

  // Centering offset: min y is 0, center is (0.1, 0.23, -0.1)
  // Scale 1.7 (seat height ~0.45m, total height 0.78m)
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <group scale={[1.7, 1.7, 1.7]}>
        <primitive object={model} position={[-0.1, 0, 0.1]} />
      </group>
    </group>
  );
}

function OutdoorDesk({
  position,
  rotation = 0,
}: {
  position: [number, number, number];
  rotation?: number;
}) {
  const { scene } = useGLTF("/office-assets/models/furniture/desk.glb");
  const model = useMemo(() => {
    const c = scene.clone(true);
    c.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    return c;
  }, [scene]);

  // Centering offset: min y is 0, center is (0.357, 0.192, -0.184)
  // Scale is 1.8 (width 1.32m, height 0.69m, depth 0.7m)
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <group scale={[1.8, 1.8, 1.8]}>
        <primitive object={model} position={[-0.357, 0, 0.184]} />
      </group>
    </group>
  );
}

function PottedPlantModel({
  position,
  scale = 1.6,
}: {
  position: [number, number, number];
  scale?: number;
}) {
  const { scene } = useGLTF("/office-assets/models/furniture/pottedPlant.glb");
  const model = useMemo(() => {
    const c = scene.clone(true);
    c.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    return c;
  }, [scene]);

  return (
    <group position={position}>
      <group scale={[scale, scale, scale]}>
        <primitive object={model} position={[0, 0, 0]} />
      </group>
    </group>
  );
}

function Laptop({
  position,
  rotation = 0,
}: {
  position: [number, number, number];
  rotation?: number;
}) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {/* Laptop base */}
      <mesh position={[0, 0.006, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.3, 0.012, 0.2]} />
        <meshStandardMaterial color="#374151" metalness={0.8} roughness={0.3} />
      </mesh>
      {/* Keyboard surface */}
      <mesh position={[0, 0.013, -0.02]}>
        <planeGeometry args={[0.26, 0.1]} />
        <meshStandardMaterial color="#111827" roughness={0.8} />
      </mesh>
      {/* Trackpad */}
      <mesh position={[0, 0.013, 0.06]}>
        <planeGeometry args={[0.09, 0.05]} />
        <meshStandardMaterial color="#4b5563" roughness={0.4} />
      </mesh>
      {/* Screen lid tilted open */}
      <group position={[0, 0.012, -0.1]} rotation={[-0.32, 0, 0]}>
        <mesh position={[0, 0.095, -0.004]} castShadow>
          <boxGeometry args={[0.3, 0.19, 0.008]} />
          <meshStandardMaterial color="#374151" metalness={0.8} roughness={0.3} />
        </mesh>
        <mesh position={[0, 0.095, 0.001]}>
          <planeGeometry args={[0.28, 0.17]} />
          <meshStandardMaterial
            color="#0284c7"
            emissive="#0284c7"
            emissiveIntensity={0.65}
            roughness={0.2}
          />
        </mesh>
      </group>
    </group>
  );
}

function CoffeeMug({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.045, 0]} castShadow>
        <cylinderGeometry args={[0.035, 0.03, 0.09, 16]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.25} metalness={0.1} />
      </mesh>
      <mesh position={[0, 0.082, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.028, 16]} />
        <meshStandardMaterial color="#3e2723" roughness={0.2} />
      </mesh>
    </group>
  );
}

function WarmLantern({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      {/* Lantern base */}
      <mesh position={[0, 0.015, 0]} castShadow>
        <boxGeometry args={[0.13, 0.03, 0.13]} />
        <meshStandardMaterial color="#212121" roughness={0.5} metalness={0.6} />
      </mesh>
      {/* Frosted glass enclosure */}
      <mesh position={[0, 0.14, 0]}>
        <boxGeometry args={[0.11, 0.22, 0.11]} />
        <meshStandardMaterial
          color="#fff8e1"
          roughness={0.3}
          metalness={0.1}
          transparent
          opacity={0.6}
        />
      </mesh>
      {/* Glowing filament/candle core */}
      <mesh position={[0, 0.12, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 0.1, 12]} />
        <meshStandardMaterial
          color="#ffb300"
          emissive="#ff8f00"
          emissiveIntensity={2.4}
          roughness={0.3}
        />
      </mesh>
      {/* Top cap */}
      <mesh position={[0, 0.265, 0]} castShadow>
        <boxGeometry args={[0.14, 0.03, 0.14]} />
        <meshStandardMaterial color="#212121" roughness={0.5} metalness={0.6} />
      </mesh>
      <pointLight color="#ffa726" intensity={0.5} distance={2.5} decay={2} />
    </group>
  );
}

export type GardenWorkspaceProps = {
  position?: [number, number, number];
};

export const GardenWorkspace = memo(function GardenWorkspace({
  position,
}: GardenWorkspaceProps) {
  // Target: CITY_PATH_ZONE (Y: 780 to 940, X: 600 to 1200)
  const defaultPosition = useMemo(() => {
    const [wx, , wz] = toWorld((600 + 1200) / 2, (780 + 940) / 2);
    return [wx, 0, wz] as [number, number, number];
  }, []);

  const basePos = position ?? defaultPosition;

  // Deck dimensions:
  // 600 width * SCALE (0.018) = 10.8m
  // 160 height * SCALE (0.018) = 2.88m
  const deckWidth = (1200 - 600) * SCALE;
  const deckDepth = (940 - 780) * SCALE;
  const deckHeight = 0.04;

  // Subtle planks running longitudinally along X
  const plankCount = 14;
  const plankDepth = (deckDepth - 0.16) / plankCount;

  // Pergola post coordinates relative to center
  const postXCoords = [-4.8, -1.6, 1.6, 4.8];
  const postZCoords = [-1.18, 1.18];

  // Pergola roof slats along X
  const slatCount = 29;
  const slatSpacing = 9.4 / (slatCount - 1);

  // String light bulbs along 2 catenary wires
  const bulbCount = 11;
  const bulbSpacing = 9.2 / (bulbCount - 1);

  return (
    <group position={basePos}>
      {/* ================================================================= */}
      {/* 1. WOODEN DECK PATIO FLOORING (#6d4c41) WITH SUBTLE PLANKS        */}
      {/* ================================================================= */}
      {/* Sub-base foundation */}
      <mesh position={[0, deckHeight / 2, 0]} receiveShadow>
        <boxGeometry args={[deckWidth, deckHeight, deckDepth]} />
        <meshStandardMaterial
          color="#54382e"
          roughness={0.88}
          metalness={0.04}
        />
      </mesh>

      {/* Subtle deck planks with tonal variations */}
      {Array.from({ length: plankCount }).map((_, index) => {
        const pz = -deckDepth / 2 + 0.08 + index * plankDepth + plankDepth / 2;
        const plankColors = ["#6d4c41", "#68483e", "#735247", "#64443a"];
        const color = plankColors[index % plankColors.length];
        return (
          <mesh
            key={`deck-plank-${index}`}
            position={[0, deckHeight + 0.002, pz]}
            receiveShadow
          >
            <boxGeometry args={[deckWidth - 0.1, 0.004, plankDepth - 0.012]} />
            <meshStandardMaterial
              color={color}
              roughness={0.78}
              metalness={0.04}
            />
          </mesh>
        );
      })}

      {/* Perimeter fascia frame borders */}
      <mesh
        position={[0, deckHeight + 0.003, -deckDepth / 2 + 0.035]}
        receiveShadow
      >
        <boxGeometry args={[deckWidth, 0.006, 0.07]} />
        <meshStandardMaterial color="#54382e" roughness={0.82} metalness={0.05} />
      </mesh>
      <mesh
        position={[0, deckHeight + 0.003, deckDepth / 2 - 0.035]}
        receiveShadow
      >
        <boxGeometry args={[deckWidth, 0.006, 0.07]} />
        <meshStandardMaterial color="#54382e" roughness={0.82} metalness={0.05} />
      </mesh>
      <mesh
        position={[-deckWidth / 2 + 0.035, deckHeight + 0.003, 0]}
        receiveShadow
      >
        <boxGeometry args={[0.07, 0.006, deckDepth]} />
        <meshStandardMaterial color="#54382e" roughness={0.82} metalness={0.05} />
      </mesh>
      <mesh
        position={[deckWidth / 2 - 0.035, deckHeight + 0.003, 0]}
        receiveShadow
      >
        <boxGeometry args={[0.07, 0.006, deckDepth]} />
        <meshStandardMaterial color="#54382e" roughness={0.82} metalness={0.05} />
      </mesh>

      {/* ================================================================= */}
      {/* 2. MODERN WOODEN PERGOLA CANOPY STRUCTURE                         */}
      {/* ================================================================= */}
      {/* Support posts */}
      {postXCoords.map((px, xi) =>
        postZCoords.map((pz, zi) => (
          <group key={`pergola-post-${xi}-${zi}`} position={[px, deckHeight, pz]}>
            {/* Post anchor collar */}
            <mesh position={[0, 0.03, 0]} castShadow receiveShadow>
              <boxGeometry args={[0.16, 0.06, 0.16]} />
              <meshStandardMaterial color="#263238" roughness={0.4} metalness={0.6} />
            </mesh>
            {/* Main timber upright */}
            <mesh position={[0, 1.23, 0]} castShadow receiveShadow>
              <boxGeometry args={[0.12, 2.34, 0.12]} />
              <meshStandardMaterial color="#4e342e" roughness={0.72} metalness={0.05} />
            </mesh>
          </group>
        )),
      )}

      {/* Front and back longitudinal main beams */}
      <mesh position={[0, deckHeight + 2.44, -1.18]} castShadow receiveShadow>
        <boxGeometry args={[10.2, 0.15, 0.08]} />
        <meshStandardMaterial color="#4e342e" roughness={0.72} metalness={0.05} />
      </mesh>
      <mesh position={[0, deckHeight + 2.44, 1.18]} castShadow receiveShadow>
        <boxGeometry args={[10.2, 0.15, 0.08]} />
        <meshStandardMaterial color="#4e342e" roughness={0.72} metalness={0.05} />
      </mesh>

      {/* Cross girders connecting posts */}
      {postXCoords.map((px, idx) => (
        <mesh
          key={`cross-girder-${idx}`}
          position={[px, deckHeight + 2.52, 0]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[0.08, 0.14, 2.65]} />
          <meshStandardMaterial color="#54382e" roughness={0.75} metalness={0.05} />
        </mesh>
      ))}

      {/* Sunshade slats / louvers */}
      {Array.from({ length: slatCount }).map((_, idx) => {
        const sx = -4.7 + idx * slatSpacing;
        return (
          <mesh
            key={`sunshade-slat-${idx}`}
            position={[sx, deckHeight + 2.6, 0]}
            rotation={[0, 0, 0.12]}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[0.045, 0.085, 2.6]} />
            <meshStandardMaterial color="#5d4037" roughness={0.76} metalness={0.04} />
          </mesh>
        );
      })}

      {/* ================================================================= */}
      {/* 3. WORKING CLUSTERS                                               */}
      {/* ================================================================= */}
      {/* Cluster 1: Round meeting table + 4 chairs (Center) */}
      <group position={[0, deckHeight, 0]}>
        <RoundTable position={[0, 0, 0]} />
        {/* Table centerpiece succulent */}
        <mesh position={[0, 0.74, 0]} castShadow>
          <cylinderGeometry args={[0.08, 0.06, 0.06, 12]} />
          <meshStandardMaterial color="#f5f5f4" roughness={0.3} metalness={0.1} />
        </mesh>
        <mesh position={[0, 0.78, 0]} castShadow>
          <sphereGeometry args={[0.06, 8, 8]} />
          <meshStandardMaterial color="#4d7c0f" roughness={0.9} metalness={0} />
        </mesh>

        {/* 4 Chairs facing the round table */}
        <ModernChair position={[0, 0, -0.88]} rotation={0} />
        <ModernChair position={[0, 0, 0.88]} rotation={Math.PI} />
        <ModernChair position={[-0.88, 0, 0]} rotation={-Math.PI / 2} />
        <ModernChair position={[0.88, 0, 0]} rotation={Math.PI / 2} />
      </group>

      {/* Cluster 2: Outdoor work desk 1 + laptop + chair (Left) */}
      <group position={[-3.2, deckHeight, 0]}>
        <OutdoorDesk position={[0, 0, -0.15]} rotation={0} />
        <Laptop position={[0, 0.692, -0.15]} rotation={0} />
        <CoffeeMug position={[-0.38, 0.692, -0.12]} />
        {/* Notepad / document pad */}
        <mesh position={[0.32, 0.693, -0.15]} receiveShadow>
          <boxGeometry args={[0.18, 0.004, 0.24]} />
          <meshStandardMaterial color="#fafaf9" roughness={0.6} />
        </mesh>

        {/* Primary modern desk chair */}
        <ModernChair position={[0, 0, 0.52]} rotation={Math.PI} />
        {/* Secondary collaborator chair */}
        <ModernChair position={[0.9, 0, -0.15]} rotation={-Math.PI / 2} />
      </group>

      {/* Cluster 3: Outdoor work desk 2 + laptop + chair (Right) */}
      <group position={[3.2, deckHeight, 0]}>
        <OutdoorDesk position={[0, 0, -0.15]} rotation={0} />
        <Laptop position={[0, 0.692, -0.15]} rotation={0} />
        <CoffeeMug position={[0.38, 0.692, -0.12]} />
        {/* Tablet device */}
        <mesh position={[-0.32, 0.693, -0.15]} receiveShadow>
          <boxGeometry args={[0.22, 0.005, 0.16]} />
          <meshStandardMaterial color="#1e293b" metalness={0.8} roughness={0.2} />
        </mesh>

        {/* Primary modern desk chair */}
        <ModernChair position={[0, 0, 0.52]} rotation={Math.PI} />
        {/* Secondary collaborator chair */}
        <ModernChair position={[-0.9, 0, -0.15]} rotation={Math.PI / 2} />
      </group>

      {/* ================================================================= */}
      {/* 4. PERIMETER GREENERY & POTTED PLANTS                             */}
      {/* ================================================================= */}
      {/* Corner potted plants */}
      <PottedPlantModel position={[-4.9, deckHeight, -1.22]} scale={1.8} />
      <PottedPlantModel position={[4.9, deckHeight, -1.22]} scale={1.8} />
      <PottedPlantModel position={[-4.9, deckHeight, 1.22]} scale={1.7} />
      <PottedPlantModel position={[4.9, deckHeight, 1.22]} scale={1.7} />

      {/* Entrance and division potted plants */}
      <PottedPlantModel position={[-1.6, deckHeight, -1.22]} scale={1.5} />
      <PottedPlantModel position={[1.6, deckHeight, -1.22]} scale={1.5} />
      <PottedPlantModel position={[-1.6, deckHeight, 1.22]} scale={1.5} />
      <PottedPlantModel position={[1.6, deckHeight, 1.22]} scale={1.5} />

      {/* Perimeter planter boxes with foliage clumps */}
      {/* Back edge planter boxes */}
      <group position={[-3.2, deckHeight, -1.3]}>
        <mesh position={[0, 0.1, 0]} castShadow receiveShadow>
          <boxGeometry args={[1.3, 0.2, 0.22]} />
          <meshStandardMaterial color="#54382e" roughness={0.85} metalness={0.06} />
        </mesh>
        <PlanterFoliage position={[0, 0.2, 0]} spread={1.2} />
      </group>

      <group position={[0, deckHeight, -1.3]}>
        <mesh position={[0, 0.1, 0]} castShadow receiveShadow>
          <boxGeometry args={[1.3, 0.2, 0.22]} />
          <meshStandardMaterial color="#54382e" roughness={0.85} metalness={0.06} />
        </mesh>
        <PlanterFoliage position={[0, 0.2, 0]} spread={1.2} />
      </group>

      <group position={[3.2, deckHeight, -1.3]}>
        <mesh position={[0, 0.1, 0]} castShadow receiveShadow>
          <boxGeometry args={[1.3, 0.2, 0.22]} />
          <meshStandardMaterial color="#54382e" roughness={0.85} metalness={0.06} />
        </mesh>
        <PlanterFoliage position={[0, 0.2, 0]} spread={1.2} />
      </group>

      {/* Side edge planter boxes */}
      <group position={[-5.25, deckHeight, 0]}>
        <mesh position={[0, 0.1, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.22, 0.2, 1.5]} />
          <meshStandardMaterial color="#54382e" roughness={0.85} metalness={0.06} />
        </mesh>
        <PlanterFoliage position={[0, 0.2, -0.35]} spread={0.9} />
        <PlanterFoliage position={[0, 0.2, 0.35]} spread={0.9} />
      </group>

      <group position={[5.25, deckHeight, 0]}>
        <mesh position={[0, 0.1, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.22, 0.2, 1.5]} />
          <meshStandardMaterial color="#54382e" roughness={0.85} metalness={0.06} />
        </mesh>
        <PlanterFoliage position={[0, 0.2, -0.35]} spread={0.9} />
        <PlanterFoliage position={[0, 0.2, 0.35]} spread={0.9} />
      </group>

      {/* ================================================================= */}
      {/* 5. AMBIENT STRING LIGHTS & GARDEN WARM LANTERNS                   */}
      {/* ================================================================= */}
      {/* String lights wire & bulbs: Row 1 (z = -0.55) */}
      <mesh position={[0, deckHeight + 2.38, -0.55]}>
        <cylinderGeometry args={[0.004, 0.004, 9.6, 6]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.6} />
      </mesh>
      {Array.from({ length: bulbCount }).map((_, idx) => {
        const bx = -4.6 + idx * bulbSpacing;
        return (
          <group key={`bulb-r1-${idx}`} position={[bx, deckHeight + 2.34, -0.55]}>
            {/* Small socket */}
            <mesh position={[0, 0.02, 0]}>
              <cylinderGeometry args={[0.008, 0.008, 0.02, 8]} />
              <meshStandardMaterial color="#212121" roughness={0.8} />
            </mesh>
            {/* Amber glowing bulb */}
            <mesh position={[0, 0, 0]}>
              <sphereGeometry args={[0.024, 10, 10]} />
              <meshStandardMaterial
                color="#fff8e1"
                emissive="#ffa726"
                emissiveIntensity={2.0}
                roughness={0.2}
              />
            </mesh>
          </group>
        );
      })}

      {/* String lights wire & bulbs: Row 2 (z = 0.55) */}
      <mesh position={[0, deckHeight + 2.38, 0.55]}>
        <cylinderGeometry args={[0.004, 0.004, 9.6, 6]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.6} />
      </mesh>
      {Array.from({ length: bulbCount }).map((_, idx) => {
        const bx = -4.6 + idx * bulbSpacing;
        return (
          <group key={`bulb-r2-${idx}`} position={[bx, deckHeight + 2.34, 0.55]}>
            <mesh position={[0, 0.02, 0]}>
              <cylinderGeometry args={[0.008, 0.008, 0.02, 8]} />
              <meshStandardMaterial color="#212121" roughness={0.8} />
            </mesh>
            <mesh position={[0, 0, 0]}>
              <sphereGeometry args={[0.024, 10, 10]} />
              <meshStandardMaterial
                color="#fff8e1"
                emissive="#ffa726"
                emissiveIntensity={2.0}
                roughness={0.2}
              />
            </mesh>
          </group>
        );
      })}

      {/* Ambient warm overhead point lights */}
      <pointLight
        position={[-3.2, deckHeight + 2.1, 0]}
        color="#ffe082"
        intensity={1.2}
        distance={5.0}
        decay={2}
      />
      <pointLight
        position={[0, deckHeight + 2.1, 0]}
        color="#ffe082"
        intensity={1.5}
        distance={5.5}
        decay={2}
      />
      <pointLight
        position={[3.2, deckHeight + 2.1, 0]}
        color="#ffe082"
        intensity={1.2}
        distance={5.0}
        decay={2}
      />

      {/* Warm floor lanterns at deck corners */}
      <WarmLantern position={[-5.05, deckHeight, -1.18]} />
      <WarmLantern position={[5.05, deckHeight, -1.18]} />
      <WarmLantern position={[-5.05, deckHeight, 1.18]} />
      <WarmLantern position={[5.05, deckHeight, 1.18]} />
    </group>
  );
});

useGLTF.preload("/office-assets/models/furniture/tableRound.glb");
useGLTF.preload("/office-assets/models/furniture/chairModernCushion.glb");
useGLTF.preload("/office-assets/models/furniture/desk.glb");
useGLTF.preload("/office-assets/models/furniture/pottedPlant.glb");

export default GardenWorkspace;
