// @vitest-environment node
import { describe, expect, it } from "vitest";
import { ABILITIES, ACHIEVEMENTS, ENEMIES, EVENTS } from "../src/game/catalog";
import { EscapeDirector, liftWait } from "../src/game/director";
import { LEVELS } from "../src/game/levels";
import { Navigator, blocked, center, dist, move } from "../src/game/logic";
import type { Kind, Level, Point, Rect } from "../src/game/types";

const PLAYER_RADIUS = 11;
const NAV_RADIUS = 12; // Scene constructs Navigator with its default radius.
const kinds: Kind[] = ["manager", "hr", "intern", "founder", "pm", "gossip"];
const closedObstacles = (level: Level): Rect[] => [
  ...level.walls,
  ...level.props,
  ...level.gates,
];
const targetPoints = (level: Level): { id: string; point: Point }[] => [
  ...level.items.map((item) => ({ id: `item ${item.id}`, point: item })),
  ...level.interactions.map((item) => ({
    id: `interaction ${item.id}`,
    point: item,
  })),
  { id: "main exit", point: center(level.exit) },
  ...(level.altExit ? [{ id: "WFH exit", point: center(level.altExit) }] : []),
];

function clearanceErrors(
  start: Point,
  path: Point[],
  obstacles: Rect[],
  radius: number,
): string[] {
  let from = start;
  const errors: string[] = [];
  for (const to of path) {
    // Sample all segments at <= .5px; radius checks include each endpoint.
    const steps = Math.max(1, Math.ceil(dist(from, to) * 2));
    for (let i = 0; i <= steps; i++) {
      const p = {
        x: from.x + ((to.x - from.x) * i) / steps,
        y: from.y + ((to.y - from.y) * i) / steps,
      };
      const obstacle = obstacles.find((rect) => blocked(p, radius, [rect]));
      if (obstacle) {
        errors.push(
          `edge ${JSON.stringify(from)} -> ${JSON.stringify(to)}: circle r=${radius} hits ${JSON.stringify(obstacle)} at ${JSON.stringify(p)}`,
        );
        break;
      }
    }
    from = to;
  }
  return errors;
}

function expectInWorld(
  p: Point,
  level: Level,
  label: string,
  radius = 0,
): void {
  expect(Number.isFinite(p.x) && Number.isFinite(p.y), label).toBe(true);
  expect(p.x, label).toBeGreaterThanOrEqual(radius);
  expect(p.y, label).toBeGreaterThanOrEqual(radius);
  expect(p.x, label).toBeLessThanOrEqual(level.width - radius);
  expect(p.y, label).toBeLessThanOrEqual(level.height - radius);
}

