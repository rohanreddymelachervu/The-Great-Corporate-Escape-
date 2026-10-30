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
    this.state = distracted ? "distracted" : "investigate";
    this.target = { ...p };
    this.stateTime = duration;
    this.repath = 0;
    this.path = [];
    if (distracted) this.awareness = 0;
  }
  update(c: EnemyContext) {
    const d = ENEMIES[this.kind],
      dt = c.dt;
    this.catchCooldown = Math.max(0, this.catchCooldown - dt);
    this.stateTime -= dt;
    this.repath -= dt;
    this.talkCooldown -= dt;
    this.idle = Math.max(0, this.idle - dt);
    const protectedByCall =
      c.call && this.kind !== "founder" && this.kind !== "intern";
    const canSee =
      !c.hidden &&
      !c.camouflaged &&
      this.state !== "distracted" &&
      inCone(
        this,
        c.player,
        this.angle,
        d.range * (c.alertBoost ? 1.2 : 1),
        d.fov,
        c.obstacles,
      );
    const near =
      dist(this, c.player) < 72 && visible(this, c.player, c.obstacles);
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
      this.path = [];
      this.repath = 0;
      this.idle = 2;
    }
    if (!near) this.bluffed = false;
    if (!c.stunned) {
      if (canSee && !protectedByCall) {
        this.awareness = clamp(
          this.awareness + dt * (this.kind === "founder" ? 1.05 : 0.8),
          0,
          1,
        );
        this.lastSeen = { ...c.player };
        if (this.awareness >= 1 && this.state !== "chase") {
          this.state = "chase";
          this.stateTime = 8;
          this.repath = 0;
          c.spot(this);
          this.say(d.quotes[Math.floor(c.random() * d.quotes.length)], c.time);
          if (this.kind === "gossip") c.broadcast(c.player);
        }
      } else this.awareness = Math.max(0, this.awareness - dt * 0.65);
      if (this.state === "chase") {
        if (canSee) {
          this.target = { ...c.player };
          this.stateTime = 4;
        } else if (this.stateTime <= 0 || c.hidden) {
          this.state = "search";
          this.stateTime = 4;
          this.target = this.lastSeen;
          this.path = [];
          this.repath = 0;
        }
        if (
          near &&
          dist(this, c.player) < 29 &&
          !c.hidden &&
          !c.camouflaged &&
          !protectedByCall &&
          !c.calendar &&
          this.catchCooldown === 0
        ) {
          this.catchCooldown = 7;
          this.state = "distracted";
          this.stateTime = 3;
          this.awareness = 0;
          this.target = null;
          this.path = [];
          c.catch(this);
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
      if (
        c.sprinting &&
        !c.quiet &&
        !c.hidden &&
        dist(this, c.player) < (this.kind === "intern" ? 180 : 140) &&
        visible(this, c.player, c.obstacles) &&
        this.state === "patrol"
      ) {
        this.investigate(c.player, 4);
        this.say("Was that a weekend?", c.time, 1.8);
      }
      if (this.state === "patrol" && this.idle === 0) {
        if (this.kind === "manager" && c.random() < dt * 0.035) {
          this.idle = 2;
          this.say("Slack: 47 unread blockers.", c.time, 2);
        }
        if (this.kind === "intern" && c.random() < dt * 0.18) {
          this.routeIndex = Math.floor(c.random() * this.route.length);
          this.repath = 0;
        }
        this.target = this.route[this.routeIndex];
        if (dist(this, this.target) < 19) {
          this.routeIndex = (this.routeIndex + 1) % this.route.length;
          this.target = this.route[this.routeIndex];
          this.repath = 0;
          this.idle = this.kind === "intern" ? 0.15 : 0.5 + c.random() * 0.9;
        }
      }
      if (this.target && this.idle === 0) {
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
          const speed =
            d.speed *
            (this.state === "chase"
              ? 1.2
              : this.state === "distracted"
                ? 1.05
                : 1);
          const pos = move(
            this,
            (dx / l) * speed * dt,
            (dy / l) * speed * dt,
            11,
            c.obstacles,
          );
          this.x = pos.x;
          this.y = pos.y;
        }
      }
      if (this.talkCooldown <= 0) {
        this.talkCooldown = 11 + c.random() * 9;
        this.say(d.quotes[Math.floor(c.random() * d.quotes.length)], c.time, 3);
      }
    }
    const bob =
      !c.stunned && this.path.length
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
