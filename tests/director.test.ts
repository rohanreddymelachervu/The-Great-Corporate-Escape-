import { describe, expect, it } from "vitest";
import {
  EscapeDirector,
  incidentContains,
  liftWait,
} from "../src/game/director";
import type {
  DirectorEvent,
  Incident,
  IncidentKind,
} from "../src/game/director";
import { LEVELS } from "../src/game/levels";
import type { Level, Point } from "../src/game/types";

const PLAYER = { x: 560, y: 400 };
const INPUT = {
  player: PLAYER,
  dashing: false,
  hidden: false,
  shield: false,
  vpn: false,
};
const kinds: IncidentKind[] = ["photo", "meeting", "yap", "paper", "allhands"];
const damage = { photo: 12, meeting: 16, yap: 8, paper: 10, allhands: 20 };
const warnings = {
  photo: 1.5,
  meeting: 1.5,
  yap: 1.3,
  paper: 1.3,
  allhands: 1.8,
};
const durations = { photo: 2.6, meeting: 4, yap: 4, paper: 3, allhands: 4 };
const radii = { photo: 0, meeting: 72, yap: 60, paper: 18, allhands: 105 };

function office(id = 1, overrides: Partial<Level> = {}): Level {
  return {
    ...LEVELS[id - 1],
    spawn: { ...PLAYER },
    walls: [],
    props: [],
    enemies: [],
    ...overrides,
  };
}

/** Stationary fixtures isolate collision policy from wave choreography. */
function hazard(
  kind: IncidentKind = "meeting",
  overrides: Partial<Incident> = {},
): Incident {
  return {
    id: `test-${kind}`,
    kind,
    shape: kind === "photo" ? "beam" : kind === "paper" ? "paper" : "circle",
    x: PLAYER.x,
    y: PLAYER.y,
    w: kind === "photo" ? 20 : radii[kind] * 2,
    h: kind === "photo" ? 200 : radii[kind] * 2,
    radius: radii[kind],
    from: { ...PLAYER },
    to: { ...PLAYER },
    age: 0,
    warn: warnings[kind],
    life: warnings[kind] + durations[kind],
    hit: false,
    dodged: false,
    ...overrides,
  };
}

function hits(events: DirectorEvent[]): DirectorEvent[] {
  return events.filter((event) => event.type === "hit");
}
function dodges(events: DirectorEvent[]): DirectorEvent[] {
  return events.filter((event) => event.type === "dodge");
}

function collectWaves(
  id: number,
  seed = "authored-waves",
  player = PLAYER,
  count = 12,
) {
  const director = new EscapeDirector(office(id), seed);
  director.callLift();
  director.eta = 9999;
  const waves: { incident: Incident; time: number }[] = [];
  const events: DirectorEvent[] = [];
  const seen = new Set<string>();
  for (let frame = 0; waves.length < count && frame < 2000; frame++) {
    events.push(
      ...director.update(frame === 0 ? 0 : 0.05, {
        ...INPUT,
        player,
        shield: true,
      }),
    );
    expect(director.incidents.length).toBeLessThanOrEqual(4);
    for (const incident of director.incidents) {
      if (!seen.has(incident.id)) {
        seen.add(incident.id);
        waves.push({
          incident: structuredClone(incident),
          time: director.elapsed,
        });
      }
    }
  }
  expect(waves).toHaveLength(count);
  return { director, waves, events };
}

function firstWave(kind: IncidentKind, id = 5, player = PLAYER) {
  for (let n = 0; n < 100; n++) {
    const director = new EscapeDirector(office(id), `opening-${n}`);
    director.callLift();
    director.update(0, { ...INPUT, player });
    if (director.incidents[0].kind === kind) return director;
  }
  throw new Error(`No opening ${kind} found`);
}

