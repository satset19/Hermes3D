import * as THREE from "three";

/**
 * 13-joint skeletal rig used across all 8 Gobkit humanoid GLB models.
 */
export const GOBKIT_JOINTS = {
  root: "xb6a68",
  hips: "ahn3vx",
  leftThigh: "jtgqkt",
  leftCalf: "ddr7xp",
  rightThigh: "meax35",
  rightCalf: "facug3",
  spine: "fajheg",
  leftUpperArm: "kgt65p",
  leftForearm: "mu2k44",
  rightUpperArm: "e5zhbk",
  rightForearm: "cpjt9b",
  neck: "ekp3jr",
  head: "ape5q7",
} as const;

export type GobkitJointKey = keyof typeof GOBKIT_JOINTS;
export type GobkitJointName = (typeof GOBKIT_JOINTS)[GobkitJointKey];

/**
 * Constructs a QuaternionKeyframeTrack from Euler angles (in radians).
 */
export function createEulerRotationTrack(
  jointName: string,
  times: number[],
  eulerKeyframes: [x: number, y: number, z: number, order?: THREE.EulerOrder][],
): THREE.QuaternionKeyframeTrack {
  const values: number[] = [];
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();

  for (const [x, y, z, order = "XYZ"] of eulerKeyframes) {
    e.set(x, y, z, order);
    q.setFromEuler(e);
    values.push(q.x, q.y, q.z, q.w);
  }

  return new THREE.QuaternionKeyframeTrack(`${jointName}.quaternion`, times, values);
}

/**
 * Constructs a QuaternionKeyframeTrack from explicit Axis-Angle rotations.
 */
export function createAxisAngleRotationTrack(
  jointName: string,
  times: number[],
  axisAngleKeyframes: [axis: THREE.Vector3, angle: number][],
): THREE.QuaternionKeyframeTrack {
  const values: number[] = [];
  const q = new THREE.Quaternion();

  for (const [axis, angle] of axisAngleKeyframes) {
    q.setFromAxisAngle(axis, angle);
    values.push(q.x, q.y, q.z, q.w);
  }

  return new THREE.QuaternionKeyframeTrack(`${jointName}.quaternion`, times, values);
}

/**
 * 70s Disco Point: Right hand pointing diagonal up, hips swaying, rhythmic knees.
 */
