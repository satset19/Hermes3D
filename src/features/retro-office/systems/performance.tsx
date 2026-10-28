"use client";

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import type { GraphicsQuality } from "@/features/retro-office/core/graphicsQuality";

export const MIN_DPR_COOLDOWN_MS = 10_000;
export const LOW_FPS_DOWNGRADE_THRESHOLD = 30;
export const LOW_FPS_SUSTAIN_DURATION_MS = 3_000;
export const DOWNGRADE_COOLDOWN_MS = 10_000;
export const DEFAULT_MIN_DPR = 0.75;
export const DEFAULT_MAX_DPR = 1.15;
export const FPS_SMOOTHING_TAU = 0.8;
export const STARTUP_WARMUP_MS = 3_000;

export interface StableAdaptivePerformanceControllerProps {
  /** Minimum device pixel ratio allowed. Defaults to 0.75. */
  minDpr?: number;
  /** Maximum device pixel ratio allowed. Defaults to 1.15. */
  maxDpr?: number;
  /** Cooldown in ms between DPR adjustments to avoid GPU backbuffer stalls. Minimum 10000ms. */
  dprCooldownMs?: number;
  /** FPS threshold below which quality downgrade is considered. Defaults to 30. */
  downgradeFpsThreshold?: number;
  /** Required sustained low-FPS duration in ms before triggering downgrade. Defaults to 3000ms. */
  downgradeSustainDurationMs?: number;
  /** Cooldown in ms between quality downgrade triggers. Defaults to 10000ms. */
  downgradeCooldownMs?: number;
  /** Callback invoked when FPS drops below threshold consistently for sustain duration. */
  onDowngradeQuality?: (smoothedFps: number) => void;
  /** Optional callback reporting smoothed FPS updates. */
  onFpsUpdate?: (smoothedFps: number) => void;
  /** Whether adaptive monitoring and adjustments are enabled. Defaults to true. */
  enabled?: boolean;
}

export function calculateSmoothedFps(
  currentSmoothedFps: number,
  instantFps: number,
  delta: number,
  tau = FPS_SMOOTHING_TAU,
): number {
  if (currentSmoothedFps <= 0) {
    return instantFps;
  }
  const alpha = 1 - Math.exp(-Math.min(delta, 0.25) / Math.max(0.001, tau));
  return currentSmoothedFps * (1 - alpha) + instantFps * alpha;
}

export function getNextLowerGraphicsQuality(
  current: GraphicsQuality,
): GraphicsQuality | null {
  if (current === "ultra") return "balanced";
  if (current === "balanced") return "low";
  return null;
}

export function downgradeGraphicsQuality(
  current: GraphicsQuality,
): GraphicsQuality {
  return getNextLowerGraphicsQuality(current) ?? current;
}

export function resolveTargetDprStep(
  smoothedFps: number,
  currentDpr: number,
  minDpr: number,
  maxDpr: number,
): number {
  const steps = Array.from(new Set([minDpr, 1.0, maxDpr]))
    .filter((step) => step >= minDpr && step <= maxDpr)
    .sort((a, b) => a - b);

  if (steps.length <= 1) {
    return steps[0] ?? maxDpr;
  }

  if (smoothedFps < 45) {
    const lowerSteps = steps.filter((s) => s < currentDpr - 0.05);
    return lowerSteps.length > 0 ? lowerSteps[lowerSteps.length - 1] : currentDpr;
  }

  if (smoothedFps > 58) {
    const higherSteps = steps.filter((s) => s > currentDpr + 0.05);
    return higherSteps.length > 0 ? higherSteps[0] : currentDpr;
  }

  return currentDpr;
}

export function StableAdaptivePerformanceController({
  minDpr = DEFAULT_MIN_DPR,
  maxDpr = DEFAULT_MAX_DPR,
  dprCooldownMs = MIN_DPR_COOLDOWN_MS,
  downgradeFpsThreshold = LOW_FPS_DOWNGRADE_THRESHOLD,
  downgradeSustainDurationMs = LOW_FPS_SUSTAIN_DURATION_MS,
  downgradeCooldownMs = DOWNGRADE_COOLDOWN_MS,
  onDowngradeQuality,
  onFpsUpdate,
  enabled = true,
}: StableAdaptivePerformanceControllerProps) {
  const effectiveCooldownMs = Math.max(dprCooldownMs, MIN_DPR_COOLDOWN_MS);
  const setDpr = useThree((state) => state.setDpr);
  const viewportDpr = useThree((state) => state.viewport.dpr);

  const onDowngradeRef = useRef(onDowngradeQuality);
  onDowngradeRef.current = onDowngradeQuality;

  const onFpsUpdateRef = useRef(onFpsUpdate);
  onFpsUpdateRef.current = onFpsUpdate;

  const currentDprRef = useRef(viewportDpr);
  const smoothedFpsRef = useRef(60);
  const lowFpsStartRef = useRef<number | null>(null);
  const lastDprChangeTimeRef = useRef<number>(0);
  const lastDowngradeTimeRef = useRef<number>(0);
  const mountTimeRef = useRef<number>(0);
  const initializedRef = useRef(false);

  useEffect(() => {
    mountTimeRef.current = performance.now();
    lastDprChangeTimeRef.current = performance.now();
    lastDowngradeTimeRef.current = performance.now();
    currentDprRef.current = Math.min(Math.max(viewportDpr, minDpr), maxDpr);
    initializedRef.current = true;
  }, [minDpr, maxDpr, viewportDpr]);

  useFrame((_, delta) => {
    if (!enabled || !initializedRef.current) return;

    if (delta <= 0 || delta > 0.5) {
      lowFpsStartRef.current = null;
      return;
    }

    const instantFps = Math.min(120, Math.max(1, 1 / delta));
    const smoothedFps = calculateSmoothedFps(
      smoothedFpsRef.current,
      instantFps,
      delta,
      FPS_SMOOTHING_TAU,
    );
    smoothedFpsRef.current = smoothedFps;
    onFpsUpdateRef.current?.(smoothedFps);

    const now = performance.now();
    if (now - mountTimeRef.current < STARTUP_WARMUP_MS) {
      return;
    }

    if (smoothedFps < downgradeFpsThreshold) {
      if (lowFpsStartRef.current === null) {
        lowFpsStartRef.current = now;
      } else if (now - lowFpsStartRef.current >= downgradeSustainDurationMs) {
        if (now - lastDowngradeTimeRef.current >= downgradeCooldownMs) {
          lastDowngradeTimeRef.current = now;
          lowFpsStartRef.current = null;
          onDowngradeRef.current?.(smoothedFps);
        }
      }
    } else {
      lowFpsStartRef.current = null;
    }

    if (now - lastDprChangeTimeRef.current >= effectiveCooldownMs) {
      const targetDpr = resolveTargetDprStep(
        smoothedFps,
        currentDprRef.current,
        minDpr,
        maxDpr,
      );

      if (Math.abs(targetDpr - currentDprRef.current) >= 0.05) {
        currentDprRef.current = targetDpr;
        lastDprChangeTimeRef.current = now;
        setDpr(targetDpr);
      }
    }
  });

  return null;
}

export { StableAdaptivePerformanceController as AdaptiveDprController };
