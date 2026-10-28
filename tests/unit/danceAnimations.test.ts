import { describe, it, expect } from "vitest";
import {
  createDanceAnimationClips,
  createDiscoAnimationClip,
  createWaveAnimationClip,
  createSpinAnimationClip,
  createRockAnimationClip,
  createSittingAnimationClip,
  GOBKIT_JOINTS,
} from "@/lib/avatars/danceAnimations";

describe("danceAnimations", () => {
  it("exports valid 13-joint skeletal mapping", () => {
    expect(Object.keys(GOBKIT_JOINTS)).toHaveLength(13);
    expect(GOBKIT_JOINTS.root).toBe("xb6a68");
    expect(GOBKIT_JOINTS.hips).toBe("ahn3vx");
    expect(GOBKIT_JOINTS.leftThigh).toBe("jtgqkt");
    expect(GOBKIT_JOINTS.rightThigh).toBe("meax35");
  });

  it("creates dance animation clips for all supported styles", () => {
    const clips = createDanceAnimationClips();
    expect(clips).toHaveLength(4);

    const names = clips.map((c) => c.name);
    expect(names).toContain("dance_disco");
    expect(names).toContain("dance_wave");
    expect(names).toContain("dance_spin");
    expect(names).toContain("dance_rock");

    for (const clip of clips) {
      expect(clip.duration).toBeGreaterThan(0);
      expect(clip.tracks.length).toBeGreaterThan(0);
      for (const track of clip.tracks) {
        expect(track.times.length).toBeGreaterThan(0);
        expect(track.values.length).toBeGreaterThan(0);
      }
    }
  });

  it("creates disco animation clip with valid tracks", () => {
    const disco = createDiscoAnimationClip();
    expect(disco.name).toBe("dance_disco");
    expect(disco.duration).toBe(1.6);
    expect(disco.tracks.some((t) => t.name === `${GOBKIT_JOINTS.rightUpperArm}.quaternion`)).toBe(true);
    expect(disco.tracks.some((t) => t.name === `${GOBKIT_JOINTS.spine}.quaternion`)).toBe(true);
  });

  it("creates wave animation clip with robotic snapping", () => {
    const wave = createWaveAnimationClip();
    expect(wave.name).toBe("dance_wave");
    expect(wave.duration).toBe(2.0);
    expect(wave.tracks.some((t) => t.name === `${GOBKIT_JOINTS.leftForearm}.quaternion`)).toBe(true);
    expect(wave.tracks.some((t) => t.name === `${GOBKIT_JOINTS.head}.quaternion`)).toBe(true);
  });

  it("creates spin animation clip with full 360 rotation on vertical axis", () => {
    const spin = createSpinAnimationClip();
    expect(spin.name).toBe("dance_spin");
    expect(spin.duration).toBe(1.6);
    expect(spin.tracks.some((t) => t.name === `${GOBKIT_JOINTS.hips}.quaternion`)).toBe(true);
  });

  it("creates rock animation clip with headbanging and air guitar", () => {
    const rock = createRockAnimationClip();
    expect(rock.name).toBe("dance_rock");
    expect(rock.duration).toBe(1.2);
    expect(rock.tracks.some((t) => t.name === `${GOBKIT_JOINTS.head}.quaternion`)).toBe(true);
    expect(rock.tracks.some((t) => t.name === `${GOBKIT_JOINTS.rightForearm}.quaternion`)).toBe(true);
  });

  it("creates synthetic sitting animation clip", () => {
    const sit = createSittingAnimationClip();
    expect(sit.name).toBe("sitting");
    expect(sit.duration).toBe(1.0);
    expect(sit.tracks.some((t) => t.name === `${GOBKIT_JOINTS.leftThigh}.quaternion`)).toBe(true);
    expect(sit.tracks.some((t) => t.name === `${GOBKIT_JOINTS.leftCalf}.quaternion`)).toBe(true);
  });
});
