import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";

import {
  calculateSmoothedFps,
  getNextLowerGraphicsQuality,
  downgradeGraphicsQuality,
  resolveTargetDprStep,
  StableAdaptivePerformanceController,
  MIN_DPR_COOLDOWN_MS,
  LOW_FPS_DOWNGRADE_THRESHOLD,
  LOW_FPS_SUSTAIN_DURATION_MS,
  DOWNGRADE_COOLDOWN_MS,
  DEFAULT_MIN_DPR,
  DEFAULT_MAX_DPR,
  FPS_SMOOTHING_TAU,
  STARTUP_WARMUP_MS,
} from "@/features/retro-office/systems/performance";

let frameCallback: ((state: unknown, delta: number) => void) | null = null;
let currentMockViewportDpr = 1.0;
const mockSetDpr = vi.fn((dpr: number) => {
  currentMockViewportDpr = dpr;
});

vi.mock("@react-three/fiber", () => ({
  useFrame: (cb: (state: unknown, delta: number) => void) => {
    frameCallback = cb;
  },
  useThree: (
    selector: (state: {
      setDpr: (dpr: number) => void;
      viewport: { dpr: number };
    }) => unknown,
  ) => {
    return selector({
      setDpr: mockSetDpr,
      viewport: { dpr: currentMockViewportDpr },
    });
  },
}));

