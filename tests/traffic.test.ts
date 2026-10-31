// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { Navigator, blocked, dist } from "../src/game/logic";
import {
  MeetingTraffic,
  type TrafficEvent,
  type TrafficInput,
} from "../src/game/traffic";
import type { Level, MeetingRoom, Point, Rect } from "../src/game/types";

const STEP = 1 / 60;
function room(overrides: Partial<MeetingRoom> = {}): MeetingRoom {
  return {
    id: "planning",
    name: "Planning Room",
    area: { x: 24, y: 24, w: 240, h: 372 },
    door: { x: 276, y: 204 },
    inside: { x: 108, y: 204 },
    hall: { x: 396, y: 204 },
    initialDelay: 1.8,
    interval: 5,
    crowd: 1,
    ...overrides,
  };
}
function level(
  rooms: MeetingRoom[] | undefined = [room()],
  furniture = false,
): Level {
  return {
    id: 1,
    name: "Traffic Test",
    subtitle: "",
    brief: "",
    tip: "",
    width: 640,
    height: 420,
    spawn: { x: 600, y: 380 },
    exit: { x: 600, y: 30, w: 24, h: 48 },
    walls: [
      { x: 0, y: 0, w: 640, h: 12 },
      { x: 0, y: 408, w: 640, h: 12 },
      { x: 0, y: 0, w: 12, h: 420 },
      { x: 628, y: 0, w: 12, h: 420 },
      { x: 264, y: 12, w: 24, h: 156 },
      { x: 264, y: 240, w: 24, h: 168 },
    ],
    props: furniture ? [{ kind: "table", x: 156, y: 144, w: 48, h: 120 }] : [],
    zones: [],
    items: [],
    interactions: [],
    gates: [],
    enemies: [],
    required: [],
    par: 60,
    event: "",
    rooms,
  };
}
function setup(source = level(), seed = "traffic-seed") {
  const traffic = new MeetingTraffic(source, seed);
  const obstacles: Rect[] = [
    ...source.walls,
    ...source.props,
    ...source.gates.filter((g) => !g.open),
  ];
  const input: TrafficInput = {
    player: { x: 600, y: 380 },
    hidden: false,
    protected: false,
    dashing: false,
    stunned: false,
    obstacles,
    nav: new Navigator(source.width, source.height, obstacles, 10),
  };
  return { traffic, input, source };
}
function advance(
  traffic: MeetingTraffic,
  input: TrafficInput,
  seconds: number,
  step = STEP,
) {
  const events: TrafficEvent[] = [];
  for (let left = seconds; left > 1e-7; left -= step)
    events.push(...traffic.update(Math.min(step, left), input));
  return events;
}
function reachCorridor(test: ReturnType<typeof setup>) {
  for (let i = 0; i < 900 && test.traffic.staff[0].phase !== "corridor"; i++)
    test.traffic.update(STEP, test.input);
  expect(test.traffic.staff[0].phase).toBe("corridor");
  return test.traffic.staff[0];
}
const snapshot = (traffic: MeetingTraffic) =>
  structuredClone({ staff: traffic.staff, doors: traffic.doors });