describe("five-floor campaign and difficulty/personality progression", () => {
  it("has exactly five sequential unique floor IDs and unique names", () => {
    expect(LEVELS.map((level) => level.id)).toEqual([1, 2, 3, 4, 5]);
    expect(new Set(LEVELS.map((level) => level.name)).size).toBe(5);
    expect(
      LEVELS.every(
        (level) =>
          level.name.trim() &&
          level.brief.trim() &&
          level.tip.trim() &&
          level.event.trim(),
      ),
    ).toBe(true);
  });
  it("has five distinct collision layouts, not just renamed floors or relocated collectibles", () => {
    // Ignore labels, IDs, colors, and rectangle ordering when comparing geometry.
    const geometry = (rects: Rect[]) =>
      rects.map(({ x, y, w, h }) => JSON.stringify([x, y, w, h])).sort();
    const layouts = LEVELS.map((level) =>
      JSON.stringify({
        width: level.width,
        height: level.height,
        walls: geometry(level.walls),
        props: geometry(level.props),
        gates: geometry(level.gates),
      }),
    );
    expect(new Set(layouts).size).toBe(5);
  });
  it("keeps real, optional Fun Friday stations on floors 2, 4, and 5", () => {
    expect(
      LEVELS.filter((level) =>
        level.interactions.some((interaction) => interaction.type === "fun"),
      ).map((level) => level.id),
    ).toEqual([2, 4, 5]);
    for (const level of LEVELS.filter((level) =>
      [2, 4, 5].includes(level.id),
    )) {
      const station = level.interactions.find(
        (interaction) => interaction.id === `l${level.id}-fun-friday`,
      );
      expect(station, `floor ${level.id} Fun Friday`).toMatchObject({
        type: "fun",
      });
      expect(level.required).not.toContain(station?.id);
      // The per-target tests below also require this station to be reachable
      // with every shortcut closed, like all other optional interactions.
    }
  });
  it("includes telegraphed HR photo interference in the first floor's lift wait", () => {
    const level = LEVELS[0];
    const director = new EscapeDirector(level, "first-floor-hr");
    director.callLift();
    const events = director.update(liftWait(level.id), {
      player: center(level.exit),
      dashing: false,
      hidden: false,
      shield: true, // Isolate authored encounter availability from health policy.
      vpn: false,
    });
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "notice", kind: "photo" }),
      ]),
    );
  });
  it("has globally unique pickup, interaction, and gate IDs, namespaced to their floor", () => {
    const ids: string[] = [];
    for (const level of LEVELS)
      for (const entity of [
        ...level.items,
        ...level.interactions,
        ...level.gates,
      ]) {
        expect(entity.id).toMatch(new RegExp(`^l${level.id}-`));
        ids.push(entity.id);
      }
    expect(new Set(ids).size).toBe(ids.length);
  });
  it("introduces both manager and HR on floor one, progressing to all six personalities", () => {
    expect(LEVELS.map((level) => level.enemies.length)).toEqual([
      2, 3, 4, 4, 6,
    ]);
    expect(LEVELS[0].enemies.map((enemy) => enemy.kind).sort()).toEqual([
      "hr",
      "manager",
    ]);
    expect(LEVELS[1].enemies.map((enemy) => enemy.kind).sort()).toEqual([
      "gossip",
      "hr",
      "manager",
    ]);
    expect(
      LEVELS[2].enemies.filter((enemy) => enemy.kind === "intern"),
    ).toHaveLength(2);
    expect(LEVELS[3].enemies.map((enemy) => enemy.kind)).toEqual(
      expect.arrayContaining(["founder", "pm"]),
    );
    expect(new Set(LEVELS[4].enemies.map((enemy) => enemy.kind))).toEqual(
      new Set(kinds),
    );
  });
  it("introduces founder and PM only in the late campaign and reserves WFH for floors 4–5", () => {
    expect(
      LEVELS.slice(0, 3).every((level) =>
        level.enemies.every((enemy) => !["founder", "pm"].includes(enemy.kind)),
      ),
    ).toBe(true);
    expect(LEVELS.map((level) => Boolean(level.altExit))).toEqual([
      false,
      false,
      false,
      true,
      true,
    ]);
    expect(
      LEVELS.map(
        (level) => level.items.filter((item) => item.kind === "wfh").length,
      ),
    ).toEqual([0, 0, 0, 1, 1]);
    expect(ABILITIES.wfh.level).toBe(4);
  });
  it("provides increasing positive par times", () => {
    const pars = LEVELS.map((level) => level.par);
    expect(pars.every((value) => Number.isFinite(value) && value > 0)).toBe(
      true,
    );
    expect(pars).toEqual([...pars].sort((a, b) => a - b));
    expect(new Set(pars).size).toBe(5);
  });
});

