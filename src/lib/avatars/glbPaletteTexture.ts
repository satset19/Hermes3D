export type CustomAvatarColors = {
  skin?: string;
  hair?: string;
  top?: string;
  bottom?: string;
  shoes?: string;
  accent?: string;
};

export type RampDefinition = {
  x: number;
  startY: number;
  stepHeight: number;
};

// 9 vertical ramps of 32x32 blocks in the 512x2048 texture atlas
export const PALETTE_RAMP_COORDINATES: Record<string, RampDefinition> = {
  top: { x: 0, startY: 0, stepHeight: 32 },
  accent: { x: 32, startY: 0, stepHeight: 32 },
  hair: { x: 480, startY: 0, stepHeight: 32 },
  topInner: { x: 0, startY: 128, stepHeight: 32 },
  shoes: { x: 320, startY: 128, stepHeight: 32 },
  skin: { x: 0, startY: 256, stepHeight: 32 },
  jacket: { x: 256, startY: 512, stepHeight: 32 },
  bottom1: { x: 160, startY: 640, stepHeight: 32 },
  bottom2: { x: 192, startY: 640, stepHeight: 32 },
};

const SHADE_MULTIPLIERS = [1.0, 0.85, 0.7, 0.55] as const;

export const parseHex = (hex: string): [number, number, number] | null => {
  if (typeof hex !== "string") return null;
  const clean = hex.trim().replace(/^#/, "");
  if (clean.length === 3) {
    const r = Number.parseInt(clean[0] + clean[0], 16);
    const g = Number.parseInt(clean[1] + clean[1], 16);
    const b = Number.parseInt(clean[2] + clean[2], 16);
    if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return null;
    return [r, g, b];
  }
  if (clean.length === 6) {
    const r = Number.parseInt(clean.slice(0, 2), 16);
    const g = Number.parseInt(clean.slice(2, 4), 16);
    const b = Number.parseInt(clean.slice(4, 6), 16);
    if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return null;
    return [r, g, b];
  }
  return null;
};

export const shadeHex = (hex: string, factor: number): string => {
  const rgb = parseHex(hex);
  if (!rgb) return "#808080";
  const r = Math.min(255, Math.max(0, Math.round(rgb[0] * factor)));
  const g = Math.min(255, Math.max(0, Math.round(rgb[1] * factor)));
  const b = Math.min(255, Math.max(0, Math.round(rgb[2] * factor)));
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
};

export const computeRampShades = (baseHex: string): string[] => {
  return SHADE_MULTIPLIERS.map((factor) => shadeHex(baseHex, factor));
};

export const applyColorsToPaletteCanvas = (
  canvas: HTMLCanvasElement,
  baseImage: HTMLImageElement | HTMLCanvasElement,
  colors: CustomAvatarColors,
): void => {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  canvas.width = 512;
  canvas.height = 2048;
  ctx.drawImage(baseImage, 0, 0, 512, 2048);

  const drawRamp = (def: RampDefinition, hexColor: string | undefined) => {
    if (!hexColor) return;
    const shades = computeRampShades(hexColor);
    for (let step = 0; step < 4; step += 1) {
      ctx.fillStyle = shades[step];
      ctx.fillRect(def.x, def.startY + step * def.stepHeight, 32, def.stepHeight);
    }
  };

  if (colors.top) {
    drawRamp(PALETTE_RAMP_COORDINATES.top, colors.top);
    drawRamp(PALETTE_RAMP_COORDINATES.jacket, colors.top);
  }
  if (colors.accent) {
    drawRamp(PALETTE_RAMP_COORDINATES.accent, colors.accent);
  }
  if (colors.hair) {
    drawRamp(PALETTE_RAMP_COORDINATES.hair, colors.hair);
  }
  if (colors.skin) {
    drawRamp(PALETTE_RAMP_COORDINATES.skin, colors.skin);
  }
  if (colors.shoes) {
    drawRamp(PALETTE_RAMP_COORDINATES.shoes, colors.shoes);
  }
  if (colors.bottom) {
    drawRamp(PALETTE_RAMP_COORDINATES.bottom1, colors.bottom);
    drawRamp(PALETTE_RAMP_COORDINATES.bottom2, colors.bottom);
  }
};
