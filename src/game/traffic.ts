import {
  blocked,
  clamp,
  dist,
  hash,
  inCone,
  move,
  rng,
  visible,
} from "./logic";
import type { Navigator } from "./logic";
import type { Level, MeetingRoom, Point, Rect } from "./types";

export interface Attendee {
  id: string;
  roomId: string;
  x: number;
  y: number;
  angle: number;
  phase: "inside" | "leaving" | "corridor" | "returning";
  awareness: number;
  cooldown: number;
  distracted: number;
  target: Point | null;
  path: Point[];
}

export interface TrafficEvent {
  type: "warning" | "spot" | "hit";
  title: string;
  text: string;
  point: Point;
  staffId?: string;
  roomId: string;
  damage?: number;
}

export interface TrafficInput {
  player: Point;
  hidden: boolean;
  protected: boolean;
  dashing: boolean;
  stunned: boolean;
  obstacles: Rect[];
  nav: Navigator;
}

type Door = {
  id: string;
  name: string;
  x: number;
  y: number;
  warning: boolean;
  open: boolean;
  /** Seconds until the next burst; held at the meeting interval during traffic. */
  next: number;
};
type Member = {
  actor: Attendee;
  home: Point;
  leg: "out-door" | "hall" | "in-door" | "home";
  delay: number;
  hold: number;
  repath: number;
  encounter: boolean;
  unseen: number;
  spotCooldown: number;
  observing: number;
  nearPlayer: boolean;
};
type Room = {
  config: MeetingRoom;
  door: Door;
  members: Member[];
  active: boolean;
  random: () => number;
};

const RADIUS = 10;
const SPEED = 105;
const WARNING = 0.9;
const STEP = 1 / 60;
const EPSILON = 1e-7;
const copy = (p: Point): Point => ({ x: p.x, y: p.y });
const seconds = (n: number, fallback: number) =>
  Number.isFinite(n) ? Math.max(WARNING, n) : fallback;

/**
 * Pure, seeded meeting traffic. Doors are traffic lights only: this model never
 * edits geometry, moves a player, changes health, or invokes scene callbacks.
 */
export class MeetingTraffic {
  public staff: Attendee[] = [];
  public doors: Door[] = [];
  private rooms: Room[] = [];
  private width: number;
  private height: number;

  constructor(level: Level, seed: string) {
    this.width = level.width;
    this.height = level.height;
    const obstacles: Rect[] = [
      ...level.walls,
      ...level.props,
      ...level.gates.filter((gate) => !gate.open),
    ];
    for (const source of level.rooms ?? []) {
      const config: MeetingRoom = {
        ...source,
        area: { ...source.area },
        door: copy(source.door),
        inside: copy(source.inside),
        hall: copy(source.hall),
      };
      const door: Door = {
        id: config.id,
        name: config.name,
        ...copy(config.door),
        warning: false,
        open: false,
        next: seconds(config.initialDelay, 5),
      };
      const room: Room = {
        config,
        door,
        members: [],
        active: false,
        random: rng(hash(`${seed}:meeting:${config.id}`)),
      };
      this.doors.push(door);
      this.rooms.push(room);
      const crowd = Number.isFinite(config.crowd)
        ? clamp(Math.floor(config.crowd), 1, 2)
        : 1;
      for (let i = 0; i < crowd && this.staff.length < 6; i++) {
        const home = this.spawnPoint(room, obstacles, i);
        // Malformed authored geometry must never put an actor into furniture.
        if (!home) continue;
        const actor: Attendee = {
          id: `${config.id}:attendee:${i + 1}`,
          roomId: config.id,
          ...home,
          angle: Math.atan2(config.door.y - home.y, config.door.x - home.x),
          phase: "inside",
          awareness: 0,
          cooldown: 0,
          distracted: 0,
          target: null,
          path: [],
        };
        this.staff.push(actor);
        room.members.push({
          actor,
          home,
          leg: "out-door",
          delay: 0,
          hold: 0,
          repath: 0,
          encounter: false,
          unseen: 0,
          spotCooldown: 0,
          observing: 0,
          nearPlayer: false,
        });
      }
    }
  }

  public update(dt: number, input: TrafficInput): TrafficEvent[] {
    const events: TrafficEvent[] = [];
    if (input.stunned || !Number.isFinite(dt) || dt <= 0) return events;
    // Bounded simulation steps preserve warning/grace and swept movement even
    // when the caller supplies an unusually long frame. No elapsed time is lost.
    for (let remaining = dt; remaining > EPSILON;) {
      const step = Math.min(STEP, remaining);
      for (const room of this.rooms) this.tickRoom(room, step, input, events);
      remaining -= step;
    }
    return events;
  }