describe("meeting room initialization and authored warning", () => {
  it("is node-safe, allows a level without rooms, and ignores invalid elapsed time", () => {
    const test = setup(level(undefined));
    // Explicitly remove rooms: the default helper argument otherwise adds one.
    const empty = new MeetingTraffic(
      { ...test.source, rooms: undefined },
      "empty",
    );
    expect(empty.staff).toEqual([]);
    expect(empty.doors).toEqual([]);
    expect(empty.update(100, test.input)).toEqual([]);
    const before = snapshot(test.traffic);
    for (const dt of [0, -1, NaN, Infinity])
      expect(test.traffic.update(dt, test.input)).toEqual([]);
    expect(snapshot(test.traffic)).toEqual(before);
  });

  it("starts 1–2 attendees inside at distinct radius-11 legal offsets, even when the anchor is furniture", () => {
    const source = level(
      [room({ inside: { x: 180, y: 204 }, crowd: 2 })],
      true,
    );
    const test = setup(source);
    expect(test.traffic.staff).toHaveLength(2);
    for (const actor of test.traffic.staff) {
      expect(actor.phase).toBe("inside");
      expect(blocked(actor, 11, test.input.obstacles)).toBe(false);
      expect(actor.x).toBeGreaterThanOrEqual(35);
      expect(actor.x).toBeLessThanOrEqual(253);
      expect(actor.y).toBeGreaterThanOrEqual(35);
      expect(actor.y).toBeLessThanOrEqual(385);
      expect(actor.target).toBeNull();
      expect(actor.path).toEqual([]);
      expect(dist(actor, source.rooms![0].inside)).toBeLessThanOrEqual(144.001);
    }
    expect(
      dist(test.traffic.staff[0], test.traffic.staff[1]),
    ).toBeGreaterThanOrEqual(22);
  });

  it("caps every room at two, the entire office at six, and still exposes every door", () => {
    const rooms = Array.from({ length: 8 }, (_, i) =>
      room({ id: `room-${i}`, crowd: 20 }),
    );
    const test = setup(level(rooms));
    expect(test.traffic.staff).toHaveLength(6);
    expect(test.traffic.doors).toHaveLength(8);
    expect(new Set(test.traffic.staff.map((a) => a.id)).size).toBe(6);
    for (const r of rooms)
      expect(
        test.traffic.staff.filter((a) => a.roomId === r.id).length,
      ).toBeLessThanOrEqual(2);
  });

  it("never spawns illegally if an authored room has no free interior", () => {
    const source = level(
      [
        room({
          area: { x: 160, y: 150, w: 30, h: 30 },
          inside: { x: 175, y: 165 },
        }),
      ],
      true,
    );
    const test = setup(source);
    expect(test.traffic.staff).toEqual([]);
    expect(advance(test.traffic, test.input, 10)).toEqual([]);
    expect(test.traffic.doors[0].open).toBe(false);
  });

  it("emits one explicit MEETING ENDING warning about 0.9s before a physical burst", () => {
    const { traffic, input } = setup();
    const home = { ...traffic.staff[0] };
    expect(advance(traffic, input, 0.85)).toEqual([]);
    expect(traffic.doors[0]).toMatchObject({
      id: "planning",
      name: "Planning Room",
      x: 276,
      y: 204,
      warning: false,
      open: false,
    });
    const warnings = advance(traffic, input, 0.1);
    expect(warnings).toEqual([
      {
        type: "warning",
        title: "MEETING ENDING",
        text: expect.stringContaining("Planning Room"),
        point: { x: 276, y: 204 },
        roomId: "planning",
      },
    ]);
    expect(traffic.doors[0].warning).toBe(true);
    expect(traffic.doors[0].next).toBeCloseTo(0.85);
    expect(traffic.staff[0]).toMatchObject({
      x: home.x,
      y: home.y,
      phase: "inside",
    });
    expect(advance(traffic, input, 0.8)).toEqual([]);
    expect(traffic.staff[0].phase).toBe("inside");
    advance(traffic, input, 0.1);
    expect(traffic.doors[0]).toMatchObject({ warning: false, open: true });
    expect(traffic.staff[0].phase).toBe("leaving");
    expect(dist(traffic.staff[0], home)).toBeLessThan(8);
    expect(dist(traffic.staff[0], room().hall)).toBeGreaterThan(200);
  });

  it("provides the full warning grace even for an initialDelay authored as zero", () => {
    const { traffic, input } = setup(level([room({ initialDelay: 0 })]));
    const events = advance(traffic, input, 0.8);
    expect(events.map((e) => e.type)).toEqual(["warning"]);
    expect(traffic.staff[0].phase).toBe("inside");
    advance(traffic, input, 0.11);
    expect(traffic.staff[0].phase).toBe("leaving");
  });

  it("only exposes a traffic-light state; it never mutates walls, props, gates, or room anchors", () => {
    const source = level();
    const before = structuredClone(source);
    const { traffic, input } = setup(source);
    const obstaclesBefore = structuredClone(input.obstacles);
    advance(traffic, input, 30);
    expect(source).toEqual(before);
    expect(input.obstacles).toEqual(obstaclesBefore);
  });
});