describe("elevator survival clock", () => {
  it("exports the five authored waits and well-defined out-of-range fallbacks", () => {
    expect([1, 2, 3, 4, 5].map(liftWait)).toEqual([20, 26, 30, 34, 38]);
    expect(liftWait(-5)).toBe(20);
    expect(liftWait(99)).toBe(38);
    expect(liftWait(NaN)).toBe(20);
  });

  it("starts completely idle, then calls once with an HR last-known-position rally", () => {
    const director = new EscapeDirector(office(), "call");
    expect(director).toMatchObject({
      phase: "find-lift",
      elapsed: 0,
      eta: 0,
      boardLeft: 0,
      incidents: [],
      dodges: 0,
      hits: 0,
      expedited: false,
    });
    const player = { x: 700, y: 250 };
    director.update(1, { ...INPUT, player });
    const events = director.callLift();
    expect(events.map((event) => event.type)).toEqual(["notice", "rally"]);
    expect(events[1]).toMatchObject({ who: "hr", point: player });
    expect(events[1].text).toMatch(/badge ping.*last known position/i);
    player.x = 800;
    expect(events[1].point?.x).toBe(700);
    expect(director.phase).toBe("waiting");
    expect(director.eta).toBe(20);
    expect(director.callLift()).toEqual([]);
    director.update(1, { ...INPUT, vpn: true });
    expect(director.callLift()).toEqual([]);
    expect(director.eta).toBeCloseTo(19);
  });

  it.each([1, 2, 3, 4, 5])(
    "stores a one-use seven-second credit before calling floor %i",
    (id) => {
      const director = new EscapeDirector(office(id), "early-credit");
      expect(director.expedite()).toBe(7);
      expect(director.expedited).toBe(true);
      expect(director.expedite()).toBe(0);
      expect(director.eta).toBe(0);
      director.callLift();
      expect(director.eta).toBe(liftWait(id) - 7);
      expect(director.expedite()).toBe(0);
    },
  );

  it("cuts a running wait once, but never below six seconds", () => {
    const director = new EscapeDirector(office(), "late-credit");
    director.callLift();
    director.update(12, { ...INPUT, vpn: true });
    expect(director.expedite()).toBeCloseTo(2);
    expect(director.eta).toBeCloseTo(6);
    expect(director.expedite()).toBe(0);
    director.update(6, { ...INPUT, vpn: true });
    expect(director.phase).toBe("boarding");
  });

  it("does not lengthen an already-short wait or reuse a zero-cut credit", () => {
    const director = new EscapeDirector(office(), "too-late");
    director.callLift();
    director.update(17, { ...INPUT, vpn: true });
    expect(director.expedite()).toBe(0);
    expect(director.eta).toBeCloseTo(3);
    expect(director.expedited).toBe(true);
  });

  it("cuts the full seven seconds when enough wait remains", () => {
    const director = new EscapeDirector(office(5), "full-credit");
    director.callLift();
    expect(director.expedite()).toBe(7);
    expect(director.eta).toBe(31);
  });

  it("arrives, offers ten seconds, then leaves with a fresh fourteen-second chance", () => {
    const director = new EscapeDirector(office(), "round-trip");
    director.callLift();
    const arrival = director.update(20, { ...INPUT, vpn: true });
    expect(arrival.filter((event) => event.type === "arrived")).toHaveLength(1);
    expect(director).toMatchObject({
      phase: "boarding",
      eta: 0,
      boardLeft: 10,
    });
    expect(director.callLift()).toEqual([]);
    const departure = director.update(10, { ...INPUT, vpn: true });
    expect(departure.map((event) => event.type)).toEqual(["left", "rally"]);
    expect(departure[1]).toMatchObject({ who: "hr", point: PLAYER });
    expect(director).toMatchObject({ phase: "waiting", eta: 14, boardLeft: 0 });
    expect(
      director
        .update(14, { ...INPUT, vpn: true })
        .filter((event) => event.type === "arrived"),
    ).toHaveLength(1);
    expect(director.phase).toBe("boarding");
    expect(director.elapsed).toBeCloseTo(44);
  });

  it("carries oversized dt through multiple phases rather than skipping the boarding cycle", () => {
    const director = new EscapeDirector(office(), "long-frame");
    director.callLift();
    const events = director.update(44, { ...INPUT, vpn: true });
    expect(events.filter((event) => event.type === "arrived")).toHaveLength(2);
    expect(events.filter((event) => event.type === "left")).toHaveLength(1);
    expect(director.phase).toBe("boarding");
    expect(director.boardLeft).toBeCloseTo(10);
    director.update(13, { ...INPUT, vpn: true });
    expect(director.phase).toBe("waiting");
    expect(director.eta).toBeCloseTo(11);
  });

  it("does not expedite boarding, and consumes at most one use", () => {
    const director = new EscapeDirector(office(), "boarding-credit");
    director.callLift();
    director.update(20, { ...INPUT, vpn: true });
    expect(director.expedite()).toBe(0);
    expect(director.boardLeft).toBe(10);
    director.update(10, { ...INPUT, vpn: true });
    expect(director.expedite()).toBe(0);
    expect(director.eta).toBe(14);
  });

  it("ignores negative and nonfinite dt without poisoning the model", () => {
    const director = new EscapeDirector(office(), "invalid-dt");
    director.callLift();
    for (const dt of [-1, NaN, Infinity, -Infinity])
      expect(director.update(dt, INPUT)).toEqual([]);
    expect(director.elapsed).toBe(0);
    expect(director.eta).toBe(20);
    expect(director.incidents).toEqual([]);
  });
});

