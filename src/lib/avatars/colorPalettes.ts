export type CharacterColorPalette = {
  id: string;
  name: string;
  skin: string;
  hair: string;
  top: string;
  topInner?: string;
  bottom: string;
  accent: string;
  shoes: string;
};

export const CHARACTER_COLOR_PALETTES: Record<string, CharacterColorPalette> = {
  aiko: {
    id: "aiko",
    name: "Aiko",
    skin: "#f8d5c2",
    hair: "#3a2018",
    top: "#1e293b",
    topInner: "#f8fafc",
    bottom: "#334155",
    accent: "#f43f5e",
    shoes: "#0f172a",
  },
  haruto: {
    id: "haruto",
    name: "Haruto",
    skin: "#f4c58a",
    hair: "#4a3728",
    top: "#166534",
    topInner: "#fef3c7",
    bottom: "#b45309",
    accent: "#f59e0b",
    shoes: "#78350f",
  },
  yumi: {
    id: "yumi",
    name: "Yumi",
    skin: "#fde7da",
    hair: "#c26d38",
    top: "#fde047",
    topInner: "#ffffff",
    bottom: "#2563eb",
    accent: "#f472b6",
    shoes: "#f1f5f9",
  },
  kenji: {
    id: "kenji",
    name: "Kenji",
    skin: "#d8a06e",
    hair: "#1e1b4b",
    top: "#0d9488",
    bottom: "#374151",
    accent: "#06b6d4",
    shoes: "#4b5563",
  },
  sakura: {
    id: "sakura",
    name: "Sakura",
    skin: "#f3d7c5",
    hair: "#cbd5e1",
    top: "#be185d",
    topInner: "#fffbeb",
    bottom: "#581c87",
    accent: "#d97706",
    shoes: "#5c2e17",
  },
  ren: {
    id: "ren",
    name: "Ren",
    skin: "#d69a6e",
    hair: "#fef08a",
    top: "#ea580c",
    bottom: "#18181b",
    accent: "#84cc16",
    shoes: "#09090b",
  },
  mina: {
    id: "mina",
    name: "Mina",
    skin: "#f8dfcd",
    hair: "#a855f7",
    top: "#e11d48",
    bottom: "#4338ca",
    accent: "#10b981",
    shoes: "#d6d3d1",
  },
  takeshi: {
    id: "takeshi",
    name: "Takeshi",
    skin: "#c28b5e",
    hair: "#27272a",
    top: "#1e293b",
    bottom: "#365314",
    accent: "#b91c1c",
    shoes: "#09090b",
  },
};

export const getCharacterColorPalette = (
  idOrUrl: string | null | undefined,
): CharacterColorPalette | null => {
  if (!idOrUrl) return null;
  const cleanId = idOrUrl.replace(/^.*\/|\.[^.]+$/g, "").toLowerCase();
  return CHARACTER_COLOR_PALETTES[cleanId] ?? null;
};