  /** Coffee affects at most the two nearest available attendees, never bosses. */
  public distract(point: Point, duration: number): number {
    if (!Number.isFinite(duration) || duration <= 0) return 0;
    const nearby = this.staff
      .map((actor, index) => ({ actor, index, distance: dist(actor, point) }))
      .filter(({ actor, distance }) => distance <= 220 && actor.distracted <= 0)
      .sort((a, b) => a.distance - b.distance || a.index - b.index)
      .slice(0, 2);
    for (const { actor } of nearby) {
      actor.distracted = duration;
      actor.awareness = 0;
    }
    return nearby.length;
  }

  private spawnPoint(
    room: Room,
    obstacles: Rect[],
    index: number,
  ): Point | null {
    const { area, inside } = room.config;
    const angle = room.random() * Math.PI * 2;
    const legal = (p: Point) =>
      p.x >= area.x + 11 &&
      p.x <= area.x + area.w - 11 &&
      p.y >= area.y + 11 &&
      p.y <= area.y + area.h - 11 &&
      p.x >= 11 &&
      p.x <= this.width - 11 &&
      p.y >= 11 &&
      p.y <= this.height - 11 &&
      !blocked(p, 11, obstacles) &&
      this.staff.every((other) => dist(p, other) >= 22);
    // Start near the authored interior anchor, then search deterministic offsets.
    for (const radius of [
      index === 0 ? 6 : 24,
      0,
      24,
      36,
      48,
      60,
      84,
      108,
      144,
    ]) {
      for (let j = 0; j < (radius === 0 ? 1 : 16); j++) {
        const a = angle + (j * Math.PI) / 8;
        const p = {
          x: inside.x + Math.cos(a) * radius,
          y: inside.y + Math.sin(a) * radius,
        };
        if (legal(p)) return p;
      }
    }
    return null;
  }

  private tickRoom(
    room: Room,
    dt: number,
    input: TrafficInput,
    events: TrafficEvent[],
  ) {
    if (!room.members.length) return;
    const { door, config } = room;
    if (!room.active) {
      door.next = Math.max(0, door.next - dt);
      if (door.next <= WARNING + EPSILON && !door.warning) {
        door.warning = true;
        events.push({
          type: "warning",
          title: "MEETING ENDING",
          text: `${config.name}: meeting ending — staff coming through the door.`,
          point: copy(door),
          roomId: config.id,
        });
      }
      if (door.next <= EPSILON) {
        room.active = true;
        door.warning = false;
        door.open = true;
        door.next = seconds(config.interval, 12);
        room.members.forEach((member, i) => {
          member.delay = i * 0.3;
          member.hold = 3 + room.random() * 2;
          member.leg = "out-door";
        });
      }
    }
    for (const member of room.members) {
      const actor = member.actor;
      actor.cooldown = Math.max(0, actor.cooldown - dt);
      member.spotCooldown = Math.max(0, member.spotCooldown - dt);
      member.repath = Math.max(0, member.repath - dt);
      if (actor.distracted > 0) {
        actor.distracted = Math.max(0, actor.distracted - dt);
        actor.awareness = 0;
        continue;
      }
      if (room.active && actor.phase === "inside") {
        member.delay = Math.max(0, member.delay - dt);
        if (member.delay <= EPSILON && member.leg === "out-door") {
          actor.phase = "leaving";
          this.target(member, config.door);
        }
      }
      this.detect(room, member, dt, input, events);
      if (actor.phase === "inside") continue;
      if (member.observing > 0) {
        member.observing = Math.max(0, member.observing - dt);
        continue;
      }
      if (actor.phase === "corridor") {
        member.hold = Math.max(0, member.hold - dt);
        if (member.hold <= EPSILON) {
          actor.phase = "returning";
          member.leg = "in-door";
          this.target(member, config.door);
        }
      }
      if (actor.target) this.walk(room, member, dt, input);
    }
    if (
      room.active &&
      room.members.every(
        ({ actor, leg }) => actor.phase === "inside" && leg === "home",
      )
    ) {
      room.active = false;
      door.open = false;
      door.next = seconds(config.interval, 12);
    }
  }

  private target(member: Member, point: Point) {
    member.actor.target = copy(point);
    member.actor.path = [];
    member.repath = 0;
  }