describe("authored, seeded corporate waves", () => {
  it.each([2, 3])(
    "starts floor %i pressure six seconds into finding the lift",
    (id) => {
      const director = new EscapeDirector(office(id), "early-pressure");
      expect(director.update(5.99, INPUT)).toEqual([]);
      expect(director.incidents).toHaveLength(0);
      const events = director.update(0.01, INPUT);
      expect(
        events.some((event) => event.type === "notice" && event.kind),
      ).toBe(true);
      expect(director.incidents).toHaveLength(1);
      expect(director.incidents[0].age).toBeCloseTo(0);
      expect(hits(events)).toEqual([]);
      expect(director.phase).toBe("find-lift");
      expect(director.eta).toBe(0);
    },
  );

  it.each([1, 4, 5])(
    "keeps floor %i's opening traversal quiet until the lift call",
    (id) => {
      const director = new EscapeDirector(office(id), "quiet-traversal");
      director.update(12, INPUT);
      expect(director.incidents).toEqual([]);
      expect(director.phase).toBe("find-lift");
    },
  );

  it("starts a telegraphed wave immediately after calling, at the next input position", () => {
    const director = new EscapeDirector(office(), "immediate");
    director.callLift();
    const player = { x: 800, y: 500 };
    const events = director.update(0, { ...INPUT, player });
    expect(director.incidents).toHaveLength(1);
    expect(director.incidents[0]).toMatchObject({
      age: 0,
      hit: false,
      dodged: false,
    });
    expect(director.incidents[0].from.y).toBe(player.y);
    expect(
      events.filter((event) => event.type === "notice" && event.kind),
    ).toHaveLength(1);
    expect(hits(events)).toEqual([]);
    expect(dodges(events)).toEqual([]);
  });

  it("replays identical seeds/inputs exactly, with genuinely seed-dependent choreography", () => {
    const a = collectWaves(5, "same-seed");
    const b = collectWaves(5, "same-seed");
    expect(a.waves).toEqual(b.waves);
    expect(a.events).toEqual(b.events);
    expect(a.director.incidents).toEqual(b.director.incidents);
    expect(collectWaves(5, "different-seed").waves).not.toEqual(a.waves);
    expect(new Set(a.waves.map(({ incident }) => incident.id)).size).toBe(12);
  });

  it.each([
    [1, ["photo", "meeting"]],
    [2, ["photo", "paper", "meeting"]],
    [3, ["yap", "photo", "paper"]],
    [4, ["meeting", "allhands", "paper"]],
    [5, ["photo", "meeting", "yap", "paper", "allhands"]],
  ] as const)(
    "floor %i rotates every allowed kind at a four-to-six-second cadence",
    (id, allowed) => {
      const { waves } = collectWaves(id);
      expect(new Set(waves.map(({ incident }) => incident.kind))).toEqual(
        new Set(allowed),
      );
      for (let index = 1; index < waves.length; index++) {
        const gap = waves[index].time - waves[index - 1].time;
        expect(gap).toBeGreaterThanOrEqual(3.95);
        expect(gap).toBeLessThanOrEqual(6.05);
        expect(waves[index].incident.kind).not.toBe(
          waves[index - 1].incident.kind,
        );
      }
    },
  );

  it("emits eight-second last-known-position snapshots, not a moving chase target", () => {
    const director = new EscapeDirector(office(3), "rallies");
    director.callLift();
    const a = { x: 600, y: 300 };
    const first = director
      .update(8, { ...INPUT, player: a, shield: true })
      .filter((event) => event.type === "rally");
    expect(first).toHaveLength(1);
    expect(first[0]).toMatchObject({ who: "intern", point: a });
    expect(first[0].text).toMatch(/badge ping.*last known position/i);
    a.x = 900;
    const second = director
      .update(8, { ...INPUT, player: a, shield: true })
      .filter((event) => event.type === "rally");
    expect(second).toHaveLength(1);
    expect(first[0].point).toEqual({ x: 600, y: 300 });
    expect(second[0].point).toEqual({ x: 900, y: 300 });
  });

  it("all-hands also rallies the founder when one exists", () => {
    const level = office(4, { enemies: LEVELS[3].enemies });
    const director = new EscapeDirector(level, "founder-rally");
    director.callLift();
    director.eta = 999;
    const events: DirectorEvent[] = [];
    for (let n = 0; n < 120; n++)
      events.push(...director.update(0.1, { ...INPUT, shield: true }));
    const allhands = events.findIndex((event) => event.kind === "allhands");
    expect(allhands).toBeGreaterThanOrEqual(0);
    expect(events[allhands + 1]).toMatchObject({
      type: "rally",
      who: "founder",
      point: PLAYER,
    });
  });

  it("never exceeds four live incidents, including warnings", () => {
    const director = new EscapeDirector(office(5), "cap");
    director.incidents = [0, 1, 2, 3].map((n) =>
      hazard("meeting", { id: `existing-${n}`, life: 100 }),
    );
    director.callLift();
    director.eta = 999;
    const events = director.update(20, { ...INPUT, shield: true });
    expect(director.incidents).toHaveLength(4);
    expect(
      events.filter((event) => event.kind && event.type === "notice"),
    ).toEqual([]);
  });

  it("pauses new waves and rally clocks during boarding, then resumes telegraphed pressure", () => {
    const director = new EscapeDirector(office(5), "boarding-waves");
    director.callLift();
    director.update(38, { ...INPUT, shield: true });
    const quiet = director.update(9.9, { ...INPUT, shield: true });
    expect(
      quiet.filter(
        (event) => event.type === "notice" || event.type === "rally",
      ),
    ).toEqual([]);
    const resumed = director.update(0.1, { ...INPUT, shield: true });
    expect(resumed.some((event) => event.type === "left")).toBe(true);
    expect(resumed.some((event) => event.type === "notice" && event.kind)).toBe(
      true,
    );
    expect(
      director.incidents.every((incident) => incident.age < incident.warn),
    ).toBe(true);
  });
});

