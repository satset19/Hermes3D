import type { AgentAvatarGender } from "@/lib/avatars/profile";

export type AvatarBodyShape = {
  torsoWidthScale: number;
  torsoDepthScale: number;
  armOffsetScale: number;
  showLashes: boolean;
  mouthColor: string;
};

const BODY_SHAPES: Record<AgentAvatarGender, AvatarBodyShape> = {
  male: {
    torsoWidthScale: 1,
    torsoDepthScale: 1,
    armOffsetScale: 1,
    showLashes: false,
    mouthColor: "#9c4a4a",
  },
  female: {
    torsoWidthScale: 0.89,
    torsoDepthScale: 0.9,
    armOffsetScale: 0.92,
    showLashes: true,
    mouthColor: "#c2416b",
  },
};

export const getAvatarBodyShape = (gender: AgentAvatarGender): AvatarBodyShape =>
  BODY_SHAPES[gender] ?? BODY_SHAPES.male;