  private walk(room: Room, member: Member, dt: number, input: TrafficInput) {
    const actor = member.actor;
    const target = actor.target!;
    if (dist(actor, target) <= EPSILON) {
      this.arrive(room, member);
      return;
    }
    if (member.repath <= EPSILON) {
      // Never invent a straight-line route when A* cannot find a safe path.
      const path = input.nav.path(actor, target);
      actor.path = path.every(
        (p) =>
          p.x >= RADIUS &&
          p.x <= this.width - RADIUS &&
          p.y >= RADIUS &&
          p.y <= this.height - RADIUS,
      )
        ? path.map(copy)
        : [];
      member.repath = 1;
    }
    let budget = SPEED * dt;
    while (budget > EPSILON && actor.path.length) {
      const waypoint = actor.path[0];
      const distance = dist(actor, waypoint);
      if (distance <= EPSILON) {
        actor.path.shift();
        continue;
      }
      actor.angle = Math.atan2(waypoint.y - actor.y, waypoint.x - actor.x);
      const length = Math.min(budget, distance);
      const destination = {
        x: clamp(
          actor.x + ((waypoint.x - actor.x) / distance) * length,
          RADIUS,
          this.width - RADIUS,
        ),
        y: clamp(
          actor.y + ((waypoint.y - actor.y) / distance) * length,
          RADIUS,
          this.height - RADIUS,
        ),
      };
      const next = move(
        actor,
        destination.x - actor.x,
        destination.y - actor.y,
        RADIUS,
        input.obstacles,
      );
      actor.x = next.x;
      actor.y = next.y;
      budget -= length;
      if (dist(actor, waypoint) <= EPSILON) actor.path.shift();
      else break;
    }
    if (dist(actor, target) <= EPSILON) this.arrive(room, member);
  }

  private arrive(room: Room, member: Member) {
    const actor = member.actor;
    switch (member.leg) {
      case "out-door":
        member.leg = "hall";
        this.target(member, room.config.hall);
        break;
      case "hall":
        actor.phase = "corridor";
        actor.target = null;
        actor.path = [];
        break;
      case "in-door":
        member.leg = "home";
        this.target(member, member.home);
        break;
      case "home":
        actor.phase = "inside";
        actor.target = null;
        actor.path = [];
        actor.awareness = 0;
        member.encounter = false;
        member.unseen = 0;
        member.nearPlayer = false;
        member.observing = 0;
        break;
    }
  }

  private detect(
    room: Room,
    member: Member,
    dt: number,
    input: TrafficInput,
    events: TrafficEvent[],
  ) {
    const actor = member.actor;
    const safe = input.hidden || input.protected || actor.phase === "inside";
    const near =
      !safe &&
      dist(actor, input.player) <= 45 &&
      visible(actor, input.player, input.obstacles);
    if (near) {
      actor.angle = Math.atan2(
        input.player.y - actor.y,
        input.player.x - actor.x,
      );
      // One short observation per approach, not a fresh stop every frame.
      if (!member.nearPlayer) member.observing = 0.15;
    }
    member.nearPlayer = near;
    const seen =
      !safe &&
      inCone(actor, input.player, actor.angle, 110, 1.8, input.obstacles);
    if (seen) {
      member.unseen = 0;
      actor.awareness = Math.min(1, actor.awareness + dt);
      if (
        actor.awareness >= 1 - EPSILON &&
        !member.encounter &&
        member.spotCooldown <= EPSILON
      ) {
        member.encounter = true;
        member.spotCooldown = 6;
        events.push({
          type: "spot",
          title: "MEETING SPOTTED YOU",
          text: `${room.config.name}: an attendee noticed you.`,
          point: copy(input.player),
          staffId: actor.id,
          roomId: room.config.id,
        });
      }
      if (
        actor.awareness >= 1 - EPSILON &&
        dist(actor, input.player) < 28 &&
        !input.dashing &&
        actor.cooldown <= EPSILON
      ) {
        actor.cooldown = 6;
        events.push({
          type: "hit",
          title: "MEETING COLLISION",
          text: `${room.config.name}: caught in the post-meeting catch-up. +10 BS`,
          point: copy(input.player),
          staffId: actor.id,
          roomId: room.config.id,
          damage: 10,
        });
      }
    } else {
      actor.awareness = safe ? 0 : Math.max(0, actor.awareness - dt * 1.5);
      member.unseen += dt;
      if (member.unseen >= 1 && actor.awareness <= EPSILON)
        member.encounter = false;
    }
  }
}