describe("walkout, hall pause, and physical return lifecycle", () => {
  it("walks through the actual doorway both ways, detours furniture, stays bounded, and never teleports to the exit", () => {
    const { traffic, input, source } = setup(level([room()], true));
    const actor = traffic.staff[0];
    const home = { x: actor.x, y: actor.y };
    const phases = new Set<string>();
    let outwardDoor = false,
      inwardDoor = false,
      hall = false,
      wentAroundTable = false,
      returned = false;
    for (let i = 0; i < 1600; i++) {
      const previous = { x: actor.x, y: actor.y };
      traffic.update(STEP, input);
      phases.add(actor.phase);
      expect(dist(previous, actor)).toBeLessThanOrEqual(105 * STEP + 1e-5);
      expect(blocked(actor, 10, input.obstacles)).toBe(false);
      expect(actor.x).toBeGreaterThanOrEqual(10);
      expect(actor.x).toBeLessThanOrEqual(source.width - 10);
      expect(actor.y).toBeGreaterThanOrEqual(10);
      expect(actor.y).toBeLessThanOrEqual(source.height - 10);
      expect(dist(actor, source.exit)).toBeGreaterThan(100);
      if (actor.phase === "leaving" && dist(actor, room().door) < 3)
        outwardDoor = true;
      if (actor.phase === "returning" && dist(actor, room().door) < 3)
        inwardDoor = true;
      if (actor.phase === "corridor") {
        hall = true;
        expect(dist(actor, room().hall)).toBeLessThan(1e-5);
      }
      if (actor.y < 134 || actor.y > 274) wentAroundTable = true;
      if (hall && actor.phase === "inside") {
        returned = true;
        break;
      }
    }
    expect(phases).toEqual(
      new Set(["inside", "leaving", "corridor", "returning"]),
    );
    expect({
      outwardDoor,
      inwardDoor,
      hall,
      wentAroundTable,
      returned,
    }).toEqual({
      outwardDoor: true,
      inwardDoor: true,
      hall: true,
      wentAroundTable: true,
      returned: true,
    });
    expect(dist(actor, home)).toBeLessThan(1e-5);
    expect(traffic.doors[0]).toMatchObject({
      open: false,
      warning: false,
      next: 5,
    });
    const second = advance(traffic, input, 4.2);
    expect(second.filter((e) => e.type === "warning")).toHaveLength(1);
    expect(actor.phase).toBe("inside");
    advance(traffic, input, 0.9);
    expect(actor.phase).toBe("leaving");
  });

  it("staggers room members by roughly 0.3s while permitting simultaneous movement", () => {
    const { traffic, input } = setup(level([room({ crowd: 2 })]));
    advance(traffic, input, 1.9);
    expect(traffic.staff.map((a) => a.phase)).toEqual(["leaving", "inside"]);
    const first = { ...traffic.staff[0] },
      second = { ...traffic.staff[1] };
    advance(traffic, input, 0.3);
    expect(traffic.staff.map((a) => a.phase)).toEqual(["leaving", "leaving"]);
    expect(dist(traffic.staff[0], first)).toBeGreaterThan(20);
    expect(dist(traffic.staff[1], second)).toBeGreaterThan(0);
  });

  it("pauses in the hall for 3–5 seconds, then follows a real return target", () => {
    const test = setup();
    const actor = reachCorridor(test);
    const point = { x: actor.x, y: actor.y };
    for (let i = 0; i < 179; i++) {
      test.traffic.update(STEP, test.input);
      expect(actor.phase).toBe("corridor");
      expect(actor).toMatchObject(point);
    }
    let elapsed = 179 * STEP;
    while (actor.phase === "corridor" && elapsed < 5.1) {
      test.traffic.update(STEP, test.input);
      elapsed += STEP;
    }
    expect(elapsed).toBeGreaterThanOrEqual(3 - STEP);
    expect(elapsed).toBeLessThanOrEqual(5 + STEP);
    expect(actor.phase).toBe("returning");
    expect(actor.target).toEqual(room().door);
    expect(dist(actor, point)).toBeLessThanOrEqual(105 * STEP + 1e-5);
  });

  it("recomputes blocked return paths no more than once per second and never falls back to teleportation", () => {
    const test = setup();
    const actor = reachCorridor(test);
    const point = { x: actor.x, y: actor.y };
    const path = vi.spyOn(test.input.nav, "path").mockReturnValue([]);
    advance(test.traffic, test.input, 10);
    expect(actor.phase).toBe("returning");
    expect(actor).toMatchObject(point);
    expect(path.mock.calls.length).toBeGreaterThan(3);
    expect(path.mock.calls.length).toBeLessThanOrEqual(8);
    path.mockRestore();
    advance(test.traffic, test.input, 4);
    expect(actor.phase).toBe("inside");
  });

  it("does not tunnel through a newly blocked doorway on a long update", () => {
    const test = setup();
    test.input.obstacles.push({ x: 264, y: 168, w: 24, h: 72 });
    test.input.nav = new Navigator(640, 420, test.input.obstacles, 10);
    const events = test.traffic.update(12, test.input);
    expect(events.filter((e) => e.type === "warning")).toHaveLength(1);
    expect(test.traffic.staff[0].x).toBeLessThan(254);
    expect(test.traffic.staff[0].phase).toBe("leaving");
    expect(blocked(test.traffic.staff[0], 10, test.input.obstacles)).toBe(
      false,
    );
  });

  it("rejects out-of-bounds Navigator waypoints even without enclosing walls", () => {
    const test = setup({ ...level(), walls: [] });
    vi.spyOn(test.input.nav, "path").mockReturnValue([
      { x: 900, y: -100 },
      room().door,
    ]);
    const home = { ...test.traffic.staff[0] };
    advance(test.traffic, test.input, 4);
    expect(test.traffic.staff[0]).toMatchObject({ x: home.x, y: home.y });
    expect(test.traffic.staff[0].path).toEqual([]);
  });
});

