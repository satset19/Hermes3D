"use client";

import { Billboard, Text } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState, type MutableRefObject, type RefObject } from "react";
import * as THREE from "three";
import {
  CANVAS_H,
  CANVAS_W,
  SCALE,
  SNAP_GRID,
} from "@/features/retro-office/core/constants";
import { toWorld } from "@/features/retro-office/core/geometry";
import type {
  OfficeAgent,
  RenderAgent,
} from "@/features/retro-office/core/types";

const HEAT_COLS = Math.floor(CANVAS_W / SNAP_GRID);
const HEAT_ROWS = Math.floor(CANVAS_H / SNAP_GRID);
const MAX_HEATMAP_CELLS = HEAT_COLS * HEAT_ROWS;

export function HeatmapSystem({
  agentsRef,
  heatmapMode,
  heatGridRef,
}: {
  agentsRef: RefObject<RenderAgent[]>;
  heatmapMode: boolean;
  heatGridRef: MutableRefObject<Uint16Array | null>;
}) {
  const frameRef = useRef(0);
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const colorHelper = useMemo(() => new THREE.Color(), []);
  const fallbackHeatGridRef = useRef<Uint16Array>(
    new Uint16Array(HEAT_COLS * HEAT_ROWS),
  );

  useEffect(() => {
    if (heatGridRef.current == null) {
      heatGridRef.current = fallbackHeatGridRef.current;
    }
  }, [heatGridRef]);

  useFrame(() => {
    frameRef.current += 1;
    const grid = heatGridRef.current ?? fallbackHeatGridRef.current;
    if (heatGridRef.current == null) {
      heatGridRef.current = grid;
    }

    if (frameRef.current % (heatmapMode ? 30 : 45) === 0) {
      for (const agent of agentsRef.current ?? []) {
        const col = Math.floor(agent.x / SNAP_GRID);
        const row = Math.floor(agent.y / SNAP_GRID);
        if (col >= 0 && col < HEAT_COLS && row >= 0 && row < HEAT_ROWS) {
          grid[row * HEAT_COLS + col] = Math.min(
            65535,
            grid[row * HEAT_COLS + col] + 1,
          );
        }
      }
    }

    if (!meshRef.current) return;

    if (!heatmapMode) {
      if (meshRef.current.count !== 0) {
        meshRef.current.count = 0;
        meshRef.current.instanceMatrix.needsUpdate = true;
      }
      return;
    }

    if (frameRef.current % 120 === 0 || meshRef.current.count === 0) {
      let maxValue = 1;
      for (let index = 0; index < grid.length; index += 1) {
        if (grid[index] > maxValue) maxValue = grid[index];
      }

      let instanceIdx = 0;
      for (let row = 0; row < HEAT_ROWS; row += 1) {
        for (let col = 0; col < HEAT_COLS; col += 1) {
          const value = grid[row * HEAT_COLS + col];
          if (value === 0) continue;
          const [wx, , wz] = toWorld(
            col * SNAP_GRID + SNAP_GRID / 2,
            row * SNAP_GRID + SNAP_GRID / 2,
          );
          const v = value / maxValue;
          dummy.position.set(wx, 0.002, wz);
          dummy.rotation.set(-Math.PI / 2, 0, 0);
          dummy.scale.set(1, 1, 1);
          dummy.updateMatrix();
          meshRef.current.setMatrixAt(instanceIdx, dummy.matrix);

          const hex = v < 0.4 ? "#f59e0b" : v < 0.75 ? "#ef4444" : "#dc2626";
          colorHelper.set(hex);
          meshRef.current.setColorAt(instanceIdx, colorHelper);
          instanceIdx += 1;
        }
      }

      meshRef.current.count = instanceIdx;
      meshRef.current.instanceMatrix.needsUpdate = true;
      if (meshRef.current.instanceColor) {
        meshRef.current.instanceColor.needsUpdate = true;
      }
    }
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, MAX_HEATMAP_CELLS]}
      count={0}
      visible={heatmapMode}
    >
      <planeGeometry args={[SNAP_GRID * SCALE * 0.9, SNAP_GRID * SCALE * 0.9]} />
      <meshBasicMaterial
        transparent
        opacity={0.35}
        depthWrite={false}
      />
    </instancedMesh>
  );
}

export type TrailPoint = {
  x: number;
  y: number;
  z: number;
  age: number;
  color: string;
};

const MAX_TRAIL_POINTS = 300;