export function createDiscoAnimationClip(): THREE.AnimationClip {
  const duration = 1.6;
  const times = [0, 0.4, 0.8, 1.2, 1.6];
  const tracks: THREE.KeyframeTrack[] = [];

  // Right upper arm: pointing up diagonal at t=0 and t=1.6, down across left hip at t=0.8
  tracks.push(
    createEulerRotationTrack(GOBKIT_JOINTS.rightUpperArm, times, [
      [1.7, -0.3, 0.8],
      [0.8, -0.5, 0.4],
      [-0.4, -0.8, -0.3],
      [0.8, -0.5, 0.4],
      [1.7, -0.3, 0.8],
    ]),
  );

  // Right forearm: extended pointing up, bent down towards left hip
  tracks.push(
    createEulerRotationTrack(GOBKIT_JOINTS.rightForearm, times, [
      [0.1, 0.0, 0.2],
      [-0.4, 0.2, 0.1],
      [-0.8, 0.4, 0.0],
      [-0.4, 0.2, 0.1],
      [0.1, 0.0, 0.2],
    ]),
  );

  // Left upper arm: resting on hip with flared elbow
  tracks.push(
    createEulerRotationTrack(GOBKIT_JOINTS.leftUpperArm, times, [
      [-0.2, 0.4, -0.8],
      [-0.25, 0.35, -0.75],
      [-0.2, 0.4, -0.8],
      [-0.25, 0.35, -0.75],
      [-0.2, 0.4, -0.8],
    ]),
  );

  // Left forearm: bent across hip
  tracks.push(
    createEulerRotationTrack(GOBKIT_JOINTS.leftForearm, times, [
      [0.6, 0.2, 0.1],
      [0.55, 0.2, 0.1],
      [0.6, 0.2, 0.1],
      [0.55, 0.2, 0.1],
      [0.6, 0.2, 0.1],
    ]),
  );

  // Spine: swaying side to side
  tracks.push(
    createEulerRotationTrack(GOBKIT_JOINTS.spine, times, [
      [0.0, 0.0, -0.15],
      [0.05, 0.0, 0.0],
      [0.0, 0.0, 0.15],
      [0.05, 0.0, 0.0],
      [0.0, 0.0, -0.15],
    ]),
  );

  // Hips: swaying laterally
  tracks.push(
    createEulerRotationTrack(GOBKIT_JOINTS.hips, times, [
      [0.0, 0.0, 0.12],
      [0.02, 0.0, 0.0],
      [0.0, 0.0, -0.12],
      [0.02, 0.0, 0.0],
      [0.0, 0.0, 0.12],
    ]),
  );

  // Head: looking up towards pointing hand, then down
  tracks.push(
    createEulerRotationTrack(GOBKIT_JOINTS.head, times, [
      [-0.25, -0.15, -0.1],
      [0.0, 0.0, 0.0],
      [0.2, 0.15, 0.1],
      [0.0, 0.0, 0.0],
      [-0.25, -0.15, -0.1],
    ]),
  );

  // Knees: rhythmic knee bend on the beats
  tracks.push(
    createEulerRotationTrack(GOBKIT_JOINTS.leftThigh, times, [
      [-0.05, 0.0, 0.0],
      [-0.25, 0.0, 0.0],
      [-0.05, 0.0, 0.0],
      [-0.25, 0.0, 0.0],
      [-0.05, 0.0, 0.0],
    ]),
  );
  tracks.push(
    createEulerRotationTrack(GOBKIT_JOINTS.leftCalf, times, [
      [0.05, 0.0, 0.0],
      [0.3, 0.0, 0.0],
      [0.05, 0.0, 0.0],
      [0.3, 0.0, 0.0],
      [0.05, 0.0, 0.0],
    ]),
  );
  tracks.push(
    createEulerRotationTrack(GOBKIT_JOINTS.rightThigh, times, [
      [-0.05, 0.0, 0.0],
      [-0.25, 0.0, 0.0],
      [-0.05, 0.0, 0.0],
      [-0.25, 0.0, 0.0],
      [-0.05, 0.0, 0.0],
    ]),
  );
  tracks.push(
    createEulerRotationTrack(GOBKIT_JOINTS.rightCalf, times, [
      [0.05, 0.0, 0.0],
      [0.3, 0.0, 0.0],
      [0.05, 0.0, 0.0],
      [0.3, 0.0, 0.0],
      [0.05, 0.0, 0.0],
    ]),
  );

  return new THREE.AnimationClip("dance_disco", duration, tracks);
}

/**
 * Robot Wave: Popping and arm wave ripple across joints with 90° head quantization.
 */
export function createWaveAnimationClip(): THREE.AnimationClip {
  const duration = 2.0;
  const times = [0, 0.4, 0.8, 1.2, 1.6, 2.0];
  const tracks: THREE.KeyframeTrack[] = [];

  // Left forearm wave ripple: pops at t=0 and t=0.4
  tracks.push(
    createEulerRotationTrack(GOBKIT_JOINTS.leftForearm, times, [
      [0.9, 0.0, 0.0],
      [0.3, 0.0, 0.0],
      [0.0, 0.0, 0.0],
      [0.0, 0.0, 0.0],
      [0.2, 0.0, 0.0],
      [0.9, 0.0, 0.0],
    ]),
  );

  // Left upper arm: pops at t=0.4
  tracks.push(
    createEulerRotationTrack(GOBKIT_JOINTS.leftUpperArm, times, [
      [-0.2, 0.0, -0.4],
      [-0.4, 0.0, -1.2],
      [-0.2, 0.0, -0.5],
      [-0.1, 0.0, -0.2],
      [-0.1, 0.0, -0.2],
      [-0.2, 0.0, -0.4],
    ]),
  );

  // Spine: ripples from left to right
  tracks.push(
    createEulerRotationTrack(GOBKIT_JOINTS.spine, times, [
      [0.0, 0.0, -0.1],
      [0.05, 0.0, -0.2],
      [0.0, 0.0, 0.0],
      [-0.05, 0.0, 0.2],
      [0.0, 0.0, 0.1],
      [0.0, 0.0, -0.1],
    ]),
  );

  // Right upper arm: pops at t=1.2
  tracks.push(
    createEulerRotationTrack(GOBKIT_JOINTS.rightUpperArm, times, [
      [-0.1, 0.0, 0.2],
      [-0.1, 0.0, 0.2],
      [-0.2, 0.0, 0.5],
      [-0.4, 0.0, 1.2],
      [-0.2, 0.0, 0.4],
      [-0.1, 0.0, 0.2],
    ]),
  );

  // Right forearm: pops at t=1.6
  tracks.push(
    createEulerRotationTrack(GOBKIT_JOINTS.rightForearm, times, [
      [0.0, 0.0, 0.0],
      [0.0, 0.0, 0.0],
      [0.1, 0.0, 0.0],
      [0.4, 0.0, 0.0],
      [0.9, 0.0, 0.0],
      [0.0, 0.0, 0.0],
    ]),
  );

  // Head: 90-degree quantized robotic snapping turns
  tracks.push(
    createEulerRotationTrack(GOBKIT_JOINTS.head, times, [
      [0.0, -Math.PI / 4, 0.0],
      [0.0, -Math.PI / 4, 0.0],
      [0.0, 0.0, 0.0],
      [0.0, Math.PI / 4, 0.0],
      [0.0, Math.PI / 4, 0.0],
      [0.0, -Math.PI / 4, 0.0],
    ]),
  );

  return new THREE.AnimationClip("dance_wave", duration, tracks);
}