describe("fair attendee detection and scene-only event contract", () => {
  it("does not detect from inside, including during the amber warning", () => {
    const test = setup();
    const actor = test.traffic.staff[0];
    test.input.player = { x: actor.x + 20, y: actor.y };
    const events = advance(test.traffic, test.input, 1.7);
    expect(events.map((e) => e.type)).toEqual(["warning"]);
    expect(actor.awareness).toBe(0);
    expect(actor.cooldown).toBe(0);
  });

  it("fills awareness over a fair ~1s and emits a single spot with a copied last-known player point", () => {
    const test = setup();
    const actor = reachCorridor(test);
    actor.angle = 0;
    test.input.player = { x: actor.x + 65, y: actor.y };
    expect(advance(test.traffic, test.input, 0.9)).toEqual([]);
    expect(actor.awareness).toBeCloseTo(0.9);
    const events = advance(test.traffic, test.input, 0.15);
    expect(events).toEqual([
      {
        type: "spot",
        title: "MEETING SPOTTED YOU",
        text: expect.stringContaining("Planning Room"),
        point: { ...test.input.player },
        staffId: actor.id,
        roomId: "planning",
      },
    ]);
    expect(events[0].point).not.toBe(test.input.player);
    expect(advance(test.traffic, test.input, 1.5)).toEqual([]);
  });

  it.each(["wall", "furniture"])(
    "does not see, face, or hit through a %s, even within body range",
    (kind) => {
      const test = setup();
      const actor = reachCorridor(test);
      actor.angle = Math.PI;
      test.input.player = { x: actor.x + 20, y: actor.y };
      test.input.obstacles.push({
        x: actor.x + 11,
        y: actor.y - 24,
        w: 3,
        h: 48,
        kind,
      });
      expect(advance(test.traffic, test.input, 2)).toEqual([]);
      expect(actor.awareness).toBe(0);
      expect(actor.angle).toBe(Math.PI);
    },
  );

  it.each([
    [-60, 0],
    [111, 0],
    [70, 90],
  ])("honors sight range and 1.8-radian FOV at offset (%s,%s)", (x, y) => {
    const test = setup();
    const actor = reachCorridor(test);
    actor.angle = 0;
    test.input.player = { x: actor.x + x, y: actor.y + y };
    expect(advance(test.traffic, test.input, 2)).toEqual([]);
    expect(actor.awareness).toBe(0);
  });

  it.each(["hidden", "protected"] as const)(
    "%s players neither build awareness nor take a previously primed hit",
    (safety) => {
      const test = setup();
      const actor = reachCorridor(test);
      test.input.player = { x: actor.x + 20, y: actor.y };
      actor.awareness = 1;
      test.input[safety] = true;
      expect(advance(test.traffic, test.input, 1)).toEqual([]);
      expect(actor.awareness).toBe(0);
      expect(actor.cooldown).toBe(0);
      test.input[safety] = false;
      expect(advance(test.traffic, test.input, 0.9)).toEqual([]);
      expect(actor.awareness).toBeLessThan(1);
    },
  );

  it("allows dash spotting but prevents damage; only an aware, undashed body within 28 can hit", () => {
    const test = setup();
    const actor = reachCorridor(test);
    test.input.player = { x: actor.x + 20, y: actor.y };
    test.input.dashing = true;
    expect(advance(test.traffic, test.input, 0.95)).toEqual([]);
    const events = advance(test.traffic, test.input, 0.2);
    expect(events.map((e) => e.type)).toEqual(["spot"]);
    expect(actor.cooldown).toBe(0);
    test.input.dashing = false;
    const hits = test.traffic.update(STEP, test.input);
    expect(hits).toEqual([
      {
        type: "hit",
        title: "MEETING COLLISION",
        text: expect.stringContaining("+10 BS"),
        point: { ...test.input.player },
        staffId: actor.id,
        roomId: "planning",
        damage: 10,
      },
    ]);
    expect(actor.cooldown).toBeCloseTo(6);
  });

  it("uses a strict <28 body range for damage after spotting", () => {
    const test = setup();
    const actor = reachCorridor(test);
    test.input.player = { x: actor.x + 28, y: actor.y };
    expect(advance(test.traffic, test.input, 1.1).map((e) => e.type)).toEqual([
      "spot",
    ]);
    test.input.player.x -= 0.01;
    expect(test.traffic.update(STEP, test.input).map((e) => e.type)).toEqual([
      "hit",
    ]);
  });

  it("enforces a six-second hit cooldown and suppresses repeated spots during one encounter", () => {
    const test = setup();
    const actor = reachCorridor(test);
    test.input.player = { x: actor.x + 20, y: actor.y };
    // A temporarily unavailable return route keeps this encounter observable.
    vi.spyOn(test.input.nav, "path").mockReturnValue([]);
    const first = advance(test.traffic, test.input, 1.05);
    expect(first.map((e) => e.type)).toEqual(["spot", "hit"]);
    expect(advance(test.traffic, test.input, 5.8)).toEqual([]);
    expect(advance(test.traffic, test.input, 0.3).map((e) => e.type)).toEqual([
      "hit",
    ]);
  });

  it("does not spam spots after brief LOS flicker; a separated encounter can spot again after cooldown", () => {
    const test = setup();
    const actor = reachCorridor(test);
    vi.spyOn(test.input.nav, "path").mockReturnValue([]);
    test.input.player = { x: actor.x + 60, y: actor.y };
    expect(advance(test.traffic, test.input, 1.1).map((e) => e.type)).toEqual([
      "spot",
    ]);
    test.input.hidden = true;
    advance(test.traffic, test.input, 0.2);
    test.input.hidden = false;
    expect(advance(test.traffic, test.input, 1.1)).toEqual([]);
    test.input.hidden = true;
    advance(test.traffic, test.input, 6.1);
    test.input.hidden = false;
    expect(advance(test.traffic, test.input, 1.1).map((e) => e.type)).toEqual([
      "spot",
    ]);
  });

  it("faces nearby bodies but only pauses 0.15s per approach, then resumes instead of becoming stuck", () => {
    const test = setup();
    advance(test.traffic, test.input, 1.9);
    const actor = test.traffic.staff[0];
    const point = { x: actor.x, y: actor.y };
    actor.angle = Math.PI;
    test.input.player = { x: actor.x + 20, y: actor.y };
    expect(advance(test.traffic, test.input, 0.1)).toEqual([]);
    expect(actor.angle).toBeCloseTo(0);
    expect(actor).toMatchObject(point);
    for (let i = 0; i < 60; i++) {
      test.input.player = { x: actor.x + 20, y: actor.y };
      test.traffic.update(STEP, test.input);
    }
    expect(dist(actor, point)).toBeGreaterThan(65);
    test.input.player = { x: 600, y: 380 };
    const previous = { ...actor };
    test.traffic.update(STEP, test.input);
    expect(dist(actor, previous)).toBeGreaterThan(0);
  });
});