describe("honest geometry and readable warnings", () => {
  it.each(kinds)(
    "generates the authored %s dimensions, lifetime, and source/counterplay copy",
    (kind) => {
      const director = firstWave(kind);
      const incident = director.incidents[0];
      expect(incident.warn).toBe(warnings[kind]);
      expect(incident.warn).toBeGreaterThanOrEqual(1.15);
      expect(incident.life).toBe(warnings[kind] + durations[kind]);
      expect(incident.radius).toBe(radii[kind]);
      expect(incident.x).toBe(incident.from.x);
      expect(incident.y).toBe(incident.from.y);
      if (kind === "photo") {
        expect(incident).toMatchObject({ shape: "beam", w: 20, h: 200 });
        expect(incident.from).toEqual({ x: PLAYER.x - 150, y: PLAYER.y });
        expect(incident.to).toEqual({ x: PLAYER.x + 150, y: PLAYER.y });
        expect(incidentContains(incident, PLAYER)).toBe(false);
      } else if (kind === "paper") {
        expect(incident.shape).toBe("paper");
        expect(incident.from.x).toBeLessThan(PLAYER.x);
        expect(incident.to.x).toBeGreaterThan(PLAYER.x);
        expect(incident.from.y).not.toBe(incident.to.y);
      } else {
        expect(incident.shape).toBe("circle");
        expect(incident.from).toEqual(PLAYER);
        expect(incident.to).toEqual(PLAYER);
      }
      const notice = collectWaves(5).events.find(
        (event) => event.type === "notice" && event.kind === kind,
      );
      expect(notice?.title).toBeTruthy();
      expect(notice?.text).toMatch(/SPACE|step|leave/i);
      expect(notice?.text.match(/\./g)).toHaveLength(2);
    },
  );

  it("keeps moving hazards parked during warning, then actually sweeps through the target", () => {
    for (const kind of ["photo", "paper"] as const) {
      const director = firstWave(kind);
      const incident = director.incidents[0];
      director.update(incident.warn - 0.01, INPUT);
      expect(incident.x).toBe(incident.from.x);
      expect(incident.y).toBe(incident.from.y);
      expect(director.hits).toBe(0);
      const events = director.update(durations[kind] / 2 + 0.01, INPUT);
      expect(incident.x).toBeCloseTo(PLAYER.x);
      expect(incident.y).toBeCloseTo(PLAYER.y);
      expect(hits(events).some((event) => event.kind === kind)).toBe(true);
    }
  });

  it("does not arm a photo inside an edge player when the far side is available", () => {
    const player = { x: 12, y: 400 };
    const director = firstWave("photo", 1, player);
    const incident = director.incidents[0];
    expect(incident.from.x).toBeGreaterThan(player.x + 21);
    director.update(incident.warn, { ...INPUT, player });
    expect(incidentContains(incident, player)).toBe(false);
    expect(director.hits).toBe(0);
    expect(hits(director.update(2.6, { ...INPUT, player }))).toHaveLength(1);
  });

  it("paper still crosses the original lane near an edge instead of clamping it into a miss", () => {
    const player = { x: 35, y: 400 };
    const director = firstWave("paper", 3, player);
    const incident = director.incidents[0];
    const events = director.update(incident.life, { ...INPUT, player });
    expect(hits(events).some((event) => event.kind === "paper")).toBe(true);
  });

  it("all spawned centers and endpoints stay finite and inside every real office", () => {
    for (const id of [1, 2, 3, 4, 5]) {
      for (const player of [
        { x: 0, y: 0 },
        { x: LEVELS[id - 1].width, y: LEVELS[id - 1].height },
        { x: -99, y: Infinity },
      ]) {
        const { waves } = collectWaves(id, "edge-bounds", player, 5);
        for (const { incident } of waves) {
          for (const point of [incident, incident.from, incident.to]) {
            expect(Number.isFinite(point.x) && Number.isFinite(point.y)).toBe(
              true,
            );
            expect(point.x).toBeGreaterThanOrEqual(0);
            expect(point.x).toBeLessThanOrEqual(LEVELS[id - 1].width);
            expect(point.y).toBeGreaterThanOrEqual(0);
            expect(point.y).toBeLessThanOrEqual(LEVELS[id - 1].height);
          }
        }
      }
    }
  });

  it("uses a centered beam rect and the actual player circle, not a top-left rect or oversized ring", () => {
    const beam = hazard("photo");
    expect(incidentContains(beam, { x: PLAYER.x + 20.9, y: PLAYER.y })).toBe(
      true,
    );
    expect(incidentContains(beam, { x: PLAYER.x + 21, y: PLAYER.y })).toBe(
      false,
    );
    expect(incidentContains(beam, { x: PLAYER.x, y: PLAYER.y + 110.9 })).toBe(
      true,
    );
    expect(incidentContains(beam, { x: PLAYER.x, y: PLAYER.y + 111 })).toBe(
      false,
    );
    expect(
      incidentContains(beam, { x: PLAYER.x + 20, y: PLAYER.y + 110 }),
    ).toBe(false);
  });

  it("uses each circle/paper radius plus the player radius; containment itself has no age gate", () => {
    for (const kind of ["meeting", "yap", "paper", "allhands"] as const) {
      const incident = hazard(kind);
      expect(incident.age).toBe(0);
      expect(incidentContains(incident, PLAYER)).toBe(true);
      expect(
        incidentContains(incident, {
          x: PLAYER.x + radii[kind] + 10.9,
          y: PLAYER.y,
        }),
      ).toBe(true);
      expect(
        incidentContains(incident, {
          x: PLAYER.x + radii[kind] + 11,
          y: PLAYER.y,
        }),
      ).toBe(false);
    }
  });
});