/**
 * 360° Spin / Pirouette: Twirl on vertical axis with outstretched arms.
 */
export function createSpinAnimationClip(): THREE.AnimationClip {
  const duration = 1.6;
  const times = [0, 0.4, 0.8, 1.2, 1.6];
  const tracks: THREE.KeyframeTrack[] = [];
  const upAxis = new THREE.Vector3(0, 0, 1);

  // Full 360 pirouette on vertical axis of hips
  tracks.push(
    createAxisAngleRotationTrack(GOBKIT_JOINTS.hips, times, [
      [upAxis, 0],
      [upAxis, Math.PI / 2],
      [upAxis, Math.PI],
      [upAxis, (3 * Math.PI) / 2],
      [upAxis, 2 * Math.PI],
    ]),
  );

  // Arms outstretched laterally (pirouette pose)
  tracks.push(
    createEulerRotationTrack(GOBKIT_JOINTS.leftUpperArm, times, [
      [-0.2, 0.0, -1.3],
      [-0.2, 0.0, -1.3],
      [-0.2, 0.0, -1.3],
      [-0.2, 0.0, -1.3],
      [-0.2, 0.0, -1.3],
    ]),
  );
  tracks.push(
    createEulerRotationTrack(GOBKIT_JOINTS.leftForearm, times, [
      [0.3, 0.0, 0.1],
      [0.3, 0.0, 0.1],
      [0.3, 0.0, 0.1],
      [0.3, 0.0, 0.1],
      [0.3, 0.0, 0.1],
    ]),
  );
  tracks.push(
    createEulerRotationTrack(GOBKIT_JOINTS.rightUpperArm, times, [
      [-0.2, 0.0, 1.3],
      [-0.2, 0.0, 1.3],
      [-0.2, 0.0, 1.3],
      [-0.2, 0.0, 1.3],
      [-0.2, 0.0, 1.3],
    ]),
  );
  tracks.push(
    createEulerRotationTrack(GOBKIT_JOINTS.rightForearm, times, [
      [0.3, 0.0, -0.1],
      [0.3, 0.0, -0.1],
      [0.3, 0.0, -0.1],
      [0.3, 0.0, -0.1],
      [0.3, 0.0, -0.1],
    ]),
  );

  // Legs: right leg straight supporting, left leg slightly bent
  tracks.push(
    createEulerRotationTrack(GOBKIT_JOINTS.leftThigh, times, [
      [-0.3, 0.0, -0.1],
      [-0.3, 0.0, -0.1],
      [-0.3, 0.0, -0.1],
      [-0.3, 0.0, -0.1],
      [-0.3, 0.0, -0.1],
    ]),
  );
  tracks.push(
    createEulerRotationTrack(GOBKIT_JOINTS.leftCalf, times, [
      [0.6, 0.0, 0.0],
      [0.6, 0.0, 0.0],
      [0.6, 0.0, 0.0],
      [0.6, 0.0, 0.0],
      [0.6, 0.0, 0.0],
    ]),
  );

  return new THREE.AnimationClip("dance_spin", duration, tracks);
}