describe("StableAdaptivePerformanceController unit tests", () => {
  let mockPerformanceNow = 0;
  let perfSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    frameCallback = null;
    currentMockViewportDpr = 1.0;
    mockSetDpr.mockClear();
    mockPerformanceNow = 1000;
    perfSpy = vi
      .spyOn(performance, "now")
      .mockImplementation(() => mockPerformanceNow);
  });

  afterEach(() => {
    cleanup();
    perfSpy.mockRestore();
    vi.clearAllMocks();
  });

  describe("Konstanta default controller", () => {
    it("memastikan nilai default konfigurasi performa adaptif sesuai spesifikasi", () => {
      expect(MIN_DPR_COOLDOWN_MS).toBe(10_000);
      expect(LOW_FPS_DOWNGRADE_THRESHOLD).toBe(30);
      expect(LOW_FPS_SUSTAIN_DURATION_MS).toBe(3_000);
      expect(DOWNGRADE_COOLDOWN_MS).toBe(10_000);
      expect(DEFAULT_MIN_DPR).toBe(0.75);
      expect(DEFAULT_MAX_DPR).toBe(1.15);
      expect(FPS_SMOOTHING_TAU).toBe(0.8);
      expect(STARTUP_WARMUP_MS).toBe(3_000);
    });
  });

  describe("Perhitungan moving average FPS (calculateSmoothedFps)", () => {
    it("mengembalikan instantFps secara langsung saat smoothedFps awal <= 0", () => {
      const result = calculateSmoothedFps(0, 60, 0.016);
      expect(result).toBe(60);

      const resultNegative = calculateSmoothedFps(-1, 45, 0.016);
      expect(resultNegative).toBe(45);
    });

    it("menghitung exponential moving average dengan benar pada satu langkah frame", () => {
      const currentFps = 60;
      const instantFps = 30;
      const delta = 0.016;
      const tau = 0.8;

      const expectedAlpha = 1 - Math.exp(-Math.min(delta, 0.25) / tau);
      const expectedFps = currentFps * (1 - expectedAlpha) + instantFps * expectedAlpha;

      const smoothed = calculateSmoothedFps(currentFps, instantFps, delta, tau);
      expect(smoothed).toBeCloseTo(expectedFps, 4);
      expect(smoothed).toBeLessThan(currentFps);
      expect(smoothed).toBeGreaterThan(instantFps);
    });

    it("membatasi delta maksimal 0.25 untuk mencegah spike lag merusak moving average secara drastis", () => {
      const currentFps = 60;
      const instantFps = 10;
      const hugeDelta = 1.5;

      const smoothedWithSpike = calculateSmoothedFps(currentFps, instantFps, hugeDelta, 0.8);
      const smoothedWithMaxClamped = calculateSmoothedFps(currentFps, instantFps, 0.25, 0.8);

      expect(smoothedWithSpike).toBeCloseTo(smoothedWithMaxClamped, 6);
    });

    it("konvergen secara bertahap menuju instantFps setelah sejumlah frame konsisten", () => {
      let fps = 60;
      const targetInstantFps = 20;
      const frameDelta = 0.016;

      for (let i = 0; i < 300; i++) {
        fps = calculateSmoothedFps(fps, targetInstantFps, frameDelta, 0.8);
      }

      expect(fps).toBeCloseTo(targetInstantFps, 0);
      expect(Math.abs(fps - targetInstantFps)).toBeLessThan(0.2);
    });

    it("merespons tau yang berbeda dengan laju smoothing yang sesuai", () => {
      const currentFps = 60;
      const instantFps = 25;
      const delta = 0.016;

      const responsive = calculateSmoothedFps(currentFps, instantFps, delta, 0.2);
      const damped = calculateSmoothedFps(currentFps, instantFps, delta, 1.5);

      expect(responsive).toBeLessThan(damped);
    });
  });

  describe("Transisi kualitas grafis (getNextLowerGraphicsQuality & downgradeGraphicsQuality)", () => {
    it("menurunkan kualitas ultra ke balanced lalu ke low", () => {
      expect(getNextLowerGraphicsQuality("ultra")).toBe("balanced");
      expect(getNextLowerGraphicsQuality("balanced")).toBe("low");
      expect(getNextLowerGraphicsQuality("low")).toBeNull();
    });

    it("downgradeGraphicsQuality mempertahankan kualitas low saat sudah di batas terendah", () => {
      expect(downgradeGraphicsQuality("ultra")).toBe("balanced");
      expect(downgradeGraphicsQuality("balanced")).toBe("low");
      expect(downgradeGraphicsQuality("low")).toBe("low");
    });
  });

  describe("Penentuan target DPR step (resolveTargetDprStep)", () => {
    it("menurunkan DPR satu step saat smoothed FPS < 45", () => {
      const target = resolveTargetDprStep(40, 1.15, 0.75, 1.15);
      expect(target).toBe(1.0);

      const nextLower = resolveTargetDprStep(40, 1.0, 0.75, 1.15);
      expect(nextLower).toBe(0.75);

      const atMin = resolveTargetDprStep(40, 0.75, 0.75, 1.15);
      expect(atMin).toBe(0.75);
    });

    it("menaikkan DPR satu step saat smoothed FPS > 58", () => {
      const target = resolveTargetDprStep(59, 0.75, 0.75, 1.15);
      expect(target).toBe(1.0);

      const nextHigher = resolveTargetDprStep(60, 1.0, 0.75, 1.15);
      expect(nextHigher).toBe(1.15);

      const atMax = resolveTargetDprStep(60, 1.15, 0.75, 1.15);
      expect(atMax).toBe(1.15);
    });

    it("mempertahankan DPR saat FPS berada di rentang stabil antara 45 dan 58", () => {
      expect(resolveTargetDprStep(50, 1.0, 0.75, 1.15)).toBe(1.0);
      expect(resolveTargetDprStep(55, 1.15, 0.75, 1.15)).toBe(1.15);
      expect(resolveTargetDprStep(48, 0.75, 0.75, 1.15)).toBe(0.75);
    });

    it("mengembalikan batas tunggal jika minDpr sama dengan maxDpr", () => {
      const step = resolveTargetDprStep(30, 1.0, 1.0, 1.0);
      expect(step).toBe(1.0);
    });
  });

  describe("Komponen StableAdaptivePerformanceController", () => {
    it("tidak menjalankan pembaruan frame jika enabled bernilai false", () => {
      const onFpsUpdate = vi.fn();
      const onDowngrade = vi.fn();

      render(
        React.createElement(StableAdaptivePerformanceController, {
          enabled: false,
          onFpsUpdate,
          onDowngradeQuality: onDowngrade,
        }),
      );

      expect(frameCallback).not.toBeNull();
      frameCallback?.({}, 0.016);

      expect(onFpsUpdate).not.toHaveBeenCalled();
      expect(onDowngrade).not.toHaveBeenCalled();
    });

    it("mengabaikan frame dengan delta tidak valid (delta <= 0 atau delta > 0.5)", () => {
      const onFpsUpdate = vi.fn();

      render(
        React.createElement(StableAdaptivePerformanceController, {
          onFpsUpdate,
        }),
      );

      frameCallback?.({}, 0);
      expect(onFpsUpdate).not.toHaveBeenCalled();

      frameCallback?.({}, -0.01);
      expect(onFpsUpdate).not.toHaveBeenCalled();

      frameCallback?.({}, 0.6);
      expect(onFpsUpdate).not.toHaveBeenCalled();
    });

    it("memanggil onFpsUpdate dengan smoothed FPS pada delta frame yang valid", () => {
      const onFpsUpdate = vi.fn();

      render(
        React.createElement(StableAdaptivePerformanceController, {
          onFpsUpdate,
        }),
      );

      frameCallback?.({}, 0.016);
      expect(onFpsUpdate).toHaveBeenCalledTimes(1);
      const reportedFps = onFpsUpdate.mock.calls[0][0];
      expect(reportedFps).toBeGreaterThan(0);
      expect(reportedFps).toBeLessThanOrEqual(120);
    });

    it("tidak memicu downgrade selama masa startup warmup (3000ms)", () => {
      const onDowngrade = vi.fn();

      mockPerformanceNow = 0;
      render(
        React.createElement(StableAdaptivePerformanceController, {
          onDowngradeQuality: onDowngrade,
          downgradeFpsThreshold: 30,
          downgradeSustainDurationMs: 1000,
          downgradeCooldownMs: 1000,
        }),
      );

      // Frame berat (delta 0.05 => instant 20 FPS) selama 2000ms, masih dalam startup warmup 3000ms
      for (let i = 0; i < 40; i++) {
        mockPerformanceNow += 50;
        frameCallback?.({}, 0.05);
      }

      expect(onDowngrade).not.toHaveBeenCalled();
    });

    it("memicu trigger downgrade hanya setelah low FPS konsisten melewati durasi sustain", () => {
      const onDowngrade = vi.fn();

      mockPerformanceNow = 0;
      render(
        React.createElement(StableAdaptivePerformanceController, {
          onDowngradeQuality: onDowngrade,
          downgradeFpsThreshold: 30,
          downgradeSustainDurationMs: 2000,
          downgradeCooldownMs: 5000,
        }),
      );

      // Lewati startup warmup (3000ms) dan initial cooldown (5000ms)
      mockPerformanceNow = 6000;
      frameCallback?.({}, 0.016);

      // Turunkan FPS secara konsisten (delta 0.05 = 20 FPS) hingga smoothedFps < 30
      // Dibutuhkan ~25 frame untuk smoothedFps turun dari 60 ke < 30
      for (let i = 0; i < 30; i++) {
        mockPerformanceNow += 50;
        frameCallback?.({}, 0.05);
      }

      // Pada titik ini smoothedFps sudah < 30 dan lowFpsStart telah tercatat,
      // tapi durasi sustain (2000ms) belum terlampaui
      expect(onDowngrade).not.toHaveBeenCalled();

      // Tambahkan frame low FPS selama 2500ms lagi (50 frame * 50ms = 2500ms > 2000ms sustain)
      for (let i = 0; i < 50; i++) {
        mockPerformanceNow += 50;
        frameCallback?.({}, 0.05);
      }

      expect(onDowngrade).toHaveBeenCalledTimes(1);
      const passedFps = onDowngrade.mock.calls[0][0];
      expect(passedFps).toBeLessThan(30);
    });

    it("mereset timer low FPS jika FPS pulih sebelum durasi sustain tercapai", () => {
      const onDowngrade = vi.fn();

      mockPerformanceNow = 0;
      render(
        React.createElement(StableAdaptivePerformanceController, {
          onDowngradeQuality: onDowngrade,
          downgradeFpsThreshold: 30,
          downgradeSustainDurationMs: 3000,
          downgradeCooldownMs: 5000,
        }),
      );

      // Lewati warmup dan initial cooldown
      mockPerformanceNow = 6000;
      frameCallback?.({}, 0.016);

      // Turunkan FPS hingga smoothedFps < 30
      for (let i = 0; i < 30; i++) {
        mockPerformanceNow += 50;
        frameCallback?.({}, 0.05);
      }

      // Berjalan 1000ms low FPS (belum 3000ms)
      for (let i = 0; i < 20; i++) {
        mockPerformanceNow += 50;
        frameCallback?.({}, 0.05);
      }
      expect(onDowngrade).not.toHaveBeenCalled();

      // FPS pulih kembali tinggi (delta 0.016 = 60 FPS) sehingga smoothedFps naik kembali di atas 30
      for (let i = 0; i < 60; i++) {
        mockPerformanceNow += 16;
        frameCallback?.({}, 0.016);
      }

      // Mulai periode low FPS baru selama 1000ms (tidak boleh trigger karena timer di-reset)
      for (let i = 0; i < 20; i++) {
        mockPerformanceNow += 50;
        frameCallback?.({}, 0.05);
      }

      expect(onDowngrade).not.toHaveBeenCalled();
    });

    it("menahan downgrade berikutnya selama periode cooldown aktif (downgradeCooldownMs)", () => {
      const onDowngrade = vi.fn();

      mockPerformanceNow = 0;
      render(
        React.createElement(StableAdaptivePerformanceController, {
          onDowngradeQuality: onDowngrade,
          downgradeFpsThreshold: 30,
          downgradeSustainDurationMs: 2000,
          downgradeCooldownMs: 8000,
        }),
      );

      // Lewati warmup dan initial cooldown (8000ms)
      mockPerformanceNow = 9000;
      frameCallback?.({}, 0.016);

      // Turunkan FPS dan sustain > 2000ms -> memicu downgrade pertama
      for (let i = 0; i < 80; i++) {
        mockPerformanceNow += 50;
        frameCallback?.({}, 0.05);
      }
      expect(onDowngrade).toHaveBeenCalledTimes(1);

      // Tetap low FPS selama 4000ms berikutnya (masih dalam cooldown 8000ms)
      for (let i = 0; i < 80; i++) {
        mockPerformanceNow += 50;
        frameCallback?.({}, 0.05);
      }
      // Masih 1 kali karena cooldown aktif
      expect(onDowngrade).toHaveBeenCalledTimes(1);

      // Maju melampaui cooldown 8000ms sejak downgrade pertama, plus sustain 2000ms baru
      mockPerformanceNow += 9000;
      for (let i = 0; i < 60; i++) {
        mockPerformanceNow += 50;
        frameCallback?.({}, 0.05);
      }
      expect(onDowngrade).toHaveBeenCalledTimes(2);
    });

    it("menyesuaikan DPR secara bertahap dengan mematuhi cooldown DPR minimum (MIN_DPR_COOLDOWN_MS)", () => {
      mockPerformanceNow = 0;
      currentMockViewportDpr = 1.15;

      render(
        React.createElement(StableAdaptivePerformanceController, {
          minDpr: 0.75,
          maxDpr: 1.15,
          dprCooldownMs: 5000, // Harus di-clamp ke MIN_DPR_COOLDOWN_MS (10000ms)
        }),
      );

      // Lewati mount time
      mockPerformanceNow = 1000;
      frameCallback?.({}, 0.016);

      // Simulasi FPS rendah (< 45) dengan delta 0.025 (40 FPS)
      // Sebelum 10000ms (misal 5000ms setelah mount), setDpr tidak boleh dipanggil
      mockPerformanceNow = 6000;
      for (let i = 0; i < 50; i++) {
        mockPerformanceNow += 25;
        frameCallback?.({}, 0.025);
      }
      expect(mockSetDpr).not.toHaveBeenCalled();

      // Setelah melewati 10000ms effective cooldown sejak mount
      mockPerformanceNow = 11500;
      frameCallback?.({}, 0.025);

      expect(mockSetDpr).toHaveBeenCalledTimes(1);
      expect(mockSetDpr).toHaveBeenCalledWith(1.0);

      // Sebelum cooldown 10000ms kedua berakhir, tidak memanggil step berikutnya
      mockPerformanceNow = 16000;
      frameCallback?.({}, 0.025);
      expect(mockSetDpr).toHaveBeenCalledTimes(1);

      // Setelah 10000ms berikutnya lewat (11500 + 10000 = 21500)
      mockPerformanceNow = 22000;
      frameCallback?.({}, 0.025);
      expect(mockSetDpr).toHaveBeenCalledTimes(2);
      expect(mockSetDpr).toHaveBeenLastCalledWith(0.75);
    });
  });
});