describe("collision policy and real dodge counterplay", () => {
  it.each(kinds)(
    "%s cannot hit during warning, hits for its exact damage once when active",
    (kind) => {
      const director = new EscapeDirector(office(), "damage");
      const incident = hazard(kind);
      director.incidents.push(incident);
      expect(hits(director.update(incident.warn - 0.001, INPUT))).toEqual([]);
      expect(director.hits).toBe(0);
      expect(hits(director.update(0.001, INPUT))).toMatchObject([
        { kind, damage: damage[kind] },
      ]);
      expect(incident.hit).toBe(true);
      for (let n = 0; n < 30; n++)
        expect(hits(director.update(0.01, INPUT))).toEqual([]);
      expect(director.hits).toBe(1);
      expect(director.dodges).toBe(0);
      director.update(10, INPUT);
      expect(director.incidents).toEqual([]);
    },
  );

  it("a large update cannot skip an entire warning, active attack, and expiration", () => {
    const director = firstWave("photo", 1);
    const events = director.update(4.2, INPUT);
    expect(hits(events)).toMatchObject([{ kind: "photo", damage: 12 }]);
    expect(director.incidents).toEqual([]);
  });

  it("awards exactly one dodge for an actual active dash intersection", () => {
    const director = new EscapeDirector(office(), "real-dash");
    const incident = hazard();
    director.incidents.push(incident);
    const events = director.update(2, { ...INPUT, dashing: true });
    expect(hits(events)).toEqual([]);
    expect(dodges(events)).toHaveLength(1);
    expect(incident.dodged).toBe(true);
    expect(director.dodges).toBe(1);
    expect(dodges(director.update(1, { ...INPUT, dashing: true }))).toEqual([]);
    expect(director.hits).toBe(0);
  });

  it("a dash does not confer fake lifetime immunity if it ends inside an active circle", () => {
    const director = new EscapeDirector(office(), "dash-ends");
    director.incidents.push(hazard());
    director.update(1.5, { ...INPUT, dashing: true });
    expect(director.dodges).toBe(1);
    expect(hits(director.update(0.1, INPUT))).toHaveLength(1);
    expect(director.hits).toBe(1);
    expect(dodges(director.update(0.1, { ...INPUT, dashing: true }))).toEqual(
      [],
    );
  });

  it("warning-time dashes and near misses do not earn dodge credit", () => {
    const director = new EscapeDirector(office(), "fake-dash");
    director.incidents.push(hazard());
    director.update(1.49, { ...INPUT, dashing: true });
    expect(director.dodges).toBe(0);
    director.update(0.2, {
      ...INPUT,
      player: { x: PLAYER.x + 84, y: PLAYER.y },
      dashing: true,
    });
    expect(director.dodges).toBe(0);
    expect(director.hits).toBe(0);
    expect(hits(director.update(0.1, INPUT))).toHaveLength(1);
  });

  it("escaping a target circle before activation avoids damage without inventing a dodge", () => {
    const director = new EscapeDirector(office(), "step-away");
    director.incidents.push(hazard("meeting"));
    director.update(1, INPUT);
    const safe = { ...INPUT, player: { x: PLAYER.x + 150, y: PLAYER.y } };
    expect(hits(director.update(4.5, safe))).toEqual([]);
    expect(director.hits).toBe(0);
    expect(director.dodges).toBe(0);
  });

  it.each(["hidden", "shield"] as const)(
    "%s prevents damage without granting dodge credit",
    (protection) => {
      const director = new EscapeDirector(office(), protection);
      const incident = hazard();
      director.incidents.push(incident);
      const events = director.update(2, { ...INPUT, [protection]: true });
      expect(hits(events)).toEqual([]);
      expect(dodges(events)).toEqual([]);
      expect(incident.hit).toBe(false);
      expect(incident.dodged).toBe(false);
      expect(hits(director.update(0.1, INPUT))).toHaveLength(1);
    },
  );

  it("hiding is not a dash, even with the dash flag also set", () => {
    const director = new EscapeDirector(office(), "hidden-dash");
    director.incidents.push(hazard());
    director.update(2, { ...INPUT, hidden: true, dashing: true });
    expect(director.dodges).toBe(0);
    expect(director.hits).toBe(0);
  });

  it("a real dash can earn credit while shielded, but the shield alone cannot", () => {
    const director = new EscapeDirector(office(), "shielded-dash");
    director.incidents.push(hazard());
    expect(
      dodges(director.update(2, { ...INPUT, shield: true, dashing: true })),
    ).toHaveLength(1);
    expect(director.hits).toBe(0);
  });

  it("keeps independent once-only bookkeeping for simultaneous incidents", () => {
    const director = new EscapeDirector(office(), "simultaneous");
    director.incidents = [hazard("meeting"), hazard("yap")];
    expect(hits(director.update(2, INPUT))).toHaveLength(2);
    expect(director.hits).toBe(2);
    expect(hits(director.update(1, INPUT))).toEqual([]);
  });

  it.each(["walls", "props"] as const)(
    "%s block hazard damage and dodge credit through line of sight",
    (obstacle) => {
      const barrier = { x: 565, y: 350, w: 8, h: 100 };
      const level = office(
        1,
        obstacle === "walls"
          ? { walls: [barrier] }
          : { props: [{ ...barrier, kind: "desk" }] },
      );
      const director = new EscapeDirector(level, "occlusion");
      director.incidents.push(hazard());
      const covered = { ...INPUT, player: { x: 580, y: 400 } };
      expect(hits(director.update(2, covered))).toEqual([]);
      expect(
        dodges(director.update(0.1, { ...covered, dashing: true })),
      ).toEqual([]);
      expect(director.hits).toBe(0);
      expect(director.dodges).toBe(0);
      expect(hits(director.update(0.1, INPUT))).toHaveLength(1);
    },
  );

  it("uses occlusion for beams too, while gates may be ignored by the model", () => {
    const barrier = { x: 565, y: 350, w: 8, h: 100 };
    const covered = { ...INPUT, player: { x: 580, y: 400 } };
    const blocked = new EscapeDirector(
      office(1, { walls: [barrier] }),
      "beam-wall",
    );
    blocked.incidents.push(hazard("photo"));
    expect(hits(blocked.update(2, covered))).toEqual([]);
    const gate = new EscapeDirector(
      office(1, {
        gates: [{ ...barrier, id: "gate", label: "Shortcut" }],
      }),
      "beam-gate",
    );
    gate.incidents.push(hazard("photo"));
    expect(hits(gate.update(2, covered))).toHaveLength(1);
  });

  it("matches the same clock/wave outcome for coarse and fine updates", () => {
    const coarse = new EscapeDirector(office(5), "partitioning");
    const fine = new EscapeDirector(office(5), "partitioning");
    coarse.callLift();
    fine.callLift();
    coarse.update(13, INPUT);
    for (let n = 0; n < 130; n++) fine.update(0.1, INPUT);
    expect(coarse.phase).toBe(fine.phase);
    expect(coarse.eta).toBeCloseTo(fine.eta);
    expect(coarse.hits).toBe(fine.hits);
    expect(coarse.incidents.map((incident) => incident.id)).toEqual(
      fine.incidents.map((incident) => incident.id),
    );
    for (let n = 0; n < coarse.incidents.length; n++) {
      expect(coarse.incidents[n].age).toBeCloseTo(fine.incidents[n].age);
      expect(coarse.incidents[n].x).toBeCloseTo(fine.incidents[n].x);
      expect(coarse.incidents[n].y).toBeCloseTo(fine.incidents[n].y);
    }
  });
});