/**
 * Rock Headbang: Vigorous headbanging with sharp spine flex and air guitar strumming.
 */
export function createRockAnimationClip(): THREE.AnimationClip {
  const duration = 1.2;
  const times = [0, 0.3, 0.6, 0.9, 1.2];
  const tracks: THREE.KeyframeTrack[] = [];

  // Headbanging head pitch: down at 0, up at 0.3, down at 0.6, up at 0.9, down at 1.2
  tracks.push(
    createEulerRotationTrack(GOBKIT_JOINTS.head, times, [
      [0.75, 0.0, 0.0],
      [-0.4, 0.0, 0.0],
      [0.75, 0.0, 0.0],
      [-0.4, 0.0, 0.0],
      [0.75, 0.0, 0.0],
    ]),
  );

  // Neck flexing with headbang
  tracks.push(
    createEulerRotationTrack(GOBKIT_JOINTS.neck, times, [
      [0.35, 0.0, 0.0],
      [-0.2, 0.0, 0.0],
      [0.35, 0.0, 0.0],
      [-0.2, 0.0, 0.0],
      [0.35, 0.0, 0.0],
    ]),
  );

  // Spine: hunch forward and rebound
  tracks.push(
    createEulerRotationTrack(GOBKIT_JOINTS.spine, times, [
      [0.3, 0.0, 0.0],
      [-0.1, 0.0, 0.0],
      [0.3, 0.0, 0.0],
      [-0.1, 0.0, 0.0],
      [0.3, 0.0, 0.0],
    ]),
  );

  // Left arm: holding guitar neck up and out
  tracks.push(
    createEulerRotationTrack(GOBKIT_JOINTS.leftUpperArm, times, [
      [-0.6, 0.4, -0.6],
      [-0.5, 0.35, -0.55],
      [-0.6, 0.4, -0.6],
      [-0.5, 0.35, -0.55],
      [-0.6, 0.4, -0.6],
    ]),
  );
  tracks.push(
    createEulerRotationTrack(GOBKIT_JOINTS.leftForearm, times, [
      [-0.7, 0.2, 0.1],
      [-0.65, 0.2, 0.1],
      [-0.7, 0.2, 0.1],
      [-0.65, 0.2, 0.1],
      [-0.7, 0.2, 0.1],
    ]),
  );

  // Right arm: vigorous air guitar strumming
  tracks.push(
    createEulerRotationTrack(GOBKIT_JOINTS.rightUpperArm, times, [
      [-0.2, -0.3, 0.3],
      [0.1, -0.2, 0.2],
      [-0.2, -0.3, 0.3],
      [0.1, -0.2, 0.2],
      [-0.2, -0.3, 0.3],
    ]),
  );
  tracks.push(
    createEulerRotationTrack(GOBKIT_JOINTS.rightForearm, times, [
      [-0.3, -0.3, 0.0],
      [0.5, 0.1, 0.0],
      [-0.3, -0.3, 0.0],
      [0.5, 0.1, 0.0],
      [-0.3, -0.3, 0.0],
    ]),
  );

  // Wide rock stance legs
  tracks.push(
    createEulerRotationTrack(GOBKIT_JOINTS.leftThigh, times, [
      [-0.2, 0.0, -0.2],
      [-0.1, 0.0, -0.2],
      [-0.2, 0.0, -0.2],
      [-0.1, 0.0, -0.2],
      [-0.2, 0.0, -0.2],
    ]),
  );
  tracks.push(
    createEulerRotationTrack(GOBKIT_JOINTS.leftCalf, times, [
      [0.3, 0.0, 0.0],
      [0.15, 0.0, 0.0],
      [0.3, 0.0, 0.0],
      [0.15, 0.0, 0.0],
      [0.3, 0.0, 0.0],
    ]),
  );
  tracks.push(
    createEulerRotationTrack(GOBKIT_JOINTS.rightThigh, times, [
      [-0.2, 0.0, 0.2],
      [-0.1, 0.0, 0.2],
      [-0.2, 0.0, 0.2],
      [-0.1, 0.0, 0.2],
      [-0.2, 0.0, 0.2],
    ]),
  );
  tracks.push(
    createEulerRotationTrack(GOBKIT_JOINTS.rightCalf, times, [
      [0.3, 0.0, 0.0],
      [0.15, 0.0, 0.0],
      [0.3, 0.0, 0.0],
      [0.15, 0.0, 0.0],
      [0.3, 0.0, 0.0],
    ]),
  );

  return new THREE.AnimationClip("dance_rock", duration, tracks);
}

