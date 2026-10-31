import type { Item, LootKind } from "./types";
export type Stealable = LootKind | "laptop";
export interface LootDefinition {
  name: string;
  points: number;
  hold: number;
  noise: number;
  weight: number;
  bsRecovery: number;
  stamina: number;
  quip: string;
}
export const LOOT: Record<Stealable, LootDefinition> = {
  tv: {
    name: "Office TV",
    points: 800,
    hold: 1.6,
    noise: 330,
    weight: 3,
    bsRecovery: 0,
    stamina: 0,
    quip: "The all-hands display has left the all-hands.",
  },
  snacks: {
    name: "Snack stash",
    points: 100,
    hold: 0,
    noise: 0,
    weight: 0,
    bsRecovery: 6,
    stamina: 15,
    quip: "Snack equity finally vested. −6 BS, +15 stamina.",
  },
  keyboard: {
    name: "Mechanical keyboard",
    points: 220,
    hold: 0.55,
    noise: 100,
    weight: 1,
    bsRecovery: 0,
    stamina: 0,
    quip: "The loudest developer in the room is now portable.",
  },
  plant: {
    name: "Desk plant",
    points: 160,
    hold: 0.65,
    noise: 50,
    weight: 1,
    bsRecovery: 0,
    stamina: 0,
    quip: "It also wanted a healthier work environment.",
  },
  trophy: {
    name: "Innovation trophy",
    points: 400,
    hold: 0.8,
    noise: 150,
    weight: 1,
    bsRecovery: 0,
    stamina: 0,
    quip: "Awarded for moving fast and taking things.",
  },
  "coffee-machine": {
    name: "Coffee machine",
    points: 650,
    hold: 1.4,
    noise: 280,
    weight: 3,
    bsRecovery: 0,
    stamina: 0,
    quip: "You have acquired the entire productivity stack.",
  },
  laptop: {
    name: "Abandoned laptop",
    points: 300,
    hold: 0.65,
    noise: 90,
    weight: 1,
    bsRecovery: 0,
    stamina: 0,
    quip: "The asset tracker says “emotionally missing”.",
  },
};
export function isStealable(kind: Item["kind"]): kind is Stealable {
  return Object.prototype.hasOwnProperty.call(LOOT, kind);
}
export function carryMultiplier(weight: number): number {
  return 1 - Math.min(0.18, Math.max(0, weight) * 0.03);
}
/** Run-local bag: points are only banked when the existing escape flow records a win. */
export class LootBag {
  readonly taken = new Map<string, Stealable>();
  value = 0;
  weight = 0;
  get count() {
    return this.taken.size;
  }
  claim(item: Item): LootDefinition | null {
    if (!isStealable(item.kind) || this.taken.has(item.id)) return null;
    const def = LOOT[item.kind];
    this.taken.set(item.id, item.kind);
    this.value += def.points;
    this.weight += def.weight;
    return def;
  }
  countKind(kind: Stealable) {
    return [...this.taken.values()].filter((k) => k === kind).length;
  }
  get hasTV() {
    return this.countKind("tv") > 0;
  }
}
/** Holding, range and stillness must remain valid; cancelling never awards an item. */
export class TheftAction {
  id: string | null = null;
  elapsed = 0;
  duration = 0;
  get progress() {
    return this.id ? Math.min(1, this.elapsed / (this.duration || 1)) : 0;
  }
  start(item: Item): boolean {
    if (!isStealable(item.kind)) return false;
    this.id = item.id;
    this.elapsed = 0;
    this.duration = LOOT[item.kind].hold;
    return true;
  }
  cancel() {
    this.id = null;
    this.elapsed = 0;
    this.duration = 0;
  }
  tick(
    dt: number,
    input: { holding: boolean; moving: boolean; inRange: boolean },
  ): "idle" | "working" | "cancelled" | "complete" {
    if (!this.id) return "idle";
    if (!input.holding || input.moving || !input.inRange) {
      this.cancel();
      return "cancelled";
    }
    this.elapsed += Number.isFinite(dt) ? Math.max(0, dt) : 0;
    if (this.elapsed >= this.duration) {
      this.cancel();
      return "complete";
    }
    return "working";
  }
}
