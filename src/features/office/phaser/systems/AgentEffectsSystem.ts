import type Phaser from "phaser";

import type { OfficeAgentPresence } from "@/lib/office/presence";
import type { OfficeMap } from "@/lib/office/schema";

type AgentEffectsSystemParams = {
  scene: Phaser.Scene;
};

type AvatarState = {
  sprite: Phaser.GameObjects.Arc;
  label: Phaser.GameObjects.Text;
  stateIcon: Phaser.GameObjects.Text;
  thoughtIcon: Phaser.GameObjects.Text;
  vx: number;
  vy: number;
  lastThoughtAt: number;
};

const THOUGHTS = ["coffee", "gamepad", "zzz", "idea", "music"] as const;

const stateColor = (state: OfficeAgentPresence["state"]) => {
  if (state === "working") return 0x47c773;
  if (state === "meeting") return 0x58c6ff;
  if (state === "error") return 0xff6e6e;
  return 0xe8d58a;
};

const thoughtFromSeed = (seed: number) => THOUGHTS[Math.abs(seed) % THOUGHTS.length] ?? "idea";

const hash = (value: string) => {
  let h = 0;
  for (let index = 0; index < value.length; index += 1) {
    h = (h * 33 + value.charCodeAt(index)) >>> 0;
  }
  return h;
};

export class AgentEffectsSystem {
  private readonly scene: Phaser.Scene;
  private readonly avatars = new Map<string, AvatarState>();

  constructor(params: AgentEffectsSystemParams) {
    this.scene = params.scene;
  }

  update(params: {
    map: OfficeMap;
    agents: OfficeAgentPresence[];
    elapsedMs: number;
    thoughtBubblesEnabled: boolean;
  }) {
    const keep = new Set<string>();
    const zonesByType = new Map(
      params.map.zones.map((zone) => [zone.type, zone])
    );

    for (const agent of params.agents) {
      keep.add(agent.agentId);
      const entry = this.getOrCreate(agent.agentId, agent.name, agent.state, agent.x, agent.y);
      entry.sprite.fillColor = stateColor(agent.state);
      entry.stateIcon.setText(agent.state === "error" ? "!" : "");

      const target = (agent.x !== undefined && agent.y !== undefined)
        ? { x: agent.x, y: agent.y }
        : this.resolveTarget(agent.state, zonesByType);

      // Smoothly interpolate towards target (server (x, y) or zone fallback)
      this.stepTowards(entry, target.x, target.y, params.elapsedMs);

      entry.label.setPosition(entry.sprite.x, entry.sprite.y + 15);
      entry.stateIcon.setPosition(entry.sprite.x + 12, entry.sprite.y - 12);
      entry.thoughtIcon.setPosition(entry.sprite.x, entry.sprite.y - 20);

      if (
        params.thoughtBubblesEnabled &&
        agent.state === "idle" &&
        params.elapsedMs + entry.lastThoughtAt > 7_000
      ) {
        const now = this.scene.time.now;
        if (now - entry.lastThoughtAt > 7000) {
          const seed = hash(`${agent.agentId}:${Math.floor(now / 2000)}`);
          if (seed % 7 === 0) {
            entry.lastThoughtAt = now;
            entry.thoughtIcon.setAlpha(0.9);
            entry.thoughtIcon.setText(thoughtFromSeed(seed));
          }
        }
      }
      if (entry.thoughtIcon.alpha > 0) {
        entry.thoughtIcon.setAlpha(Math.max(0, entry.thoughtIcon.alpha - 0.0075 * params.elapsedMs));
      }
    }

    for (const [agentId, entry] of this.avatars) {
      if (keep.has(agentId)) continue;
      entry.sprite.destroy();
      entry.label.destroy();
      entry.stateIcon.destroy();
      entry.thoughtIcon.destroy();
      this.avatars.delete(agentId);
    }
  }

  destroy() {
    for (const entry of this.avatars.values()) {
      entry.sprite.destroy();
      entry.label.destroy();
      entry.stateIcon.destroy();
      entry.thoughtIcon.destroy();
    }
    this.avatars.clear();
  }

  /**
   * Smoothly interpolate agent sprite towards target (x, y) coordinates.
   */
  private stepTowards(entry: AvatarState, targetX: number, targetY: number, elapsedMs: number): void {
    const dx = targetX - entry.sprite.x;
    const dy = targetY - entry.sprite.y;
    const dist = Math.hypot(dx, dy);
    const maxSpeed = 0.08 * elapsedMs;

    if (dist <= maxSpeed) {
      entry.sprite.x = targetX;
      entry.sprite.y = targetY;
    } else {
      const step = Math.min(maxSpeed, dist);
      entry.sprite.x += (dx / dist) * step;
      entry.sprite.y += (dy / dist) * step;
    }
  }

  private getOrCreate(
    agentId: string,
    name: string,
    state: OfficeAgentPresence["state"],
    initialX?: number,
    initialY?: number
  ) {
    const existing = this.avatars.get(agentId);
    if (existing) {
      existing.label.setText(name);
      return existing;
    }
    const startX = initialX ?? 80;
    const startY = initialY ?? 80;
    const sprite = this.scene.add.circle(startX, startY, 8, stateColor(state));
    sprite.setDepth(8_500);
    const label = this.scene.add.text(startX, startY + 15, name, {
      fontFamily: "var(--font-mono)",
      fontSize: "10px",
      color: "#d7e7ff",
    });
    label.setDepth(8_500);
    label.setOrigin(0.5, 0);
    const stateIcon = this.scene.add.text(startX + 12, startY - 12, "", {
      fontFamily: "var(--font-mono)",
      fontSize: "12px",
      color: "#ff7171",
    });
    stateIcon.setDepth(9_000);
    stateIcon.setOrigin(0.5, 0.5);
    const thoughtIcon = this.scene.add.text(startX, startY - 20, "", {
      fontFamily: "var(--font-mono)",
      fontSize: "10px",
      color: "#f4e8bb",
      backgroundColor: "rgba(20,30,40,0.55)",
      padding: { left: 4, right: 4, top: 2, bottom: 2 },
    });
    thoughtIcon.setDepth(9_000);
    thoughtIcon.setOrigin(0.5, 0.5);
    thoughtIcon.setAlpha(0);
    const created: AvatarState = {
      sprite,
      label,
      stateIcon,
      thoughtIcon,
      vx: 0,
      vy: 0,
      lastThoughtAt: this.scene.time.now,
    };
    this.avatars.set(agentId, created);
    return created;
  }

  private resolveTarget(
    state: OfficeAgentPresence["state"],
    zonesByType: Map<string, OfficeMap["zones"][number]>
  ) {
    const fallback = { x: 120, y: 120 };
    const pickFrom = (zoneType: string) => {
      const zone = zonesByType.get(zoneType);
      if (!zone || zone.shape.points.length === 0) return fallback;
      const point = zone.shape.points[0];
      return { x: point.x, y: point.y };
    };
    if (state === "working") return pickFrom("desk_zone");
    if (state === "meeting") return pickFrom("meeting_room");
    if (state === "error") return pickFrom("desk_zone");
    return pickFrom("hallway");
  }
}
