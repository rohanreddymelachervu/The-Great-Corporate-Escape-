// @vitest-environment node
import { describe, expect, it } from "vitest";
import { ABILITIES, ACHIEVEMENTS, ENEMIES, EVENTS } from "../src/game/catalog";
import { EscapeDirector, liftWait } from "../src/game/director";
import { LEVELS } from "../src/game/levels";
import { Navigator, blocked, center, dist, move } from "../src/game/logic";
import type {
  Kind,
  Level,
  LootKind,
  Point,
  Prop,
  Rect,
} from "../src/game/types";

const PLAYER_RADIUS = 11;
const NAV_RADIUS = 12; // Scene constructs Navigator with its default radius.
const ACTOR_RADIUS = 14; // Staff and room door/inside/hall targets need this margin.
const lootKinds: LootKind[] = [
  "tv",
  "snacks",
  "keyboard",
  "plant",
  "trophy",
  "coffee-machine",
];
const within = (point: Point, rect: Rect, inset = 0) =>
  point.x > rect.x + inset &&
  point.x < rect.x + rect.w - inset &&
  point.y > rect.y + inset &&
  point.y < rect.y + rect.h - inset;
const distanceToRect = (point: Point, rect: Rect) =>
  Math.hypot(
    Math.max(rect.x - point.x, 0, point.x - rect.x - rect.w),
    Math.max(rect.y - point.y, 0, point.y - rect.y - rect.h),
  );
