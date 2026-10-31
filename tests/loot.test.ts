import { describe, it, expect } from "vitest";
import {
  LOOT,
  LootBag,
  TheftAction,
  isStealable,
  carryMultiplier,
} from "../src/game/loot";
import type { Item } from "../src/game/types";
describe("optional loot and honest scoring", () => {
  it.each(Object.entries(LOOT))(
    "%s has meaningful points, legal timing and risk",
    (kind, def) => {
      expect(isStealable(kind as Item["kind"])).toBe(true);
      expect(def.points).toBeGreaterThan(0);
      expect(def.hold).toBeGreaterThanOrEqual(0);
      expect(def.hold).toBeLessThanOrEqual(2);
      expect(def.noise).toBeGreaterThanOrEqual(0);
      expect(def.weight).toBeGreaterThanOrEqual(0);
      expect(def.quip.length).toBeGreaterThan(10);
    },
  );
  it("gives real greater value/risk to a TV than snacks", () => {
    expect(LOOT.tv.points).toBeGreaterThan(LOOT.snacks.points * 4);
    expect(LOOT.tv.weight).toBeGreaterThan(0);
    expect(LOOT.tv.noise).toBeGreaterThan(200);
    expect(LOOT.snacks.bsRecovery).toBe(6);
    expect(LOOT.snacks.hold).toBe(0);
  });
  it("claims each object once, totals points/weight, and counts categories", () => {
    const b = new LootBag();
    expect(b.claim({ id: "tv1", kind: "tv", x: 20, y: 20 })?.points).toBe(800);
    expect(b.claim({ id: "tv1", kind: "tv", x: 20, y: 20 })).toBeNull();
    b.claim({ id: "snack1", kind: "snacks", x: 20, y: 20 });
    b.claim({ id: "laptop1", kind: "laptop", x: 20, y: 20 });
    expect(b.value).toBe(1200);
    expect(b.weight).toBe(4);
    expect(b.count).toBe(3);
    expect(b.hasTV).toBe(true);
    expect(b.countKind("snacks")).toBe(1);
  });
  it("does not count resources as stealable bag value", () => {
    const b = new LootBag();
    for (const kind of ["coffee", "wfh", "badge"] as const)
      expect(b.claim({ id: kind, kind, x: 0, y: 0 })).toBeNull();
    expect(b.value).toBe(0);
  });
  it.each([
    [-3, 1],
    [0, 1],
    [3, 0.91],
    [6, 0.82],
    [30, 0.82],
  ])("weight %s has bounded visible movement multiplier %s", (w, m) =>
    expect(carryMultiplier(w)).toBeCloseTo(m),
  );
  it("completes a held TV steal once, not before its timer", () => {
    const action = new TheftAction();
    action.start({ id: "tv", kind: "tv", x: 0, y: 0 });
    expect(
      action.tick(1, { holding: true, moving: false, inRange: true }),
    ).toBe("working");
    expect(action.progress).toBeCloseTo(0.625);
    expect(
      action.tick(0.6, { holding: true, moving: false, inRange: true }),
    ).toBe("complete");
    expect(action.id).toBeNull();
    expect(
      action.tick(10, { holding: true, moving: false, inRange: true }),
    ).toBe("idle");
  });
  it.each([
    { holding: false, moving: false, inRange: true },
    { holding: true, moving: true, inRange: true },
    { holding: true, moving: false, inRange: false },
  ])("cancels theft without reward for invalid intent %s", (input) => {
    const a = new TheftAction();
    a.start({ id: "tv", kind: "tv", x: 0, y: 0 });
    a.tick(0.8, { holding: true, moving: false, inRange: true });
    expect(a.tick(0.1, input)).toBe("cancelled");
    expect(a.id).toBeNull();
    expect(a.progress).toBe(0);
  });
  it("rejects a resource as a timed steal and tolerates invalid dt", () => {
    const a = new TheftAction();
    expect(a.start({ id: "coffee", kind: "coffee", x: 0, y: 0 })).toBe(false);
    a.start({ id: "k", kind: "keyboard", x: 0, y: 0 });
    expect(a.tick(NaN, { holding: true, moving: false, inRange: true })).toBe(
      "working",
    );
    expect(a.progress).toBe(0);
  });
});