/**
 * Synthetic Sitting Pose with Forward Typing Posture:
 * Thighs rotated -90° on X, knees rotated +90° on X, arms in typing position.
 */
export function createSittingAnimationClip(): THREE.AnimationClip {
  const duration = 1.0;
  const times = [0, 0.25, 0.5, 0.75, 1.0];
  const tracks: THREE.KeyframeTrack[] = [];
  const xAxis = new THREE.Vector3(1, 0, 0);

  // Thigh joints rotate -90 degrees around X axis
  const thighQuats: [THREE.Vector3, number][] = times.map(() => [xAxis, -Math.PI / 2]);
  tracks.push(createAxisAngleRotationTrack(GOBKIT_JOINTS.leftThigh, times, thighQuats));
  tracks.push(createAxisAngleRotationTrack(GOBKIT_JOINTS.rightThigh, times, thighQuats));

  // Knee/calf joints rotate +90 degrees around X axis
  const calfQuats: [THREE.Vector3, number][] = times.map(() => [xAxis, Math.PI / 2]);
  tracks.push(createAxisAngleRotationTrack(GOBKIT_JOINTS.leftCalf, times, calfQuats));
  tracks.push(createAxisAngleRotationTrack(GOBKIT_JOINTS.rightCalf, times, calfQuats));

  // Spine: upright seated posture with slight forward lean
  tracks.push(
    createEulerRotationTrack(GOBKIT_JOINTS.spine, times, [
      [0.05, 0.0, 0.0],
      [0.05, 0.0, 0.0],
      [0.05, 0.0, 0.0],
      [0.05, 0.0, 0.0],
      [0.05, 0.0, 0.0],
    ]),
  );

  // Arm/hand forward typing posture with slight harmonic oscillation
  tracks.push(
    createEulerRotationTrack(GOBKIT_JOINTS.leftUpperArm, times, [
      [-0.5, 0.1, -0.2],
      [-0.5, 0.1, -0.2],
      [-0.5, 0.1, -0.2],
      [-0.5, 0.1, -0.2],
      [-0.5, 0.1, -0.2],
    ]),
  );
  tracks.push(
    createEulerRotationTrack(GOBKIT_JOINTS.leftForearm, times, [
      [-0.38, 0.0, 0.0],
      [-0.43, 0.0, 0.0],
      [-0.38, 0.0, 0.0],
      [-0.43, 0.0, 0.0],
      [-0.38, 0.0, 0.0],
    ]),
  );

  tracks.push(
    createEulerRotationTrack(GOBKIT_JOINTS.rightUpperArm, times, [
      [-0.5, -0.1, 0.2],
      [-0.5, -0.1, 0.2],
      [-0.5, -0.1, 0.2],
      [-0.5, -0.1, 0.2],
      [-0.5, -0.1, 0.2],
    ]),
  );
  tracks.push(
    createEulerRotationTrack(GOBKIT_JOINTS.rightForearm, times, [
      [-0.43, 0.0, 0.0],
      [-0.38, 0.0, 0.0],
      [-0.43, 0.0, 0.0],
      [-0.38, 0.0, 0.0],
      [-0.43, 0.0, 0.0],
    ]),
  );

  // Head: looking forward/down slightly at workstation
  tracks.push(
    createEulerRotationTrack(GOBKIT_JOINTS.head, times, [
      [0.15, 0.0, 0.0],
      [0.15, 0.0, 0.0],
      [0.15, 0.0, 0.0],
      [0.15, 0.0, 0.0],
      [0.15, 0.0, 0.0],
    ]),
  );

  return new THREE.AnimationClip("sitting", duration, tracks);
}

/**
 * Returns procedural AnimationClips for dance styles matching the 13-joint Gobkit rig.
 */
export function createDanceAnimationClips(): THREE.AnimationClip[] {
  return [
    createDiscoAnimationClip(),
    createWaveAnimationClip(),
    createSpinAnimationClip(),
    createRockAnimationClip(),
  ];
}