describe("catalog contracts used by every level", () => {
  it("defines six complete, mechanically distinct enemy personalities", () => {
    expect(Object.keys(ENEMIES).sort()).toEqual([...kinds].sort());
    expect(new Set(Object.values(ENEMIES).map((def) => def.title)).size).toBe(
      6,
    );
    expect(new Set(Object.values(ENEMIES).map((def) => def.color)).size).toBe(
      6,
    );
    expect(
      new Set(Object.values(ENEMIES).map((def) => def.weakness)).size,
    ).toBe(6);
    for (const def of Object.values(ENEMIES)) {
      expect(def.name.length).toBeGreaterThan(0);
      expect(def.title.length).toBeGreaterThan(0);
      expect(def.weakness.length).toBeGreaterThan(0);
      expect(def.speed).toBeGreaterThan(0);
      expect(def.range).toBeGreaterThan(0);
      expect(def.fov).toBeGreaterThan(0);
      expect(def.fov).toBeLessThanOrEqual(Math.PI * 2);
      expect(def.damage).toBeGreaterThan(0);
      expect(def.damage).toBeLessThanOrEqual(100);
      expect(def.quotes.length).toBeGreaterThanOrEqual(4);
      expect(new Set(def.quotes).size).toBe(def.quotes.length);
    }
    expect(ENEMIES.intern.speed).toBe(
      Math.max(...Object.values(ENEMIES).map((def) => def.speed)),
    );
    expect(ENEMIES.founder.damage).toBe(
      Math.max(...Object.values(ENEMIES).map((def) => def.damage)),
    );
    expect(ENEMIES.founder.range).toBe(
      Math.max(...Object.values(ENEMIES).map((def) => def.range)),
    );
    expect(ENEMIES.gossip.fov).toBe(
      Math.max(...Object.values(ENEMIES).map((def) => def.fov)),
    );
  });
  it("has unique, progressive ability hotkeys and valid durations/cooldowns", () => {
    const abilities = Object.values(ABILITIES);
    expect(abilities.map((ability) => ability.key)).toEqual([
      "1",
      "2",
      "3",
      "4",
      "5",
      "6",
    ]);
    expect(abilities.map((ability) => ability.level)).toEqual([
      1, 2, 3, 3, 4, 4,
    ]);
    for (const ability of abilities) {
      expect(ability.name && ability.short && ability.description).toBeTruthy();
      expect(ability.duration).toBeGreaterThan(0);
      expect(ability.cooldown).toBeGreaterThanOrEqual(0);
      expect(ability.level).toBeLessThanOrEqual(LEVELS.length);
    }
  });
  it("gives achievement IDs and event kinds unique stable identities", () => {
    expect(
      new Set(ACHIEVEMENTS.map((achievement) => achievement.id)).size,
    ).toBe(ACHIEVEMENTS.length);
    expect(
      ACHIEVEMENTS.every(
        (achievement) => achievement.id && achievement.name && achievement.text,
      ),
    ).toBe(true);
    expect(new Set(EVENTS.map((event) => event.type)).size).toBe(EVENTS.length);
    expect(EVENTS.every((event) => event.title && event.text)).toBe(true);
  });
});

