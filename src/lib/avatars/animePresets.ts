import {
  CHARACTER_COLOR_PALETTES,
  type CharacterColorPalette,
} from "@/lib/avatars/colorPalettes";

export type AnimeAvatarPreset = {
  id: string;
  label: string;
  url: string;
  modelUrl: string;
  palette: CharacterColorPalette;
  license: "CC0" | "CC-BY" | "CC-BY-SA";
  source: string;
  author?: string;
};

const PORTRAIT_AUTHOR = "Lisa Wischofsky (DiceBear lorelei)";
const PORTRAIT_SOURCE = "https://www.dicebear.com/styles/lorelei/";
const MODEL_AUTHOR = "Gobkit (gobkit.com)";
const MODEL_SOURCE = "https://gobkit.com/freebies";

const make = (id: string, label: string): AnimeAvatarPreset => ({
  id,
  label,
  url: `/avatars/anime/${id}.svg`,
  modelUrl: `/office-assets/models/avatars/${id}.glb`,
  palette: CHARACTER_COLOR_PALETTES[id] ?? {
    id,
    name: label,
    skin: "#f8d5c2",
    hair: "#151515",
    top: "#2d3748",
    bottom: "#1e3a8a",
    accent: "#f59e0b",
    shoes: "#1a1a1a",
  },
  license: "CC0",
  source: `${PORTRAIT_SOURCE} + ${MODEL_SOURCE}`,
  author: `${PORTRAIT_AUTHOR}, ${MODEL_AUTHOR}`,
});

export const ANIME_AVATAR_PRESETS: readonly AnimeAvatarPreset[] = [
  make("aiko", "Aiko"),
  make("haruto", "Haruto"),
  make("yumi", "Yumi"),
  make("kenji", "Kenji"),
  make("sakura", "Sakura"),
  make("ren", "Ren"),
  make("mina", "Mina"),
  make("takeshi", "Takeshi"),
] as const;

export const findAnimePresetByUrl = (
  url: string | null | undefined,
): AnimeAvatarPreset | null => {
  const trimmed = url?.trim();
  if (!trimmed) return null;
  return ANIME_AVATAR_PRESETS.find((p) => p.url === trimmed) ?? null;
};

export const findAnimePresetModelUrl = (
  imageUrl: string | null | undefined,
): string | null => findAnimePresetByUrl(imageUrl)?.modelUrl ?? null;

export const ALLOWED_AVATAR_URL_PREFIXES = ["/avatars/"] as const;

export const isAllowedAvatarUrl = (value: unknown): value is string => {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  return ALLOWED_AVATAR_URL_PREFIXES.some((p) => trimmed.startsWith(p));
};
