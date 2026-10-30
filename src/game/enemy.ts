import Phaser from "phaser";
import { ENEMIES } from "./catalog";
import { dist, inCone, move, visible, clamp } from "./logic";
import type { Navigator } from "./logic";
import type { Kind, Point, Rect, EnemySpawn, EnemyState } from "./types";
export interface EnemyContext {
  dt: number;
  time: number;
  player: Point;
  hidden: boolean;
  camouflaged: boolean;
  sprinting: boolean;
  dashing?: boolean;
  quiet: boolean;
  call: boolean;
  calendar: boolean;
  stunned: boolean;
  alertBoost: boolean;
  obstacles: Rect[];
  nav: Navigator;
  random: () => number;
  spot: (e: OfficeEnemy) => void;
  catch: (e: OfficeEnemy) => void;
  broadcast: (p: Point) => void;
  bluff: (e: OfficeEnemy) => void;
  dodge?: (e: OfficeEnemy) => void;
  threat?: (e: OfficeEnemy, text: string) => void;
}
export class OfficeEnemy {
  kind: Kind;
  x: number;
  y: number;
  angle = 0;
  state: EnemyState = "patrol";
  awareness = 0;
  target: Point | null = null;
  path: Point[] = [];
  route: Point[];
  routeIndex = 0;
  repath = 0;
  stateTime = 0;
  catchCooldown = 0;
  talkCooldown = 5;
  quote = "";
  quoteUntil = 0;
  sprite: Phaser.GameObjects.Image;
  label: Phaser.GameObjects.Text;
  bubble: Phaser.GameObjects.Text;
  indicator: Phaser.GameObjects.Text;
  lastSeen: Point | null = null;
  bluffed = false;
  wasSeen = false;
  idle = 0;
  specialPhase: "none" | "photo-windup" | "photo-charge" = "none";
  specialLeft = 0;
  specialCooldown = 0;
  aim: Point | null = null;
  private photoDodged = false;
  constructor(scene: Phaser.Scene, spawn: EnemySpawn, random: () => number) {
    this.kind = spawn.kind;
    this.x = spawn.x;
    this.y = spawn.y;
    this.route = spawn.route.map((p) => ({ ...p }));
    this.routeIndex = Math.floor(random() * this.route.length);
    this.angle = Math.atan2(
      this.route[this.routeIndex].y - this.y,
      this.route[this.routeIndex].x - this.x,
    );
    this.talkCooldown = 3 + random() * 7;
    const d = ENEMIES[this.kind];
    this.sprite = scene.add
      .image(this.x, this.y, this.kind)
      .setScale(1.35)
      .setDepth(40);
    this.label = scene.add
      .text(this.x, this.y + 26, d.title.toUpperCase(), {
        fontFamily: "monospace",
        fontSize: "9px",
        color: "#" + d.color.toString(16),
        backgroundColor: "#141c2be6",
        padding: { x: 4, y: 3 },
      })
      .setOrigin(0.5, 0)
      .setDepth(61);
    this.bubble = scene.add
      .text(0, 0, "", {
        fontFamily: "monospace",
        fontSize: "11px",
        color: "#182137",
        backgroundColor: "#f2ead9",
        padding: { x: 8, y: 6 },
        wordWrap: { width: 185 },
        align: "center",
      })
      .setOrigin(0.5, 1)
      .setDepth(90)
      .setVisible(false);
    this.indicator = scene.add
      .text(this.x, this.y - 32, "", {
        fontFamily: "monospace",
        fontSize: "20px",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(65);
  }
  say(text: string, time: number, duration = 3) {
    this.quote = text;
    this.quoteUntil = time + duration;
    this.bubble.setText(text).setVisible(true);
  }
  investigate(p: Point, duration = 7, distracted = false) {
    if (this.state === "chase" && !distracted) return;
    this.endPhoto();
    this.state = distracted ? "distracted" : "investigate";
    this.target = { ...p };
    this.stateTime = duration;
    this.repath = 0;
    this.path = [];
    if (distracted) this.awareness = 0;
  }
  /** Coffee is a diversion, not an invisibility switch during a close pursuit. */
  softDistract(
    p: Point,
    duration: number,
    player: Point,
    obstacles: Rect[],
  ): boolean {
    if (
      this.state === "chase" &&
      dist(this, player) <= 180 &&
      visible(this, player, obstacles)
    ) {
      this.endPhoto(0.4);
      this.idle = Math.max(this.idle, 0.4);
      return false;
    }
    this.investigate(p, duration, true);
    return true;
  }
  private endPhoto(recovery = 0.5) {
    if (this.specialPhase === "none") return;
    this.specialPhase = "none";
    this.specialLeft = 0;
    this.specialCooldown = 6.5;
    this.aim = null;
    this.path = [];
    this.repath = 0;
    this.idle = Math.max(this.idle, recovery);
  }
  /** Also checked along the charge, so a long frame cannot skip a dodge/catch. */
  private checkContact(c: EnemyContext) {
    if (
      this.state !== "chase" ||
      this.specialPhase === "photo-windup" ||
      c.stunned ||
      c.hidden ||
      c.camouflaged ||
      c.calendar ||
      (c.call && this.kind !== "founder" && this.kind !== "intern")
    )
      return;
    const distance = dist(this, c.player);
    if (distance >= 48 || !visible(this, c.player, c.obstacles)) return;
    if (
      this.specialPhase === "photo-charge" &&
      c.dashing &&
      !this.photoDodged
    ) {
      this.photoDodged = true;
      c.dodge?.(this);
    }
    if (!c.dashing && distance < 29 && this.catchCooldown === 0) {
      this.catchCooldown = 7;
      this.state = "distracted";
      this.stateTime = 3;
      this.awareness = 0;
      this.target = null;
      this.path = [];
      this.endPhoto();
      c.catch(this);
    }
  }
  private advancePhoto(c: EnemyContext) {
    if (!this.aim) {
      this.endPhoto();
      return;
    }
    if (this.specialPhase === "photo-windup") {
      this.specialLeft = Math.max(0, this.specialLeft - c.dt);
      if (this.specialLeft <= 1e-8) {
        this.specialPhase = "photo-charge";
        this.specialLeft = 0.75;
      }
      return;
    }
    let left = Math.min(c.dt, this.specialLeft);
    this.checkContact(c);
    // move() is wall-safe; small steps additionally make player contact swept.
    while (left > 1e-8 && this.specialPhase === "photo-charge" && this.aim) {
      const dx = this.aim.x - this.x,
        dy = this.aim.y - this.y,
        length = Math.hypot(dx, dy);
      if (length < 1e-6) {
        this.endPhoto();
        break;
      }
      const step = Math.min(left, 1 / 60, length / 285),
        mx = (dx / length) * 285 * step,
        my = (dy / length) * 285 * step;
      const pos = move(this, mx, my, 11, c.obstacles);
      const collided =
        Math.abs(pos.x - this.x - mx) > 1e-6 ||
        Math.abs(pos.y - this.y - my) > 1e-6;
      this.angle = Math.atan2(dy, dx);
      this.x = pos.x;
      this.y = pos.y;
      left -= step;
      this.specialLeft = Math.max(0, this.specialLeft - step);
      this.checkContact(c);
      if (
        this.specialPhase === "photo-charge" &&
        (collided || dist(this, this.aim!) < 1e-6 || this.specialLeft <= 1e-8)
      )
        this.endPhoto();
    }
  }
  update(c: EnemyContext) {
    const d = ENEMIES[this.kind],
      dt = c.dt;
    this.catchCooldown = Math.max(0, this.catchCooldown - dt);
    this.specialCooldown = Math.max(0, this.specialCooldown - dt);
    if (c.stunned) {
      // Cancel instead of pausing: VPN must never release a stored lunge.
      this.endPhoto();
    } else {
      this.stateTime -= dt;
      this.repath -= dt;
      this.talkCooldown -= dt;
      this.idle = Math.max(0, this.idle - dt);
      const protectedByCall =
        c.call && this.kind !== "founder" && this.kind !== "intern";
      const distance = dist(this, c.player),
        lineOfSight = visible(this, c.player, c.obstacles),
        near = distance < 72 && lineOfSight;
      if (
        this.specialPhase !== "none" &&
        (this.state !== "chase" ||
          c.hidden ||
          c.camouflaged ||
          protectedByCall ||
          c.calendar)
      )
        this.endPhoto();
      if ((protectedByCall || c.camouflaged) && near && !this.bluffed) {
        c.bluff(this);
        this.bluffed = true;
        this.say(
          protectedByCall
            ? "Client call? Ah. Revenue. Proceed."
            : "That green dot looks productive.",
          c.time,
        );
        this.awareness = 0;
        this.state = "patrol";
        this.target = null;
        this.path = [];
        this.repath = 0;
        this.idle = 2;
      }
      if (!near) this.bluffed = false;
      // Investigation is an approach, not permission to walk through a person.
      // A nearby colleague looks at you and pauses outside your personal space,
      // giving a readable suspicion tell before escalating into an interaction.
      if (
        distance < 52 &&
        lineOfSight &&
        !c.hidden &&
        !c.camouflaged &&
        !protectedByCall &&
        this.state !== "distracted" &&
        this.state !== "chase"
      ) {
        this.angle = Math.atan2(c.player.y - this.y, c.player.x - this.x);
        this.idle = Math.max(this.idle, 0.15);
      }
      const canDetect =
        !c.hidden && !c.camouflaged && this.state !== "distracted";
      const inView =
        canDetect &&
        inCone(
          this,
          c.player,
          this.angle,
          d.range * (c.alertBoost ? 1.2 : 1),
          d.fov,
          c.obstacles,
        );
      const closeSense = canDetect && distance < 50 && lineOfSight;
      const canSee = inView || closeSense;
      if (canSee && !protectedByCall) {
        this.awareness = clamp(
          this.awareness +
            dt * (inView ? (this.kind === "founder" ? 1.05 : 0.8) : 0.4),
          0,
          1,
        );
        this.lastSeen = { ...c.player };
        if (this.awareness >= 1 && this.state !== "chase") {
          this.state = "chase";
          this.stateTime = 8;
          this.repath = 0;
          this.path = [];
          this.idle = 0;
          c.spot(this);
          this.say(d.quotes[Math.floor(c.random() * d.quotes.length)], c.time);
          if (this.kind === "gossip") c.broadcast(c.player);
        }
      } else this.awareness = Math.max(0, this.awareness - dt * 0.65);
      if (this.state === "chase") {
        if (canSee && !protectedByCall) {
          this.target = { ...c.player };
          this.stateTime = 4;
        } else if (this.stateTime <= 0 || c.hidden) {
          this.state = "search";
          this.stateTime = 4;
          this.target = this.lastSeen ? { ...this.lastSeen } : null;
          this.path = [];
          this.repath = 0;
        }
      } else if (
        (this.state === "search" ||
          this.state === "investigate" ||
          this.state === "distracted") &&
        this.stateTime <= 0
      ) {
        this.state = "patrol";
        this.target = null;
        this.path = [];
        this.repath = 0;
      }
      // Losing pursuit (including an externally changed state) ends the tell.
      if (this.state !== "chase") this.endPhoto();
      this.checkContact(c);
      if (
        c.sprinting &&
        !c.quiet &&
        !c.hidden &&
        !c.camouflaged &&
        distance < (this.kind === "intern" ? 180 : 140) &&
        lineOfSight &&
        this.state === "patrol"
      ) {
        this.investigate(c.player, 4);
        this.say("Was that a weekend?", c.time, 1.8);
      }
      if (this.state === "patrol" && this.idle === 0) {
        // Patrol decisions happen at waypoints, never random per-frame stalls.
        this.target = this.route[this.routeIndex];
        if (dist(this, this.target) < 19) {
          this.routeIndex = (this.routeIndex + 1) % this.route.length;
          this.target = this.route[this.routeIndex];
          this.repath = 0;
          this.idle = this.kind === "intern" ? 0.15 : 0.5 + c.random() * 0.9;
        }
      }
      let startedPhoto = false;
      if (
        this.kind === "hr" &&
        this.state === "chase" &&
        this.specialPhase === "none" &&
        this.specialCooldown === 0 &&
        this.idle === 0 &&
        !c.hidden &&
        !c.camouflaged &&
        !protectedByCall &&
        !c.calendar &&
        distance >= 70 &&
        distance <= 230 &&
        lineOfSight
      ) {
        this.specialPhase = "photo-windup";
        this.specialLeft = 0.9;
        this.aim = { ...c.player };
        this.angle = Math.atan2(this.aim.y - this.y, this.aim.x - this.x);
        this.path = [];
        this.repath = 0;
        this.photoDodged = false;
        const text = "TEAM PHOTO! Nobody blink. Or leave.";
        this.say(text, c.time, 2);
        c.threat?.(this, text);
        startedPhoto = true;
      }
      if (this.specialPhase !== "none") {
        if (!startedPhoto) this.advancePhoto(c);
      } else if (this.target && this.idle === 0) {
        if (this.repath <= 0) {
          this.path = c.nav.path(this, this.target);
          this.repath = this.state === "chase" ? 0.48 : 1.8;
        }
        while (this.path.length && dist(this, this.path[0]) < 8)
          this.path.shift();
        const goal = this.path[0];
        if (goal) {
          const dx = goal.x - this.x,
            dy = goal.y - this.y,
            l = Math.hypot(dx, dy);
          this.angle = Math.atan2(dy, dx);
          const walkMultiplier =
            this.kind === "manager" || this.kind === "founder" ? 1.05 : 1;
          const speed =
            d.speed *
            (this.state === "chase"
              ? this.kind === "intern"
                ? 1.35
                : 1.45
              : this.state === "distracted"
                ? 1.05
                : walkMultiplier);
          const travel = Math.min(l, speed * dt);
          const pos = move(
            this,
            (dx / l) * travel,
            (dy / l) * travel,
            11,
            c.obstacles,
          );
          this.x = pos.x;
          this.y = pos.y;
        }
      }
      this.checkContact(c);
      if (this.talkCooldown <= 0 && this.specialPhase === "none") {
        this.talkCooldown = 11 + c.random() * 9;
        this.say(d.quotes[Math.floor(c.random() * d.quotes.length)], c.time, 3);
      }
    }
    const bob = c.stunned
      ? 0
      : this.path.length
        ? Math.sin(c.time * 12) * 1.2
        : Math.sin(c.time * 3) * 0.4;
    this.sprite
      .setPosition(this.x, this.y + bob)
      .setDepth(40 + this.y / 1000)
      .setFlipX(Math.cos(this.angle) < 0)
      .setAlpha(c.stunned ? 0.55 : 1);
    this.label.setPosition(this.x, this.y + 24);
    this.bubble
      .setPosition(clamp(this.x, 110, c.nav.width - 110), this.y - 31)
      .setVisible(c.time < this.quoteUntil);
    this.indicator
      .setPosition(this.x, this.y - 37)
      .setText(
        c.stunned
          ? "…"
          : this.state === "chase"
            ? "!"
            : this.awareness > 0.1
              ? "?"
              : this.state === "investigate"
                ? "?"
                : "",
      )
      .setColor(this.state === "chase" ? "#ff827f" : "#ffde8b");
  }
}