// Regression fixtures are the original 1120×800 furniture footprints. None may
// be shrunk, made decorative/non-collidable, moved, or cut away for the annex.
const coreFurniture: [Prop["kind"], number, number, number, number][][] = [
  [
    ["desk", 80, 100, 180, 58],
    ["sofa", 80, 360, 160, 54],
    ["plant", 280, 460, 30, 30],
    ["board", 55, 530, 160, 24],
    ["desk", 440, 120, 180, 58],
    ["desk", 440, 340, 180, 58],
    ["coffee", 450, 630, 60, 44],
    ["sofa", 850, 560, 150, 50],
    ["shelf", 850, 160, 160, 40],
  ],
  [
    ["table", 210, 100, 160, 50],
    ["desk", 750, 100, 140, 55],
    ["plant", 1020, 200, 30, 30],
    ["table", 460, 350, 180, 40],
    ["balloons", 990, 350, 32, 50],
    ["desk", 420, 620, 180, 60],
    ["sofa", 80, 580, 100, 50],
    ["coffee", 650, 560, 50, 42],
  ],
  [
    ["desk", 90, 370, 90, 55],
    ["shelf", 70, 590, 100, 35],
    ["plant", 210, 700, 30, 30],
    ["desk", 380, 290, 180, 50],
    ["desk", 480, 410, 140, 50],
    ["desk", 850, 300, 150, 50],
    ["desk", 850, 450, 150, 50],
    ["table", 480, 80, 300, 55],
    ["coffee", 400, 650, 50, 40],
  ],
  [
    ["sofa", 80, 470, 130, 50],
    ["desk", 90, 230, 140, 60],
    ["board", 80, 70, 100, 24],
    ["desk", 880, 370, 130, 60],
    ["coffee", 880, 660, 60, 44],
    ["table", 450, 350, 220, 70],
    ["shelf", 450, 80, 60, 60],
    ["desk", 480, 630, 140, 40],
  ],
  [
    ["desk", 100, 200, 160, 55],
    ["desk", 470, 100, 150, 55],
    ["table", 470, 260, 150, 40],
    ["desk", 860, 150, 150, 55],
    ["sofa", 80, 580, 130, 55],
    ["server", 430, 580, 60, 70],
    ["desk", 570, 570, 120, 50],
    ["desk", 870, 580, 140, 50],
    ["coffee", 880, 680, 55, 35],
  ],
];
// Preserve the existing coffee refill, hiding, and optional Fun Friday locations
// used by controls/browser tests, including the late-floor alternative exits.
const coreInteractions: [string, number, number][][] = [
  [
    ["hide", 190, 450],
    ["filter", 550, 652],
    ["blocker", 300, 270],
    ["lift-switch", 650, 650],
    ["coat-hide", 1040, 240],
  ],
  [
    ["hide", 230, 580],
    ["filter", 610, 580],
    ["feedback", 400, 470],
    ["rumour", 980, 310],
    ["playlist-switch", 740, 400],
    ["fun-friday", 350, 600],
  ],
  [
    ["hide-nook", 210, 610],
    ["hide-desk", 1045, 500],
    ["filter", 365, 670],
    ["pizza", 620, 170],
    ["hot-take", 780, 600],
    ["mute-switch", 620, 700],
  ],
  [
    ["hide-reception", 250, 480],
    ["hide-stage", 725, 440],
    ["filter", 970, 680],
    ["investor", 570, 300],
    ["roadmap", 1040, 580],
    ["stream-switch", 980, 630],
    ["fun-friday", 250, 600],
  ],
  [
    ["hide-wellness", 250, 610],
    ["hide-server", 530, 600],
    ["filter", 975, 710],
    ["term-sheet", 810, 100],
    ["jira", 640, 440],
    ["appraisal", 100, 440],
    ["roadmap-switch", 650, 680],
    ["fun-friday", 280, 680],
  ],
];
const corePickups: [string, number, number][][] = [
  [
    ["badge", 220, 240],
    ["coffee-reception", 210, 650],
    ["laptop-onboarding", 130, 470],
    ["coffee-lift", 890, 430],
    ["laptop-admin", 980, 260],
  ],
  [
    ["badge", 200, 410],
    ["coffee-snacks", 250, 680],
    ["laptop-payroll", 680, 650],
    ["coffee-party", 990, 470],
    ["laptop-culture", 860, 190],
  ],
  [
    ["badge", 140, 110],
    ["coffee-intern", 130, 290],
    ["laptop-demo", 430, 375],
    ["coffee-overflow", 930, 640],
    ["laptop-controls", 580, 630],
  ],
  [
    ["badge", 170, 150],
    ["laptop-reception", 230, 600],
    ["coffee-boardroom", 420, 300],
    ["coffee-stream", 950, 560],
    ["laptop-scrum", 700, 740],
    ["wfh", 950, 170],
  ],
  [
    ["badge", 220, 100],
    ["coffee-wellness", 300, 580],
    ["laptop-build", 530, 190],
    ["coffee-founder", 820, 300],
    ["laptop-fire-exit", 1010, 680],
    ["wfh", 1000, 440],
  ],
];
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
  ...(level.rooms ?? []).flatMap((room) => [
    { id: `room ${room.id} door`, point: room.door },
    { id: `room ${room.id} inside`, point: room.inside },
    { id: `room ${room.id} hall`, point: room.hall },
  ]),
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
    // The annexes themselves must also differ, not merely inherit distinct cores.
    const annexLayouts = LEVELS.map((level) =>
      JSON.stringify({
        rooms: level.rooms!.map((room) => room.area),
        props: geometry(
          level.props.filter((prop) => prop.x >= 1120 || prop.y >= 800),
        ),
      }),
    );
    expect(new Set(annexLayouts).size).toBe(5);
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
        ...(level.rooms ?? []),
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
    const actorNav = new Navigator(
      level.width,
      level.height,
      obstacles,
      ACTOR_RADIUS,
    );

    it("is a doubled-area 1600×1120 office with a far-east main lift", () => {
      expect([level.width, level.height]).toEqual([1600, 1120]);
      expect(level.width * level.height).toBe(2 * 1120 * 800);
      expect(level.exit).toEqual({ x: 1490, y: 90, w: 80, h: 70 });
      if (level.id === 4)
        expect(level.altExit).toEqual({ x: 40, y: 680, w: 80, h: 60 });
      if (level.id === 5)
        expect(level.altExit).toEqual({ x: 1000, y: 670, w: 70, h: 70 });
    });

    it("keeps every original core prop collidable and all coffee/hide/activity points unchanged", () => {
      for (const [kind, x, y, w, h] of coreFurniture[level.id - 1]) {
        const footprint = { kind, x, y, w, h };
        expect(
          level.props,
          `original prop ${JSON.stringify(footprint)}`,
        ).toContainEqual(footprint);
        expect(blocked(center(footprint), ACTOR_RADIUS, obstacles)).toBe(true);
        expect(x).toBeGreaterThanOrEqual(24);
        expect(y).toBeGreaterThanOrEqual(24);
        expect(x + w).toBeLessThanOrEqual(1096);
        expect(y + h).toBeLessThanOrEqual(776);
      }
      for (const [suffix, x, y] of coreInteractions[level.id - 1])
        expect(
          level.interactions.find(
            (point) => point.id === `l${level.id}-${suffix}`,
          ),
        ).toMatchObject({ x, y });
      for (const [suffix, x, y] of corePickups[level.id - 1])
        expect(
          level.items.find((point) => point.id === `l${level.id}-${suffix}`),
        ).toMatchObject({ x, y });
      expect(level.items.filter((item) => item.kind === "coffee")).toHaveLength(
        3,
      );
      expect(level.items.filter((item) => item.kind === "laptop")).toHaveLength(
        2,
      );
    });

    it("adds nine optional steals across all six new kinds, with quiet snacks and a TV in every room/lounge", () => {
      const steals = level.items.filter((item) =>
        lootKinds.includes(item.kind as LootKind),
      );
      expect(steals.length).toBeGreaterThanOrEqual(6);
      expect(steals.length).toBeLessThanOrEqual(9);
      expect(steals).toHaveLength(9);
      expect(new Set(steals.map((item) => item.kind))).toEqual(
        new Set(lootKinds),
      );
      expect(
        steals.filter((item) => item.kind === "snacks").length,
      ).toBeGreaterThanOrEqual(2);
      expect(
        steals.filter((item) => item.kind === "snacks").length,
      ).toBeLessThanOrEqual(3);
      for (const item of level.items) {
        expect(["coffee", "laptop", "wfh", ...lootKinds]).toContain(item.kind);
        expect(level.required).not.toContain(item.id);
        expect(blocked(item, ACTOR_RADIUS, obstacles), item.id).toBe(false);
        // Rectangle distance (not just center distance) protects E's lift priority.
        expect(
          distanceToRect(item, level.exit),
          item.id,
        ).toBeGreaterThanOrEqual(85);
      }
      const lounge = level.zones.find((zone) =>
        zone.label.startsWith("QUIET LOUNGE"),
      )!;
      expect(lounge).toBeDefined();
      expect(
        level.zones.some((zone) => zone.label.startsWith("PANTRY ·")),
      ).toBe(true);
      expect(
        level.zones.some((zone) => zone.label.startsWith("SERVICE CORRIDOR")),
      ).toBe(true);
      for (const area of [lounge, ...level.rooms!.map((room) => room.area)])
        expect(
          steals.some((item) => item.kind === "tv" && within(item, area, 16)),
        ).toBe(true);
    });

    it("reaches every item with radius-14 swept clearance while all gates are closed", () => {
      for (const item of level.items) {
        const path = actorNav.path(level.spawn, item);
        expect(path.at(-1), item.id).toEqual(item);
        expect(
          clearanceErrors(level.spawn, path, obstacles, ACTOR_RADIUS),
          item.id,
        ).toEqual([]);
      }
    });

    it("connects core and annex in multiple directions without sealed old right/bottom borders", () => {
      const crossings = [
        [
          { x: 1060, y: 180 },
          { x: 1176, y: 180 },
        ],
        [
          { x: 1060, y: 440 },
          { x: 1176, y: 440 },
        ],
        [
          { x: 1060, y: 660 },
          { x: 1176, y: 660 },
        ],
        [
          { x: 240, y: 744 },
          { x: 240, y: 844 },
        ],
        [
          { x: 720, y: 744 },
          { x: 720, y: 812 },
        ],
      ];
      for (const [from, to] of crossings) {
        expect(clearanceErrors(from, [to], obstacles, ACTOR_RADIUS)).toEqual(
          [],
        );
        expect(actorNav.path(level.spawn, to).at(-1)).toEqual(to);
      }
      expect(
        level.walls.some(
          (wall) => wall.x === 1096 && wall.y === 24 && wall.h === 752,
        ),
      ).toBe(false);
      expect(
        level.walls.some(
          (wall) => wall.x === 0 && wall.y === 776 && wall.w === 1120,
        ),
      ).toBe(false);
      expect(
        level.enemies.some((enemy) =>
          enemy.route.some((point) => point.x > 1120),
        ),
      ).toBe(true);
    });

    it("has two timed meeting rooms with real enclosing walls and permanently open 120px doorways", () => {
      expect(level.rooms).toHaveLength(2);
      expect(new Set(level.rooms!.map((room) => room.name)).size).toBe(2);
      for (const room of level.rooms!) {
        expect(room.name.trim()).not.toBe("");
        expect(room.initialDelay).toBeGreaterThanOrEqual(4);
        expect(room.initialDelay).toBeLessThanOrEqual(9);
        expect(room.interval).toBeGreaterThanOrEqual(11);
        expect(room.interval).toBeLessThanOrEqual(17);
        expect([1, 2]).toContain(room.crowd);
        expect(within(room.inside, room.area, ACTOR_RADIUS)).toBe(true);
        expect(within(room.hall, room.area)).toBe(false);
        const { x, y, w, h } = room.area;
        const westDoor = room.door.x === x + 8;
        // Probe every side's wall centerline: only the marked 120px opening
        // is empty. Furniture/zones cannot stand in for actual room walls.
        const perimeter: Point[] = [];
        for (let dx = 8; dx < w; dx += 8)
          perimeter.push({ x: x + dx, y: y + 8 }, { x: x + dx, y: y + h - 8 });
        for (let dy = 8; dy < h; dy += 8)
          perimeter.push({ x: x + 8, y: y + dy }, { x: x + w - 8, y: y + dy });
        for (const point of perimeter) {
          const onDoorSide = westDoor
            ? point.x === room.door.x
            : point.y === room.door.y;
          const offset = westDoor
            ? Math.abs(point.y - room.door.y)
            : Math.abs(point.x - room.door.x);
          if (onDoorSide && Math.abs(offset - 60) <= 1) continue;
          expect(
            blocked(point, 1, level.walls),
            `${room.id} perimeter ${JSON.stringify(point)}`,
          ).toBe(!(onDoorSide && offset < 60));
        }
        for (let offset = -40; offset <= 40; offset += 8) {
          const point = westDoor
            ? { x: room.door.x, y: room.door.y + offset }
            : { x: room.door.x + offset, y: room.door.y };
          expect(
            blocked(point, ACTOR_RADIUS, obstacles),
            `${room.id} open doorway`,
          ).toBe(false);
        }
      }
    });

    it("connects every room's door, inside and hall at radius 14, in both directions with all gates closed", () => {
      for (const room of level.rooms!) {
        const pairs = [
          [level.spawn, room.hall],
          [room.hall, room.door],
          [room.door, room.inside],
          [room.inside, room.door],
          [room.door, room.hall],
          [room.hall, center(level.exit)],
        ];
        for (const point of [room.door, room.inside, room.hall]) {
          expectInWorld(point, level, room.id, ACTOR_RADIUS);
          expect(blocked(point, ACTOR_RADIUS, obstacles), room.id).toBe(false);
        }
        for (const [from, to] of pairs) {
          const path = actorNav.path(from, to);
          expect(
            path.at(-1),
            `${room.id} ${JSON.stringify(from)} -> ${JSON.stringify(to)}`,
          ).toEqual(to);
          expect(
            clearanceErrors(from, path, obstacles, ACTOR_RADIUS),
            room.id,
          ).toEqual([]);
        }
        // The emergency walkout is a direct physical step, not a pathfinder
        // teleport around a door that happens to be painted on a solid wall.
        expect(
          clearanceErrors(
            room.inside,
            [room.door, room.hall],
            obstacles,
            ACTOR_RADIUS,
          ),
          room.id,
        ).toEqual([]);
      }
    });

    it("has finite, positive in-bounds geometry and fully enclosed outer walls", () => {
      expect(level.width).toBeGreaterThan(0);
      expect(level.height).toBeGreaterThan(0);
      for (const rect of [
        ...level.walls,
        ...level.props,
        ...level.gates,
        ...level.zones,
        ...(level.rooms ?? []).map((room) => room.area),
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
            ...clearanceErrors(start, path, obstacles, ACTOR_RADIUS).map(
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
