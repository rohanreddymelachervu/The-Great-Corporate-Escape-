import { describe, it, expect, vi } from "vitest";
import { OfficeEnemy, type EnemyContext } from "../src/game/enemy";
import { Navigator, dist, rng } from "../src/game/logic";
import { ENEMIES } from "../src/game/catalog";
import type { Kind } from "../src/game/types";
function fakeObject(): any {
  const obj: any = {};
  for (const m of [
    "setScale",
    "setDepth",
    "setOrigin",
    "setVisible",
    "setText",
    "setColor",
    "setPosition",
    "setFlipX",
    "setAlpha",
  ])
    obj[m] = () => obj;
  return obj;
}
function setup(kind: Kind = "manager") {
  const scene: any = { add: { image: fakeObject, text: fakeObject } },
    enemy = new OfficeEnemy(
      scene,
      {
        kind,
        x: 100,
        y: 100,
        route: [
          { x: 500, y: 100 },
          { x: 100, y: 100 },
        ],
      },
      rng(5),
    );
  enemy.angle = 0;
  const context: EnemyContext = {
    dt: 1 / 60,
    time: 0,
    player: { x: 180, y: 100 },
    hidden: false,
    camouflaged: false,
    sprinting: false,
    quiet: false,
    call: false,
    calendar: false,
    stunned: false,
    alertBoost: false,
    obstacles: [],
    nav: new Navigator(1120, 800, []),
    random: rng(6),
    spot: vi.fn(),
    catch: vi.fn(),
    broadcast: vi.fn(),
    bluff: vi.fn(),
  };
  return { enemy, context };
}
function tick(e: OfficeEnemy, c: EnemyContext, n: number) {
  for (let i = 0; i < n; i++) {
    c.time += c.dt;
    e.update(c);
  }
}
describe("enemy finite-state machine", () => {
  it("gives a readable detection grace period before a chase", () => {
    const { enemy: e, context: c } = setup();
    e.idle = 10;
    tick(e, c, 50);
    expect(e.awareness).toBeGreaterThan(0.5);
    expect(c.spot).not.toHaveBeenCalled();
    tick(e, c, 40);
    expect(c.spot).toHaveBeenCalledTimes(1);
    expect(e.state).toBe("chase");
  });
  it("does not see through walls", () => {
    const { enemy: e, context: c } = setup();
    e.idle = 20;
    c.obstacles = [{ x: 130, y: 40, w: 20, h: 160 }];
    c.nav = new Navigator(1120, 800, c.obstacles);
    tick(e, c, 180);
    expect(e.awareness).toBe(0);
    expect(c.spot).not.toHaveBeenCalled();
  });
  it("hidden employees break pursuit, trigger searching, then return to patrol", () => {
    const { enemy: e, context: c } = setup();
    e.state = "chase";
    e.stateTime = 3;
    e.lastSeen = { ...c.player };
    c.hidden = true;
    tick(e, c, 1);
    expect(e.state).toBe("search");
    tick(e, c, 250);
    expect(e.state).toBe("patrol");
    expect(c.catch).not.toHaveBeenCalled();
  });
  it("hears nearby sprinting and investigates, unless masked by production noise", () => {
    const a = setup();
    a.context.sprinting = true;
    tick(a.enemy, a.context, 1);
    expect(a.enemy.state).toBe("investigate");
    const b = setup();
    b.context.sprinting = true;
    b.context.quiet = true;
    tick(b.enemy, b.context, 1);
    expect(b.enemy.state).toBe("patrol");
  });
  it.each<Kind>(["manager", "hr", "pm", "gossip"])(
    "fake calls protect against %s",
    (kind) => {
      const { enemy: e, context: c } = setup(kind);
      c.player = { x: 140, y: 100 };
      c.call = true;
      e.idle = 10;
      tick(e, c, 180);
      expect(c.spot).not.toHaveBeenCalled();
      expect(c.catch).not.toHaveBeenCalled();
      expect(c.bluff).toHaveBeenCalledTimes(1);
    },
  );
  it.each<Kind>(["intern", "founder"])(
    "%s ignores fake client calls",
    (kind) => {
      const { enemy: e, context: c } = setup(kind);
      e.idle = 10;
      c.call = true;
      tick(e, c, 150);
      expect(c.spot).toHaveBeenCalled();
    },
  );
  it("calendar blocks catches without erasing suspicion", () => {
    const { enemy: e, context: c } = setup();
    e.state = "chase";
    e.stateTime = 8;
    c.player = { x: 120, y: 100 };
    c.calendar = true;
    tick(e, c, 60);
    expect(c.catch).not.toHaveBeenCalled();
    expect(e.state).toBe("chase");
    c.calendar = false;
    tick(e, c, 1);
    expect(c.catch).toHaveBeenCalled();
  });
  it("stationary camouflage bluffs while moving cancellation is handled by the scene", () => {
    const { enemy: e, context: c } = setup();
    e.idle = 5;
    c.player = { x: 130, y: 100 };
    c.camouflaged = true;
    tick(e, c, 120);
    expect(c.bluff).toHaveBeenCalledTimes(1);
    expect(c.spot).not.toHaveBeenCalled();
  });
  it("VPN stun freezes movement and detection", () => {
    const { enemy: e, context: c } = setup();
    const start = { x: e.x, y: e.y };
    c.stunned = true;
    tick(e, c, 180);
    expect({ x: e.x, y: e.y }).toEqual(start);
    expect(e.awareness).toBe(0);
    expect(c.catch).not.toHaveBeenCalled();
  });
  it("a gossip sighting broadcasts the location exactly when pursuit starts", () => {
    const { enemy: e, context: c } = setup("gossip");
    e.idle = 10;
    tick(e, c, 100);
    expect(c.broadcast).toHaveBeenCalledTimes(1);
    expect(c.broadcast).toHaveBeenCalledWith(c.player);
  });
  it("distractions genuinely override pursuit, suppress sight, and expire", () => {
    const { enemy: e, context: c } = setup();
    e.state = "chase";
    e.awareness = 1;
    e.investigate({ x: 400, y: 150 }, 2, true);
    expect(e.state).toBe("distracted");
    expect(e.awareness).toBe(0);
    tick(e, c, 90);
    expect(c.spot).not.toHaveBeenCalled();
    tick(e, c, 40);
    expect(e.state).not.toBe("distracted");
  });
  it("catching deals the personality-specific damage through the callback and gives a cooldown", () => {
    const { enemy: e, context: c } = setup("founder");
    e.state = "chase";
    e.stateTime = 4;
    c.player = { x: 115, y: 100 };
    tick(e, c, 1);
    expect(c.catch).toHaveBeenCalledTimes(1);
    expect(e.catchCooldown).toBe(7);
    expect(e.state).toBe("distracted");
    tick(e, c, 120);
    expect(c.catch).toHaveBeenCalledTimes(1);
    expect(ENEMIES.founder.damage).toBe(35);
  });
  it("intern patrols are genuinely faster than manager patrols", () => {
    const a = setup("manager"),
      b = setup("intern");
    for (const s of [a, b]) {
      s.context.player = { x: 900, y: 700 };
      s.enemy.routeIndex = 0;
      s.enemy.target = { x: 500, y: 100 };
      s.context.random = () => 0.9;
    }
    tick(a.enemy, a.context, 60);
    tick(b.enemy, b.context, 60);
    expect(dist({ x: 100, y: 100 }, b.enemy)).toBeGreaterThan(
      dist({ x: 100, y: 100 }, a.enemy) + 20,
    );
  });
});
