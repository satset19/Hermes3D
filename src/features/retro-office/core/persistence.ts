import {
  ATM_MIGRATION_KEY,
  BEDROOM_MIGRATION_KEY,
  PHONE_BOOTH_MIGRATION_KEY,
  QA_LAB_MIGRATION_KEY,
  SMS_BOOTH_MIGRATION_KEY,
  SERVER_ROOM_MIGRATION_KEY,
  STORAGE_KEY,
} from "@/features/retro-office/core/constants";
import type { FurnitureItem } from "@/features/retro-office/core/types";

const AGENT_POSITIONS_STORAGE_KEY = "hermes3d_agent_positions";

export type AgentOfficePosition = { x: number; y: number };
export type AgentOfficePositions = Record<string, AgentOfficePosition>;

const resolveStorageKey = (key: string, namespace = "default") =>
  namespace === "default" ? key : `${key}:${namespace}`;

const hasStorageFlag = (key: string, namespace = "default") => {
  try {
    return localStorage.getItem(resolveStorageKey(key, namespace)) === "1";
  } catch {
    return false;
  }
};

const markStorageFlag = (key: string, namespace = "default") => {
  try {
    localStorage.setItem(resolveStorageKey(key, namespace), "1");
  } catch {
    /* ignore */
  }
};

export const saveFurniture = (items: FurnitureItem[], namespace = "default") => {
  try {
    localStorage.setItem(resolveStorageKey(STORAGE_KEY, namespace), JSON.stringify(items));
  } catch {
    /* ignore */
  }
};

export const loadFurniture = (namespace = "default"): FurnitureItem[] | null => {
  try {
    const raw = localStorage.getItem(resolveStorageKey(STORAGE_KEY, namespace));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0
      ? (parsed as FurnitureItem[])
      : null;
  } catch {
    return null;
  }
};

export const resolveInitialAgentPosition = (
  agentId: string,
  status: "idle" | "working" | "error",
  hasAssignedDesk: boolean,
  savedPositions: AgentOfficePositions,
  fallback: AgentOfficePosition,
): AgentOfficePosition =>
  status === "idle" && !hasAssignedDesk
    ? (savedPositions[agentId] ?? fallback)
    : fallback;

export const loadAgentPositions = (namespace = "default"): AgentOfficePositions => {
  try {
    const raw = localStorage.getItem(resolveStorageKey(AGENT_POSITIONS_STORAGE_KEY, namespace));
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed).filter(([id, position]) =>
        id.trim().length > 0 &&
        position !== null &&
        typeof position === "object" &&
        Number.isFinite((position as AgentOfficePosition).x) &&
        Number.isFinite((position as AgentOfficePosition).y),
      ),
    ) as AgentOfficePositions;
  } catch {
    return {};
  }
};

export const saveAgentPositions = (
  namespace: string,
  positions: AgentOfficePositions,
) => {
  try {
    const merged = loadAgentPositions(namespace);
    for (const [id, position] of Object.entries(positions)) {
      if (id.trim() && Number.isFinite(position?.x) && Number.isFinite(position?.y)) {
        merged[id] = { x: position.x, y: position.y };
      }
    }
    localStorage.setItem(resolveStorageKey(AGENT_POSITIONS_STORAGE_KEY, namespace), JSON.stringify(merged));
  } catch {
    /* ignore */
  }
};

export const hasAtmMigrationApplied = (namespace = "default") =>
  hasStorageFlag(ATM_MIGRATION_KEY, namespace);

export const markAtmMigrationApplied = (namespace = "default") => {
  markStorageFlag(ATM_MIGRATION_KEY, namespace);
};

export const hasServerRoomMigrationApplied = (namespace = "default") =>
  hasStorageFlag(SERVER_ROOM_MIGRATION_KEY, namespace);

export const markServerRoomMigrationApplied = (namespace = "default") => {
  markStorageFlag(SERVER_ROOM_MIGRATION_KEY, namespace);
};

export const hasQaLabMigrationApplied = (namespace = "default") =>
  hasStorageFlag(QA_LAB_MIGRATION_KEY, namespace);

export const markQaLabMigrationApplied = (namespace = "default") => {
  markStorageFlag(QA_LAB_MIGRATION_KEY, namespace);
};

export const hasPhoneBoothMigrationApplied = (namespace = "default") =>
  hasStorageFlag(PHONE_BOOTH_MIGRATION_KEY, namespace);

export const markPhoneBoothMigrationApplied = (namespace = "default") => {
  markStorageFlag(PHONE_BOOTH_MIGRATION_KEY, namespace);
};

export const hasSmsBoothMigrationApplied = (namespace = "default") =>
  hasStorageFlag(SMS_BOOTH_MIGRATION_KEY, namespace);

export const markSmsBoothMigrationApplied = (namespace = "default") => {
  markStorageFlag(SMS_BOOTH_MIGRATION_KEY, namespace);
};

export const hasBedroomMigrationApplied = (namespace = "default") =>
  hasStorageFlag(BEDROOM_MIGRATION_KEY, namespace);

export const markBedroomMigrationApplied = (namespace = "default") => {
  markStorageFlag(BEDROOM_MIGRATION_KEY, namespace);
};