for (const level of LEVELS) {
  describe(`floor ${level.id}: ${level.name}`, () => {
    // Gates are intentionally all included, regardless of a future transient open flag.
    const obstacles = closedObstacles(level);
    const nav = new Navigator(level.width, level.height, obstacles);

    it("has finite, positive in-bounds geometry and fully enclosed outer walls", () => {
      expect(level.width).toBeGreaterThan(0);
      expect(level.height).toBeGreaterThan(0);
      for (const rect of [
        ...level.walls,
        ...level.props,
        ...level.gates,
        ...level.zones,
        level.exit,
        ...(level.altExit ? [level.altExit] : []),
      ]) {
        expectInWorld(rect, level, JSON.stringify(rect));
        expect(Number.isFinite(rect.w) && rect.w > 0).toBe(true);
        expect(Number.isFinite(rect.h) && rect.h > 0).toBe(true);
        expect(rect.x + rect.w).toBeLessThanOrEqual(level.width);
        expect(rect.y + rect.h).toBeLessThanOrEqual(level.height);
      }
      for (let x = 0; x <= level.width; x += 8) {
        expect(blocked({ x, y: 0 }, PLAYER_RADIUS, level.walls)).toBe(true);
        expect(
          blocked({ x, y: level.height }, PLAYER_RADIUS, level.walls),
        ).toBe(true);
      }
      for (let y = 0; y <= level.height; y += 8) {
        expect(blocked({ x: 0, y }, PLAYER_RADIUS, level.walls)).toBe(true);
        expect(blocked({ x: level.width, y }, PLAYER_RADIUS, level.walls)).toBe(
          true,
        );
      }
    });

    it("has no mandatory fetch objectives or badge pickups", () => {
      expect(level.required).toEqual([]);
      expect(level.items.filter((item) => item.kind === "badge")).toEqual([]);
      expect(level.items.some((item) => item.kind === "coffee")).toBe(true);
    });

    it("keeps switches as optional sabotage and resolves every shortcut gate reference", () => {
      const switches = level.interactions.filter(
        (interaction) => interaction.type === "switch",
      );
      expect(switches.length).toBeGreaterThan(0);
      for (const interaction of switches) {
        expect(level.required).not.toContain(interaction.id);
        expect(interaction.hint, interaction.id).toMatch(/optional sabotage/i);
        expect(interaction.hint, interaction.id).not.toMatch(/required/i);
      }
      for (const interaction of level.interactions) {
        expect(interaction.label && interaction.hint).toBeTruthy();
        if (interaction.type === "switch") {
          expect(interaction.opens).toBeTruthy();
          expect(
            level.gates.filter((gate) => gate.id === interaction.opens),
          ).toHaveLength(1);
        }
        if (interaction.type === "distraction") {
          expect(interaction.target).toBeTruthy();
          expect(
            level.enemies.some((enemy) => enemy.kind === interaction.target),
            interaction.id,
          ).toBe(true);
        }
      }
      for (const gate of level.gates) {
        expect(
          level.interactions.some(
            (interaction) =>
              interaction.type === "switch" && interaction.opens === gate.id,
          ),
          gate.id,
        ).toBe(true);
      }
    });

    it("spawns the player clear of closed gates, props, walls, and immediate enemy contact", () => {
      expectInWorld(level.spawn, level, "player spawn", PLAYER_RADIUS);
      expect(blocked(level.spawn, NAV_RADIUS + 2, obstacles)).toBe(false);
      for (const enemy of level.enemies)
        expect(dist(level.spawn, enemy)).toBeGreaterThan(100);
    });

    it("places all enemy spawns and patrol points with clearance for physical and navigation radii", () => {
      for (const [index, enemy] of level.enemies.entries()) {
        expect(ENEMIES[enemy.kind], `enemy ${index}`).toBeDefined();
        expect(enemy.route.length).toBeGreaterThanOrEqual(2);
        expect(
          new Set(enemy.route.map((point) => `${point.x},${point.y}`)).size,
        ).toBe(enemy.route.length);
        for (const [pointIndex, point] of [enemy, ...enemy.route].entries()) {
          const label = `${enemy.kind} ${index}, spawn/patrol ${pointIndex}: ${JSON.stringify(point)}`;
          expectInWorld(point, level, label, PLAYER_RADIUS);
          expect(blocked(point, PLAYER_RADIUS, obstacles), label).toBe(false);
          expect(
            blocked(point, NAV_RADIUS + 2, obstacles),
            `${label}, navigation margin`,
          ).toBe(false);
        }
      }
    });

    it("places every pickup, interaction and exit center on clear navigable ground", () => {
      for (const target of targetPoints(level)) {
        expectInWorld(target.point, level, target.id, PLAYER_RADIUS);
        expect(blocked(target.point, PLAYER_RADIUS, obstacles), target.id).toBe(
          false,
        );
      }
    });

    for (const target of targetPoints(level)) {
      it(`reaches ${target.id} from spawn with ALL gates closed`, () => {
        const path = nav.path(level.spawn, target.point);
        expect(path.length, `${target.id} has no path`).toBeGreaterThan(0);
        expect(
          path.at(-1),
          `${target.id} must be the actual endpoint, not a nearby grid node`,
        ).toEqual(target.point);
        for (const waypoint of path)
          expectInWorld(waypoint, level, target.id, PLAYER_RADIUS);
      });
      it(`provides swept player clearance on the path to ${target.id}`, () => {
        const path = nav.path(level.spawn, target.point);
        expect(path.length).toBeGreaterThan(0);
        expect(
          clearanceErrors(level.spawn, path, obstacles, PLAYER_RADIUS),
        ).toEqual([]);
      });
    }

    it("reaches and calls the lift, then offers timed boarding without collecting items or using switches", () => {
      const lift = center(level.exit);
      const path = nav.path(level.spawn, lift);
      expect(
        path.length,
        "lift must be accessible with all gates closed",
      ).toBeGreaterThan(0);
      expect(path.at(-1)).toEqual(lift);
      expect(
        clearanceErrors(level.spawn, path, obstacles, PLAYER_RADIUS),
      ).toEqual([]);

      // Use the real, untouched level: no item removal, gate opening, required
      // checklist mutation, or expedite call is needed to start the lift clock.
      const director = new EscapeDirector(level, `floor-${level.id}-lift`);
      expect(director.phase).toBe("find-lift");
      expect(director.callLift()).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ type: "notice", title: "LIFT CALLED" }),
        ]),
      );
      expect(director.phase).toBe("waiting");
      expect(director.eta).toBe(liftWait(level.id));
      expect(director.eta).toBeGreaterThan(0);
      expect(director.expedited).toBe(false);
      const input = {
        player: lift,
        dashing: false,
        hidden: false,
        shield: true, // Test the map/director contract, not stationary survival.
        vpn: false,
      };
      const interference = director.update(0, input);
      expect(
        interference.some((event) => event.type === "notice" && event.kind),
      ).toBe(true);
      expect(director.phase).toBe("waiting");
      const arrival = director.update(liftWait(level.id), input);
      expect(arrival.filter((event) => event.type === "arrived")).toHaveLength(
        1,
      );
      expect(director.phase).toBe("boarding");
      expect(director.boardLeft).toBeGreaterThan(0);
      expect(director.expedited).toBe(false);
    });

    it("allows optional sabotage to shorten the wait rather than unlock the lift", () => {
      const director = new EscapeDirector(level, `floor-${level.id}-sabotage`);
      expect(director.expedite()).toBe(7);
      expect(director.phase).toBe("find-lift");
      director.callLift();
      expect(director.phase).toBe("waiting");
      expect(director.eta).toBe(liftWait(level.id) - 7);
      expect(director.expedite()).toBe(0);
    });

    it("navigates every cyclic patrol leg, not just patrol nodes, without wall clipping", () => {
      const errors: string[] = [];
      for (const [index, enemy] of level.enemies.entries()) {
        const starts = [enemy, ...enemy.route];
        const ends = [...enemy.route, enemy.route[0]];
        for (let leg = 0; leg < starts.length; leg++) {
          const start = starts[leg],
            end = ends[leg];
          const path = nav.path(start, end);
          if (!path.length || dist(path.at(-1)!, end) > 0.001)
            errors.push(`${enemy.kind} ${index} leg ${leg}: unreachable`);
          errors.push(
            ...clearanceErrors(start, path, obstacles, PLAYER_RADIUS).map(
              (error) => `${enemy.kind} ${index} leg ${leg}: ${error}`,
            ),
          );
        }
      }
      expect(errors).toEqual([]);
    });

    it("keeps a player enclosed under long movement steps toward all four boundaries", () => {
      for (const [dx, dy] of [
        [-5000, 0],
        [5000, 0],
        [0, -5000],
        [0, 5000],
      ]) {
        const end = move(level.spawn, dx, dy, PLAYER_RADIUS, obstacles);
        expectInWorld(end, level, `${dx},${dy}`, PLAYER_RADIUS);
        expect(blocked(end, PLAYER_RADIUS, obstacles)).toBe(false);
      }
    });
  });
}