export function TrailSystem({
  agentsRef,
  colorMap,
}: {
  agentsRef: RefObject<RenderAgent[]>;
  colorMap: Map<string, string>;
}) {
  const trailsRef = useRef<Map<string, TrailPoint[]>>(new Map());
  const frameRef = useRef(0);
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const colorHelper = useMemo(() => new THREE.Color(), []);

  useFrame(() => {
    frameRef.current += 1;
    const agents = agentsRef.current ?? [];
    const trails = trailsRef.current;

    if (frameRef.current % 12 === 0) {
      for (const agent of agents) {
        if (agent.state !== "walking") continue;
        const [wx, , wz] = toWorld(agent.x, agent.y);
        let existing = trails.get(agent.id);
        if (!existing) {
          existing = [];
          trails.set(agent.id, existing);
        }
        existing.unshift({
          x: wx,
          y: 0.01,
          z: wz,
          age: 0,
          color: colorMap.get(agent.id) ?? "#888",
        });
        if (existing.length > 6) {
          existing.length = 6;
        }
      }
    }

    for (const [id, trailPoints] of trails) {
      let writeIdx = 0;
      for (let readIdx = 0; readIdx < trailPoints.length; readIdx += 1) {
        const point = trailPoints[readIdx];
        point.age += 1;
        if (point.age < 48) {
          trailPoints[writeIdx] = point;
          writeIdx += 1;
        }
      }
      trailPoints.length = writeIdx;
      if (writeIdx === 0) {
        trails.delete(id);
      }
    }

    if (meshRef.current) {
      let instanceIdx = 0;
      for (const trailPoints of trails.values()) {
        for (const point of trailPoints) {
          if (instanceIdx >= MAX_TRAIL_POINTS) break;
          dummy.position.set(point.x, point.y, point.z);
          dummy.rotation.set(-Math.PI / 2, 0, 0);
          const life = Math.max(0, 1 - point.age / 48);
          dummy.scale.set(life, life, life);
          dummy.updateMatrix();
          meshRef.current.setMatrixAt(instanceIdx, dummy.matrix);

          colorHelper.set(point.color);
          colorHelper.multiplyScalar(Math.max(0.1, life));
          meshRef.current.setColorAt(instanceIdx, colorHelper);
          instanceIdx += 1;
        }
      }
      const prevCount = meshRef.current.count;
      meshRef.current.count = instanceIdx;
      if (instanceIdx > 0 || prevCount > 0) {
        meshRef.current.instanceMatrix.needsUpdate = true;
        if (meshRef.current.instanceColor) {
          meshRef.current.instanceColor.needsUpdate = true;
        }
      }
    }
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, MAX_TRAIL_POINTS]}
      count={0}
    >
      <circleGeometry args={[0.05, 8]} />
      <meshBasicMaterial
        transparent
        opacity={0.45}
        depthWrite={false}
      />
    </instancedMesh>
  );
}

export function DeskNameplates({
  deskLocations,
  agents,
  deskByAgentRef,
}: {
  deskLocations: { x: number; y: number }[];
  agents: OfficeAgent[];
  deskByAgentRef: RefObject<Map<string, number>>;
}) {
  const [deskEntries, setDeskEntries] = useState<Array<[string, number]>>([]);
  const deskSignatureRef = useRef("");
  const agentById = useMemo(
    () => new Map(agents.map((agent) => [agent.id, agent])),
    [agents],
  );
  const deskAgentByIndex = useMemo(
    () => new Map(deskEntries.map(([agentId, deskIndex]) => [deskIndex, agentId])),
    [deskEntries],
  );

  useEffect(() => {
    const syncDeskEntries = () => {
      const nextEntries = [...(deskByAgentRef.current?.entries() ?? [])].sort(
        (left, right) => left[0].localeCompare(right[0]),
      );
      const nextSignature = nextEntries
        .map(([agentId, deskIndex]) => `${agentId}:${deskIndex}`)
        .join("|");
      if (nextSignature === deskSignatureRef.current) {
        return;
      }
      deskSignatureRef.current = nextSignature;
      setDeskEntries(nextEntries);
    };
    syncDeskEntries();
    const intervalId = window.setInterval(syncDeskEntries, 400);
    return () => {
      window.clearInterval(intervalId);
    };
  }, [deskByAgentRef]);

  return (
    <>
      {deskLocations.map((desk, index) => {
        const agentId = deskAgentByIndex.get(index);
        if (!agentId) return null;
        const agent = agentById.get(agentId);
        if (!agent) return null;
        const [wx, , wz] = toWorld(desk.x, desk.y);

        return (
          <Billboard key={`nameplate-${index}`} position={[wx, 1.02, wz]}>
            <mesh position={[0, 0, -0.001]}>
              <planeGeometry args={[0.74, 0.16]} />
              <meshBasicMaterial color="#050403" transparent opacity={0.86} />
            </mesh>
            <mesh position={[-0.35, 0, 0]}>
              <planeGeometry args={[0.035, 0.16]} />
              <meshBasicMaterial color={agent.color} />
            </mesh>
            <Text
              position={[0.01, 0.002, 0.001]}
              fontSize={0.11}
              color="#fff6d8"
              anchorX="center"
              anchorY="middle"
              maxWidth={0.64}
              outlineWidth={0.007}
              outlineColor="#16110a"
              font={undefined}
              overflowWrap="break-word"
              whiteSpace="nowrap"
            >
              {agent.name.length > 14 ? agent.name.slice(0, 13) + "…" : agent.name}
            </Text>
          </Billboard>
        );
      })}
    </>
  );
}
