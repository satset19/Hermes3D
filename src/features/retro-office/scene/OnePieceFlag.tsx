import { memo } from "react";

const FLAG_WIDTH = 0.52;
const FLAG_HEIGHT = 0.3;

const TEETH_OFFSETS = [-0.02, -0.01, 0, 0.01, 0.02];

function Bone({ rotation }: { rotation: number }) {
  return (
    <group rotation={[0, 0, rotation]}>
      {/* Central bone shaft */}
      <mesh position={[0, 0, 0]}>
        <planeGeometry args={[0.33, 0.022]} />
        <meshBasicMaterial color="#ffffff" side={2} />
      </mesh>
      {/* Right bone condyles */}
      <mesh position={[0.165, 0.013, 0]}>
        <circleGeometry args={[0.017, 18]} />
        <meshBasicMaterial color="#ffffff" side={2} />
      </mesh>
      <mesh position={[0.165, -0.013, 0]}>
        <circleGeometry args={[0.017, 18]} />
        <meshBasicMaterial color="#ffffff" side={2} />
      </mesh>
      {/* Left bone condyles */}
      <mesh position={[-0.165, 0.013, 0]}>
        <circleGeometry args={[0.017, 18]} />
        <meshBasicMaterial color="#ffffff" side={2} />
      </mesh>
      <mesh position={[-0.165, -0.013, 0]}>
        <circleGeometry args={[0.017, 18]} />
        <meshBasicMaterial color="#ffffff" side={2} />
      </mesh>
    </group>
  );
}

function JollyRogerEmblem() {
  return (
    <group>
      {/* Crossed Bones behind skull */}
      <group position={[0, -0.005, 0.001]}>
        <Bone rotation={0.54} />
        <Bone rotation={-0.54} />
      </group>

      {/* Skull Base: Cranium + Jaw + Chin */}
      <group position={[0, 0, 0.002]}>
        {/* Cranium */}
        <mesh position={[0, 0.005, 0]}>
          <circleGeometry args={[0.056, 32]} />
          <meshBasicMaterial color="#ffffff" side={2} />
        </mesh>
        {/* Upper Jaw Block */}
        <mesh position={[0, -0.04, 0]}>
          <planeGeometry args={[0.066, 0.044]} />
          <meshBasicMaterial color="#ffffff" side={2} />
        </mesh>
        {/* Rounded Chin */}
        <mesh position={[0, -0.058, 0]}>
          <circleGeometry args={[0.028, 24]} />
          <meshBasicMaterial color="#ffffff" side={2} />
        </mesh>
      </group>

      {/* Skull Facial Features */}
      <group position={[0, 0, 0.0026]}>
        {/* Left Eye Socket */}
        <mesh position={[-0.024, 0.004, 0]}>
          <circleGeometry args={[0.0145, 20]} />
          <meshBasicMaterial color="#0b0b0e" side={2} />
        </mesh>
        {/* Right Eye Socket */}
        <mesh position={[0.024, 0.004, 0]}>
          <circleGeometry args={[0.0145, 20]} />
          <meshBasicMaterial color="#0b0b0e" side={2} />
        </mesh>
        {/* Inverted Triangle Nose Cavity */}
        <mesh position={[0, -0.016, 0]} rotation={[0, 0, Math.PI]}>
          <circleGeometry args={[0.0055, 3]} />
          <meshBasicMaterial color="#0b0b0e" side={2} />
        </mesh>
        {/* Horizontal Mouth Line */}
        <mesh position={[0, -0.045, 0]}>
          <planeGeometry args={[0.056, 0.003]} />
          <meshBasicMaterial color="#0b0b0e" side={2} />
        </mesh>
        {/* Vertical Teeth Markings */}
        {TEETH_OFFSETS.map((xOffset) => (
          <mesh key={`tooth-${xOffset}`} position={[xOffset, -0.045, 0.0002]}>
            <planeGeometry args={[0.0024, 0.018]} />
            <meshBasicMaterial color="#0b0b0e" side={2} />
          </mesh>
        ))}
      </group>

      {/* Straw Hat (Mugiwara) */}
      <group position={[0, 0, 0.0032]}>
        {/* Hat Brim */}
        <mesh position={[0, 0.044, 0]} scale={[1, 0.22, 1]}>
          <circleGeometry args={[0.088, 32]} />
          <meshBasicMaterial color="#eab308" side={2} />
        </mesh>
        {/* Hat Crown Dome */}
        <mesh position={[0, 0.044, 0.0002]}>
          <circleGeometry args={[0.046, 32, 0, Math.PI]} />
          <meshBasicMaterial color="#eab308" side={2} />
        </mesh>
        {/* Red Ribbon Band */}
        <mesh position={[0, 0.049, 0.0004]}>
          <planeGeometry args={[0.088, 0.011]} />
          <meshBasicMaterial color="#dc2626" side={2} />
        </mesh>
      </group>
    </group>
  );
}

export const OnePieceFlagArt = memo(function OnePieceFlagArt() {
  return (
    <>
      {/* Black Cloth Banner */}
      <mesh position={[0, 0, 0]}>
        <planeGeometry args={[FLAG_WIDTH, FLAG_HEIGHT]} />
        <meshBasicMaterial color="#0b0b0e" side={2} />
      </mesh>

      {/* Front Face Emblem */}
      <group position={[0, 0, 0.0005]}>
        <JollyRogerEmblem />
      </group>

      {/* Back Face Emblem (mirrored for 3D visibility from behind) */}
      <group position={[0, 0, -0.0005]} rotation={[0, Math.PI, 0]}>
        <JollyRogerEmblem />
      </group>
    </>
  );
});