describe("VPN freeze, coffee, and deterministic replay", () => {
  it("VPN freezes room warnings, movement, awareness, cooldowns, coffee, and private lifecycle timers", () => {
    const a = setup(level([room({ crowd: 2 })]));
    const b = setup(level([room({ crowd: 2 })]));
    advance(a.traffic, a.input, 2.3);
    advance(b.traffic, b.input, 2.3);
    a.traffic.distract(a.traffic.staff[0], 4);
    b.traffic.distract(b.traffic.staff[0], 4);
    a.traffic.staff[0].cooldown = b.traffic.staff[0].cooldown = 6;
    a.traffic.staff[0].awareness = b.traffic.staff[0].awareness = 0.6;
    const before = snapshot(a.traffic);
    a.input.stunned = true;
    expect(a.traffic.update(30, a.input)).toEqual([]);
    expect(snapshot(a.traffic)).toEqual(before);
    a.input.stunned = false;
    expect(advance(a.traffic, a.input, 15)).toEqual(
      advance(b.traffic, b.input, 15),
    );
    expect(snapshot(a.traffic)).toEqual(snapshot(b.traffic));
    const waiting = setup();
    waiting.input.stunned = true;
    expect(waiting.traffic.update(20, waiting.input)).toEqual([]);
    expect(waiting.traffic.doors[0].next).toBe(1.8);
    expect(waiting.traffic.doors[0].warning).toBe(false);
  });

  it("coffee picks at most two nearest within 220, reports actual recipients, and ignores already distracted staff", () => {
    const test = setup(
      level([room({ id: "a", crowd: 2 }), room({ id: "b", crowd: 2 })]),
    );
    const point: Point = { x: 100, y: 200 };
    test.traffic.staff.forEach((a, i) => {
      a.x = 100 + [220, 30, 10, 221][i];
      a.y = 200;
    });
    expect(test.traffic.distract(point, 4)).toBe(2);
    expect(test.traffic.staff.map((a) => a.distracted)).toEqual([0, 4, 4, 0]);
    expect(test.traffic.distract(point, 4)).toBe(1);
    expect(test.traffic.staff.map((a) => a.distracted)).toEqual([4, 4, 4, 0]);
    expect(test.traffic.distract(point, 4)).toBe(0);
    for (const duration of [0, -4, NaN, Infinity])
      expect(test.traffic.distract(point, duration)).toBe(0);
  });

  it("coffee pauses active actors for the supplied four seconds and clears detection without teleporting", () => {
    const test = setup();
    advance(test.traffic, test.input, 2.1);
    const actor = test.traffic.staff[0];
    const point = { x: actor.x, y: actor.y };
    actor.awareness = 0.95;
    test.input.player = { x: actor.x + 20, y: actor.y };
    expect(test.traffic.distract(point, 4)).toBe(1);
    expect(actor.awareness).toBe(0);
    expect(advance(test.traffic, test.input, 4)).toEqual([]);
    expect(actor).toMatchObject(point);
    expect(actor.distracted).toBeCloseTo(0);
    expect(actor.awareness).toBe(0);
    advance(test.traffic, test.input, 0.4);
    expect(dist(actor, point)).toBeGreaterThan(10);
    expect(actor.awareness).toBeLessThan(1);
  });

  it("replays identical events and snapshots for the same seed without ambient randomness or time", () => {
    const source = level(
      [room({ crowd: 2 }), room({ id: "retro", initialDelay: 3.2, crowd: 2 })],
      true,
    );
    const a = setup(source, "daily:2026-06-11");
    const b = setup(source, "daily:2026-06-11");
    const ambient = vi.spyOn(Math, "random").mockImplementation(() => {
      throw new Error("ambient RNG forbidden");
    });
    try {
      for (let i = 0; i < 1200; i++) {
        const dt = [STEP, 0.025, 0.01, 0.05][i % 4];
        if (i === 100 || i === 600) {
          expect(a.traffic.distract(a.traffic.staff[0], 4)).toBe(
            b.traffic.distract(b.traffic.staff[0], 4),
          );
        }
        expect(a.traffic.update(dt, a.input)).toEqual(
          b.traffic.update(dt, b.input),
        );
        expect(snapshot(a.traffic)).toEqual(snapshot(b.traffic));
      }
    } finally {
      ambient.mockRestore();
    }
    expect(snapshot(setup(source, "another-day").traffic)).not.toEqual(
      snapshot(setup(source, "daily:2026-06-11").traffic),
    );
  });

  it("substeps long updates without skipping an entire warning, walkout, or grace period", () => {
    const a = setup();
    const b = setup();
    const events = a.traffic.update(7, a.input);
    expect(events).toEqual(advance(b.traffic, b.input, 7));
    expect(a.traffic.staff[0].phase).toBe(b.traffic.staff[0].phase);
    expect(a.traffic.staff[0].x).toBeCloseTo(b.traffic.staff[0].x);
    expect(a.traffic.staff[0].y).toBeCloseTo(b.traffic.staff[0].y);
    expect(a.traffic.doors[0]).toEqual(b.traffic.doors[0]);
  });
});