describe("VPN rising-edge cancellation, not a frozen lift", () => {
  it("clears both live and warning hazards once per activation while the wait continues", () => {
    const director = new EscapeDirector(office(5), "vpn");
    director.callLift();
    director.incidents.push(hazard("meeting", { age: 2 }), hazard("photo"));
    const events = director.update(3, { ...INPUT, vpn: true });
    expect(events.filter((event) => event.type === "notice")).toMatchObject([
      { title: "VPN: OFF THE GRID" },
    ]);
    expect(director.incidents).toEqual([]);
    expect(director.eta).toBeCloseTo(35);
    const held = director.update(8, { ...INPUT, vpn: true });
    expect(held.filter((event) => event.type === "notice")).toEqual([]);
    expect(director.incidents).toEqual([]);
    expect(director.eta).toBeCloseTo(27);
    expect(director.elapsed).toBeCloseTo(11);
    expect(director.hits).toBe(0);
    expect(director.dodges).toBe(0);
  });

  it("resumes with one warned wave, never a backlog, and can notice a later activation again", () => {
    const director = new EscapeDirector(office(5), "vpn-release");
    director.callLift();
    director.update(15, { ...INPUT, vpn: true });
    const resumed = director.update(0, INPUT);
    expect(
      resumed.filter((event) => event.kind && event.type === "notice"),
    ).toHaveLength(1);
    expect(director.incidents).toHaveLength(1);
    expect(director.incidents[0].age).toBe(0);
    expect(hits(resumed)).toEqual([]);
    const again = director.update(0, { ...INPUT, vpn: true });
    expect(again).toMatchObject([
      { type: "notice", title: "VPN: OFF THE GRID" },
    ]);
    expect(director.incidents).toEqual([]);
    expect(director.eta).toBeCloseTo(23);
  });

  it("can suppress the early HR/intern wave without delaying the six-second trigger", () => {
    const director = new EscapeDirector(office(2), "vpn-opening");
    director.update(8, { ...INPUT, vpn: true });
    expect(director.incidents).toEqual([]);
    director.update(0, INPUT);
    expect(director.incidents).toHaveLength(1);
    expect(director.incidents[0].age).toBe(0);
    expect(director.elapsed).toBeCloseTo(8);
  });
});
