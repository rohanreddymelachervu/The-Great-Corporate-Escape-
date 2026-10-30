import { it, expect, vi, afterEach } from "vitest";
import { freshSave, record } from "../src/game/progression";
import type { Result } from "../src/game/types";
const result = (ruleset?: number): Result => ({
  level: 2,
  time: 48,
  bs: 20,
  spots: 2,
  hits: 1,
  collectibles: 1,
  distractions: 1,
  score: 9000,
  medal: "Silver",
  daily: false,
  seed: "2026-10-30",
  ruleset,
  dodges: 3,
});
afterEach(() => vi.unstubAllGlobals());
it("keeps old records and unlocks while separating scores for the redesigned ruleset", () => {
  vi.stubGlobal("localStorage", { setItem: vi.fn() });
  const save = freshSave();
  save.unlocked = 4;
  record(save, result(), ["ghost"]);
  record(save, result(2), ["dodge"]);
  expect(save.bests["2"].ruleset).toBeUndefined();
  expect(save.bests["v2-2"].ruleset).toBe(2);
  expect(save.unlocked).toBe(4);
  expect(save.achievements).toEqual(["ghost", "dodge"]);
});
it("separates daily records without changing the UTC challenge seed", () => {
  vi.stubGlobal("localStorage", { setItem: vi.fn() });
  const save = freshSave();
  record(save, { ...result(), daily: true }, []);
  record(save, { ...result(2), daily: true, score: 9500 }, []);
  expect(save.dailyBests["2026-10-30"]).toBe(9000);
  expect(save.dailyBests["v2:2026-10-30"]).toBe(9500);
});
