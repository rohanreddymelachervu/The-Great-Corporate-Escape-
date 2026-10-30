import Phaser from "phaser";
import { createTextures, renderOffice } from "../art/art";
import { OfficeAudio } from "../audio/audio";
import { LEVELS } from "./levels";
import { ABILITIES, ENEMIES, EVENTS } from "./catalog";
import {
  Navigator,
  blocked,
  center,
  clamp,
  dist,
  hash,
  inCone,
  medal,
  move,
  rng,
  scoreRun,
  visible,
} from "./logic";
import { OfficeEnemy } from "./enemy";
import type { FunFriday } from "./fun";
import type {
  Ability,
  Interaction,
  Item,
  Level,
  Point,
  Rect,
  Result,
} from "./types";
export const emit = (name: string, detail: unknown) =>
  window.dispatchEvent(new CustomEvent("office:" + name, { detail }));
export interface RunOptions {
  level: number;
  daily: boolean;
  seed: string;
  preview?: boolean;
}
export class OfficeScene extends Phaser.Scene {
  level!: Level;
  options!: RunOptions;
  audio: OfficeAudio;
  random: () => number = Math.random;
  obstacles: Rect[] = [];
  nav!: Navigator;
  enemies: OfficeEnemy[] = [];
  player!: Phaser.GameObjects.Image;
  fx!: Phaser.GameObjects.Graphics;
  cones!: Phaser.GameObjects.Graphics;
  markers!: Phaser.GameObjects.Graphics;
  hint!: Phaser.GameObjects.Text;
  pos: Point = { x: 0, y: 0 };
  facing: Point = { x: 1, y: 0 };
  elapsed = 0;
  bs = 0;
  stamina = 100;
  spots = 0;
  hits = 0;
  collectibles = 0;
  distractions = 0;
  coffee = 2;
  wfh = 0;
  wfhActive = false;
  hidden = false;
  invulnerable = 0;
  active: Partial<Record<Ability, number>> = {};
  cooldowns: Partial<Record<Ability, number>> = {};
  collected = new Set<string>();
  used = new Set<string>();
  stationTimes: Record<string, number> = {};
  enemiesHit = new Set<string>();
  bluffedEnemies = new Set<OfficeEnemy>();
  accumulator = 0;
  bluffs = 0;
  coffeeUsed = 0;
  funScore = 0;
  funCompleted = new Set<string>();
  internTime = 0;
  listenStep = 0;
  nonRequiredInteractions = 0;
  won = false;
  ended = false;
  preview = false;
  eventAt = 0;
  eventType = "";
  eventUntil = 0;
  eventZone: Point | null = null;
  exitBlock = 0;
  hudAt = 0;
  stepAt = 0;
  noiseAt = 0;
  target: Interaction | null = null;
  hintText = "";
  exitObjects: Phaser.GameObjects.GameObject[] = [];
  itemObjects = new Map<string, Phaser.GameObjects.Container>();
  keys!: Record<string, Phaser.Input.Keyboard.Key>;
  touch = { x: 0, y: 0, sprint: false };
  reducedMotion = false;
  lastSprinting = false;
  pickupGlow = 0;
  constructor(audio: OfficeAudio) {
    super("office");
    this.audio = audio;
  }
  init(data: Partial<RunOptions>) {
    this.options = {
      level: data.level || 1,
      daily: !!data.daily,
      seed: data.seed || "menu",
      preview: !!data.preview,
    };
    this.level = LEVELS[this.options.level - 1];
    this.preview = !!data.preview;
    this.random = rng(hash(this.options.seed + ":" + this.level.id));
    this.enemies = [];
    this.elapsed = 0;
    this.bs = 0;
    this.stamina = 100;
    this.spots = 0;
    this.hits = 0;
    this.collectibles = 0;
    this.distractions = 0;
    this.coffee = 2;
    this.wfh = 0;
    this.wfhActive = false;
    this.hidden = false;
    this.invulnerable = 0;
    this.active = {};
    this.cooldowns = {};
    this.collected = new Set();
    this.used = new Set();
    this.stationTimes = {};
    this.enemiesHit = new Set();
    this.bluffedEnemies = new Set();
    this.accumulator = 0;
    this.bluffs = 0;
    this.coffeeUsed = 0;
    this.funScore = 0;
    this.funCompleted = new Set();
    this.internTime = 0;
    this.listenStep = 0;
    this.nonRequiredInteractions = 0;
    this.won = false;
    this.ended = false;
    this.eventType = "";
    this.eventUntil = 0;
    this.exitBlock = 0;
    this.eventZone = null;
    this.hudAt = 0;
    this.stepAt = 0;
    this.noiseAt = 0;
    this.target = null;
    this.hintText = "";
    this.itemObjects = new Map();
    this.exitObjects = [];
    this.touch = { x: 0, y: 0, sprint: false };
    this.eventAt = 22 + this.random() * 10;
    this.pos = { ...this.level.spawn };
    this.pickupGlow = 0;
  }
  create() {
    createTextures(this);
    renderOffice(this, this.level);
    this.obstacles = [
      ...this.level.walls,
      ...this.level.props,
      ...this.level.gates.filter((g) => !g.open),
    ];
    this.nav = new Navigator(
      this.level.width,
      this.level.height,
      this.obstacles,
    );
    this.cones = this.add.graphics().setDepth(15);
    this.markers = this.add.graphics().setDepth(20);
    this.fx = this.add.graphics().setDepth(51);
    this.drawExit(this.level.exit, false);
    if (this.level.altExit) this.drawExit(this.level.altExit, true);
    for (const item of this.level.items) this.drawItem(item);
    for (const point of this.level.interactions.filter(
      (i) => i.type === "fun",
    )) {
      this.add
        .text(point.x, point.y - 35, "HR FUN ACTIVITY", {
          fontFamily: "monospace",
          fontSize: "11px",
          color: "#ffd1ea",
          backgroundColor: "#35283f",
          padding: { x: 6, y: 4 },
        })
        .setOrigin(0.5)
        .setDepth(23);
    }
    for (const gate of this.level.gates) {
      const obj = this.add
        .rectangle(
          gate.x + gate.w / 2,
          gate.y + gate.h / 2,
          gate.w,
          gate.h,
          0xcf7e8e,
          0.7,
        )
        .setStrokeStyle(2, 0xfaa6b7)
        .setDepth(12);
      obj.setName(gate.id);
    }
    this.player = this.add
      .image(this.pos.x, this.pos.y, "player")
      .setScale(1.45)
      .setDepth(45);
    this.add
      .text(this.pos.x, this.pos.y + 27, "YOU", {
        fontFamily: "monospace",
        fontSize: "10px",
        color: "#b6f9d8",
        backgroundColor: "#142b32",
        padding: { x: 5, y: 4 },
      })
      .setOrigin(0.5)
      .setName("spawnLabel")
      .setDepth(62);
    this.enemies = this.level.enemies.map(
      (e) => new OfficeEnemy(this, e, this.random),
    );
    const shortNames = {
      manager: "MANAGER",
      hr: "HR",
      intern: "INTERN",
      founder: "FOUNDER",
      pm: "PM",
      gossip: "GOSSIP",
    };
    this.enemies.forEach((e) =>
      e.label.setText(shortNames[e.kind]).setFontSize(11),
    );
    if (this.preview)
      this.enemies.forEach((e) => {
        e.label.setVisible(false);
        e.bubble.setVisible(false);
      });
    this.hint = this.add
      .text(0, 0, "", {
        fontFamily: "monospace",
        fontSize: "12px",
        color: "#f5f1e6",
        backgroundColor: "#151e32ed",
        padding: { x: 10, y: 7 },
        wordWrap: { width: 230 },
        align: "center",
      })
      .setOrigin(0.5, 1)
      .setDepth(95)
      .setVisible(false);
    this.keys = this.input.keyboard!.addKeys(
      "W,A,S,D,UP,DOWN,LEFT,RIGHT,SHIFT",
    ) as Record<string, Phaser.Input.Keyboard.Key>;
    const keyHandler = (e: KeyboardEvent) => {
      if (this.preview || this.ended || this.scene.isPaused()) return;
      if (e.repeat) return;
      if (e.code === "KeyE" || e.code === "Space") {
        e.preventDefault();
        this.interact();
      }
      const index = Number(e.key) - 1;
      if (index >= 0 && index < 6)
        this.ability((Object.keys(ABILITIES) as Ability[])[index]);
    };
    this.input.keyboard!.on("keydown", keyHandler);
    this.events.once("shutdown", () => {
      this.input.keyboard?.off("keydown", keyHandler);
      this.scale.off("resize", this.resize, this);
    });
    this.scale.on("resize", this.resize, this);
    this.resize();
    this.cameras.main.setBackgroundColor("#101625");
    if (this.preview) this.audio.music("menu");
    if (!this.preview) {
      this.cameras.main.fadeIn(this.reducedMotion ? 0 : 450, 16, 22, 37);
      this.audio.music(this.level.id === 5 ? "final" : "game");
      emit("toast", {
        title: "4:59 PM · " + this.level.name,
        text: this.level.brief,
        duration: 6,
      });
    }
    this.updateHud();
  }
  resize() {
    const c = this.cameras.main,
      w = this.scale.width,
      h = this.scale.height;
    const portrait = w < 650;
    const follow = w < 850 || matchMedia("(pointer:coarse)").matches;
    const zoom = this.preview
      ? Math.max(w / this.level.width, h / this.level.height)
      : follow
        ? portrait
          ? 0.88
          : 0.9
        : Math.min(w / this.level.width, h / this.level.height);
    c.setZoom(zoom);
    if (follow && !this.preview) {
      c.setBounds(0, 0, this.level.width, this.level.height);
      c.startFollow(this.player, true, 0.1, 0.1);
    } else {
      c.stopFollow();
      c.removeBounds();
      c.centerOn(this.level.width / 2, this.level.height / 2);
    }
  }
  drawExit(r: Rect, alt: boolean) {
    const color = alt ? 0xb99cff : 0xa7f4c8,
      c = center(r);
    const g = this.add.graphics().setDepth(11);
    g.fillStyle(0x10182b).fillRoundedRect(
      r.x - 6,
      r.y - 6,
      r.w + 12,
      r.h + 12,
      4,
    );
    g.fillStyle(alt ? 0x4e416e : 0x365b58).fillRect(r.x, r.y, r.w, r.h);
    g.lineStyle(3, color).strokeRect(r.x, r.y, r.w, r.h);
    g.lineStyle(2, 0x152838).lineBetween(c.x, r.y, c.x, r.y + r.h);
    g.fillStyle(color).fillRect(r.x + 6, r.y + 6, r.w - 12, 5);
    this.add
      .text(c.x, r.y - 22, alt ? "WFH EXIT" : "ELEVATOR →", {
        fontFamily: "monospace",
        fontSize: "11px",
        color: alt ? "#cebbff" : "#baffd6",
        backgroundColor: "#172b34",
        padding: { x: 4, y: 3 },
      })
      .setOrigin(0.5)
      .setDepth(12);
    this.add
      .text(c.x, c.y + 7, alt ? "REMOTE" : "FREEDOM", {
        fontFamily: "monospace",
        fontSize: "10px",
        color: "#e7f9e9",
      })
      .setOrigin(0.5)
      .setDepth(12);
    this.exitObjects.push(g);
  }
  drawItem(item: Item) {
    const g = this.add.graphics();
    const c =
      item.kind === "badge"
        ? 0xffda83
        : item.kind === "wfh"
          ? 0xbd9dff
          : item.kind === "coffee"
            ? 0xf3bc8c
            : 0x8dd7f5;
    g.fillStyle(0x142237, 0.9).fillCircle(0, 0, 14);
    g.lineStyle(1, c).strokeCircle(0, 0, 14);
    if (item.kind === "badge") {
      g.fillStyle(c).fillRoundedRect(-6, -7, 12, 15, 2);
      g.fillStyle(0x24354b).fillRect(-3, -4, 6, 4).fillRect(-3, 3, 6, 1);
      g.lineStyle(2, c).lineBetween(0, -12, 0, -8);
    } else if (item.kind === "coffee") {
      g.fillStyle(c).fillRect(-5, -5, 10, 10);
      g.lineStyle(2, c).strokeRect(4, -3, 4, 5);
      g.lineStyle(1, 0xffffff)
        .lineBetween(-2, -9, -1, -7)
        .lineBetween(2, -11, 3, -8);
    } else if (item.kind === "laptop") {
      g.fillStyle(c).fillRect(-7, -6, 14, 10);
      g.fillStyle(0x314c68).fillRect(-5, -4, 10, 6);
      g.fillStyle(0xe9d9ef).fillRect(-9, 5, 18, 2);
    } else {
      g.fillStyle(c).fillTriangle(-8, 0, 0, -7, 8, 0);
      g.fillRect(-5, 0, 10, 8);
      g.fillStyle(0x342b53).fillRect(-1, 3, 3, 5);
    }
    const label = this.add
      .text(
        0,
        19,
        item.kind === "badge"
          ? "BADGE"
          : item.kind === "wfh"
            ? "WFH TOKEN"
            : "",
        {
          fontFamily: "monospace",
          fontSize: "9px",
          color: "#ffe4a2",
          backgroundColor: "#172238",
          padding: { x: 3, y: 2 },
        },
      )
      .setOrigin(0.5, 0);
    const cont = this.add.container(item.x, item.y, [g, label]).setDepth(22);
    label.setVisible(item.kind === "badge" || item.kind === "wfh");
    this.itemObjects.set(item.id, cont);
  }
  update(time: number, delta: number) {
    if (this.ended) return;
    this.accumulator += Math.min(delta / 1000, 0.1);
    let steps = 0;
    while (this.accumulator >= 1 / 60 && steps++ < 6) {
      this.tick(time, 1000 / 60);
      this.accumulator -= 1 / 60;
    }
  }
  tick(_time: number, delta: number) {
    if (this.ended) return;
    const dt = delta / 1000;
    if (this.preview) {
      this.elapsed += dt;
      this.enemies.forEach((e, i) => {
        e.sprite.y = e.y + Math.sin(this.elapsed * 2 + i);
      });
      return;
    }
    this.elapsed += dt;
    this.invulnerable = Math.max(0, this.invulnerable - dt);
    this.exitBlock = Math.max(0, this.exitBlock - dt);
    for (const k of Object.keys(this.active) as Ability[])
      this.active[k] = Math.max(0, (this.active[k] || 0) - dt);
    for (const k of Object.keys(this.cooldowns) as Ability[])
      this.cooldowns[k] = Math.max(0, (this.cooldowns[k] || 0) - dt);
    let dx =
      (this.keys.D.isDown || this.keys.RIGHT.isDown ? 1 : 0) -
      (this.keys.A.isDown || this.keys.LEFT.isDown ? 1 : 0) +
      this.touch.x;
    let dy =
      (this.keys.S.isDown || this.keys.DOWN.isDown ? 1 : 0) -
      (this.keys.W.isDown || this.keys.UP.isDown ? 1 : 0) +
      this.touch.y;
    const length = Math.hypot(dx, dy);
    if (length > 1) {
      dx /= length;
      dy /= length;
    }
    const moving = length > 0.12;
    const sprint =
      moving &&
      (this.keys.SHIFT.isDown || this.touch.sprint) &&
      this.stamina > 2;
    this.lastSprinting = sprint;
    const yapping = this.enemies.some(
      (e) =>
        e.kind === "intern" &&
        dist(e, this.pos) < 95 &&
        !this.hidden &&
        visible(e, this.pos, this.obstacles) &&
        e.state !== "distracted",
    );
    if (moving) {
      this.hidden = false;
      this.active.slack = 0;
      const directionLength = Math.hypot(dx, dy) || 1;
      this.facing = { x: dx / directionLength, y: dy / directionLength };
      const speed = (sprint ? 246 : 155) * (yapping ? 0.72 : 1);
      this.pos = move(
        this.pos,
        dx * speed * dt,
        dy * speed * dt,
        11,
        this.obstacles,
      );
      if (this.elapsed > this.stepAt) {
        this.audio.sfx("step");
        this.stepAt = this.elapsed + (sprint ? 0.22 : 0.36);
      }
      const label = this.children.getByName(
        "spawnLabel",
      ) as Phaser.GameObjects.Text;
      label?.setVisible(this.elapsed < 3);
    }
    this.stamina = clamp(this.stamina + (sprint ? -27 : 21) * dt, 0, 100);
    if (this.hidden) this.bs = Math.max(0, this.bs - dt * 1.4);
    if (yapping) {
      this.internTime += dt;
      const step = Math.floor(this.internTime / 3);
      if (step > this.listenStep && step <= 4) {
        this.listenStep = step;
        const intern = this.enemies.find(
          (e) => e.kind === "intern" && dist(e, this.pos) < 95,
        );
        intern?.say(
          [
            "Bro, first the agent opens an agent…",
            "Then MCP makes it enterprise-ready…",
            "Then we add another abstraction…",
            "Anyway, it’s a todo app. With a moat.",
          ][step - 1],
          this.elapsed,
          3,
        );
      }
    }
    this.enemies.forEach((e) =>
      e.update({
        dt,
        time: this.elapsed,
        player: this.pos,
        hidden: this.hidden,
        camouflaged: !!this.active.slack && !moving,
        sprinting: sprint,
        quiet: this.eventType === "noise" && this.elapsed < this.eventUntil,
        call: !!this.active.call,
        calendar: !!this.active.calendar,
        stunned: !!this.active.vpn,
        alertBoost:
          this.eventType === "hands" && this.elapsed < this.eventUntil,
        obstacles: this.obstacles,
        nav: this.nav,
        random: this.random,
        spot: (enemy) => {
          this.spots++;
          this.audio.sfx(enemy.kind === "founder" ? "founder" : "alert");
        },
        catch: (e) => this.caught(e),
        broadcast: (p) => {
          this.enemies
            .filter((o) => o !== e && dist(o, e) < 320)
            .forEach((o) => o.investigate(p, 7));
          emit("toast", {
            title: "LOCATION LEAKED",
            text: "Gossip has @channel’d your weekend.",
            duration: 3,
          });
        },
        bluff: (enemy) => {
          if (!this.bluffedEnemies.has(enemy)) {
            this.bluffedEnemies.add(enemy);
            this.bluffs++;
          }
          this.audio.sfx("ability");
        },
      }),
    );
    const readableEnemies = [...this.enemies]
      .sort((a, b) => dist(a, this.pos) - dist(b, this.pos))
      .slice(0, 2);
    for (const enemy of this.enemies) {
      enemy.bubble.setVisible(false);
      enemy.label.setVisible(
        readableEnemies.includes(enemy) && dist(enemy, this.pos) < 230,
      );
    }
    if (
      this.eventZone &&
      this.elapsed < this.eventUntil &&
      dist(this.pos, this.eventZone) < 62 &&
      !this.active.calendar &&
      !this.active.vpn
    ) {
      this.bs = Math.min(100, this.bs + dt * 5);
      this.hintText = "MANDATORY FUN · +5 BS/s. Move out of the ring.";
    }
    for (const item of this.level.items) {
      if (!this.collected.has(item.id) && dist(this.pos, item) < 27) {
        this.collected.add(item.id);
        this.itemObjects.get(item.id)?.destroy();
        if (item.kind === "coffee") {
          this.coffee = Math.min(5, this.coffee + 1);
          this.bs = Math.max(0, this.bs - 8);
        } else if (item.kind === "wfh") this.wfh++;
        else if (item.kind === "laptop") {
          this.collectibles++;
          emit("toast", {
            title: "ABANDONED LAPTOP RECOVERED",
            text: [
              "Someone rage-quit during npm install. +300.",
              "12 tabs of Jira. No actual work. +300.",
              "The asset tracker says “emotionally missing”. +300.",
            ][Math.floor(this.random() * 3)],
            duration: 3,
          });
        } else {
          emit("toast", {
            title: "BADGE SECURED",
            text: "One step closer to being officially absent.",
            duration: 3,
          });
        }
        this.audio.sfx("item");
        this.pickupGlow = this.elapsed + 0.5;
      }
    }
    this.target =
      this.level.interactions
        .filter((i) => dist(this.pos, i) < 49)
        .sort((a, b) => dist(this.pos, a) - dist(this.pos, b))[0] || null;
    const ready = this.level.required.every(
      (id) => this.collected.has(id) || this.used.has(id),
    );
    const atExit = dist(this.pos, center(this.level.exit)) < 50;
    const atAlt =
      !!this.level.altExit && dist(this.pos, center(this.level.altExit)) < 50;
    if (
      (atExit || atAlt) &&
      ready &&
      this.exitBlock <= 0 &&
      (!atAlt || this.wfhActive)
    ) {
      this.finish(true, atAlt);
      return;
    }
    if (this.bs >= 100) {
      this.finish(false);
      return;
    }
    if (this.elapsed >= this.eventAt) {
      this.corporateEvent();
      this.eventAt = this.elapsed + 30 + this.random() * 15;
    }
    const bob = moving
      ? Math.sin(this.elapsed * (sprint ? 19 : 13)) * 1.5
      : Math.sin(this.elapsed * 3) * 0.5;
    this.player
      .setPosition(this.pos.x, this.pos.y + bob)
      .setFlipX(this.facing.x < 0)
      .setAlpha(
        this.hidden
          ? 0.25
          : !!this.active.slack
            ? 0.5
            : this.invulnerable > 0
              ? Math.sin(this.elapsed * 20) > 0.0
                ? 0.3
                : 1
              : 1,
      );
    this.player.setDepth(45 + this.pos.y / 1000);
    // Context belongs in the information rail, never over sprites or cones.
    this.hintText = this.hidden
      ? "E · Leave the hiding spot"
      : this.target
        ? this.used.has(this.target.id)
          ? "✓ " + this.target.label
          : this.target.type === "fun"
            ? "E · Start HR Fun Friday (optional)"
            : "E · " + this.target.label
        : atExit || atAlt
          ? !ready
            ? "Badge and lift switch first. Follow the gold arrow."
            : this.exitBlock > 0
              ? "PM approval in " + Math.ceil(this.exitBlock) + "s"
              : atAlt && !this.wfhActive
                ? "Use 6 · Emergency WFH to approve this exit."
                : "Freedom is this way."
          : this.eventZone &&
              this.elapsed < this.eventUntil &&
              dist(this.pos, this.eventZone) < 62
            ? "Leave the pink fun zone! +5 BS each second."
            : "";
    this.hint.setVisible(false);
    (
      this.children.getByName("spawnLabel") as Phaser.GameObjects.Text
    )?.setVisible(this.elapsed < 2.5);
    this.drawEffects();
    if (this.elapsed > this.hudAt) {
      this.updateHud();
      this.hudAt = this.elapsed + 0.075;
    }
  }
  interact() {
    if (this.ended || this.preview || this.scene.isPaused()) return;
    if (this.hidden) {
      this.hidden = false;
      this.audio.sfx("click");
      return;
    }
    const i = this.target;
    if (!i) {
      emit("toast", {
        title: "NOTHING TO INTERACT WITH",
        text: "Move near a glowing ring. E / Space to interact.",
        duration: 2,
      });
      return;
    }
    if (i.type === "fun") {
      if (this.used.has(i.id)) {
        emit("toast", {
          title: "ENGAGEMENT ALREADY MEASURED",
          text: "HR says five claps per employee per floor. Budget constraints.",
          duration: 3,
        });
        return;
      }
      this.used.add(i.id);
      this.nonRequiredInteractions++;
      emit("fun", { id: i.id });
    } else if (i.type === "hide") {
      this.hidden = true;
      this.nonRequiredInteractions++;
      this.audio.sfx("ability");
      emit("toast", {
        title: "PROFESSIONALLY UNAVAILABLE",
        text: "Hidden. BS slowly fades. E or move to leave.",
        duration: 3,
      });
    } else if (i.type === "switch") {
      if (this.used.has(i.id)) return;
      this.used.add(i.id);
      this.collected.add(i.id);
      if (i.opens) {
        this.obstacles = this.obstacles.filter(
          (o) => !(this.level.gates.find((g) => g.id === i.opens) === o),
        );
        this.nav = new Navigator(
          this.level.width,
          this.level.height,
          this.obstacles,
        );
        this.children.getByName(i.opens)?.destroy();
        this.enemies.forEach((e) => (e.repath = 0));
      }
      this.audio.sfx("item");
      emit("toast", {
        title: "EXIT RELEASED",
        text:
          "You disabled " +
          i.label.toLowerCase() +
          ". Nobody thanked you. Perfect.",
        duration: 4,
      });
    } else if (i.type === "coffee") {
      if ((this.stationTimes[i.id] || 0) > this.elapsed) {
        emit("toast", {
          title: "COFFEE IS BREWING",
          text:
            "Even escape fuel needs " +
            Math.ceil(this.stationTimes[i.id] - this.elapsed) +
            "s.",
          duration: 2,
        });
        return;
      }
      this.stationTimes[i.id] = this.elapsed + 22;
      this.coffee = Math.min(5, this.coffee + 1);
      this.bs = Math.max(0, this.bs - 18);
      this.stamina = 100;
      this.nonRequiredInteractions++;
      this.audio.sfx("coffee");
      emit("toast", {
        title: "FILTER COFFEE > FEEDBACK",
        text: "−18 BS · +1 distraction cup · stamina full.",
        duration: 3,
      });
    } else if (i.type === "distraction") {
      if (this.used.has(i.id)) {
        emit("toast", {
          title: "THE BIT IS EXHAUSTED",
          text: "Corporate distraction is a non-renewable resource.",
          duration: 2,
        });
        return;
      }
      this.used.add(i.id);
      this.nonRequiredInteractions++;
      this.distractions++;
      this.bs = Math.max(0, this.bs - 5);
      this.enemies
        .filter((e) => e.kind === i.target)
        .forEach((e) => {
          e.investigate(i, 10, true);
          e.say(ENEMIES[e.kind].weakness + "? On my way.", this.elapsed);
        });
      this.audio.sfx("ability");
      emit("toast", {
        title: "DISTRACTION SENT",
        text: i.label + " · target occupied for 10 seconds.",
        duration: 3,
      });
    }
    this.updateHud();
  }
  resolveFun(id: string, outcome: FunFriday["result"], seconds: number) {
    if (!this.used.has(id) || this.funCompleted.has(id)) return;
    this.funCompleted.add(id);
    this.elapsed += clamp(seconds, 0, 30);
    this.bs = clamp(this.bs + outcome.bsChange, 0, 100);
    this.coffee = Math.min(5, this.coffee + outcome.coffee);
    this.funScore += outcome.score;
    if (outcome.success) {
      this.distractions++;
      const station = this.level.interactions.find((i) => i.id === id)!;
      this.enemies
        .filter((e) => e.kind === "hr")
        .forEach((e) => {
          const standby =
            [
              { x: station.x + 70, y: station.y },
              { x: station.x - 70, y: station.y },
              { x: station.x, y: station.y - 70 },
              { x: station.x, y: station.y + 70 },
            ].find((p) => !blocked(p, 14, this.obstacles)) || station;
          e.investigate(standby, outcome.distractSeconds, true);
          e.say("That clap has leadership potential.", this.elapsed, 4);
        });
    }
    this.updateHud();
  }
  ability(a: Ability) {
    if (this.ended || this.preview || this.scene.isPaused()) return;
    const def = ABILITIES[a];
    if (this.level.id < def.level) return;
    if ((this.cooldowns[a] || 0) > 0) return;
    if (a === "coffee") {
      if (this.coffee <= 0) {
        emit("toast", {
          title: "OUT OF COFFEE",
          text: "Find a cup or refill at a pantry station.",
          duration: 3,
        });
        return;
      }
      this.coffee--;
      this.coffeeUsed++;
      this.distractions++;
      let target = {
        x: this.pos.x + this.facing.x * 155,
        y: this.pos.y + this.facing.y * 155,
      };
      target.x = clamp(target.x, 36, this.level.width - 36);
      target.y = clamp(target.y, 36, this.level.height - 36);
      for (let t = 1; t >= 0; t -= 0.1) {
        const p = {
          x: this.pos.x + (target.x - this.pos.x) * t,
          y: this.pos.y + (target.y - this.pos.y) * t,
        };
        if (
          !blocked(p, 8, this.obstacles) &&
          visible(this.pos, p, this.obstacles)
        ) {
          target = p;
          break;
        }
      }
      this.enemies
        .filter((e) => dist(e, target) < 350)
        .forEach((e) => {
          e.investigate(target, 7, true);
          e.say("Who filed a spill request?", this.elapsed, 2);
        });
      this.eventZone = this.eventType === "fun" ? this.eventZone : null;
      this.tweens.addCounter({
        from: 0,
        to: 1,
        duration: 450,
        onComplete: () => {},
      });
      emit("toast", {
        title: "COFFEE HAS LEFT THE CHAT",
        text: "Nearby enemies investigate the spill for 7 seconds.",
        duration: 2,
      });
      this.add
        .circle(target.x, target.y, 17, 0xbd8d6e, 0.8)
        .setDepth(18)
        .setName("spill-" + this.elapsed);
      this.audio.sfx("coffee");
    } else if (a === "wfh") {
      if (!this.wfh || this.wfhActive) {
        emit("toast", {
          title: "WFH REQUIRES AN APPROVAL TOKEN",
          text: "Find the purple house pickup first. Then use the purple exit.",
          duration: 3,
        });
        return;
      }
      this.wfh--;
      this.wfhActive = true;
      this.active.wfh = 999;
      emit("toast", {
        title: "WORK FROM ANYWHERE (ELSE)",
        text: "Purple exit approved. Badge + switch still required.",
        duration: 4,
      });
      this.audio.sfx("ability");
    } else {
      this.active[a] = def.duration;
      this.hidden = false;
      if (a === "vpn") {
        this.eventUntil = 0;
        this.exitBlock = 0;
        this.enemies.forEach((e) => {
          e.awareness = 0;
          e.investigate({ x: e.x, y: e.y }, 5, true);
        });
        emit("toast", {
          title: "VPN DISCONNECTED",
          text: "All corporate activity frozen for 5 seconds. “ISP issue.”",
          duration: 3,
        });
      } else
        emit("toast", {
          title: def.name.toUpperCase(),
          text:
            a === "call"
              ? "You: “Yes, valued client.” Intern and founder don’t care."
              : a === "slack"
                ? "Stay STILL. Moving cancels the performance."
                : "No meetings for 7 seconds. Calendar is legally binding.",
          duration: 3,
        });
      this.audio.sfx("ability");
    }
    this.cooldowns[a] = def.cooldown;
    this.updateHud();
  }
  caught(e: OfficeEnemy) {
    if (this.invulnerable > 0) return;
    this.bs = Math.min(100, this.bs + ENEMIES[e.kind].damage);
    this.hits++;
    this.enemiesHit.add(e.kind);
    this.invulnerable = 3;
    this.stamina = Math.max(65, this.stamina);
    this.audio.sfx("caught");
    if (!this.reducedMotion) this.cameras.main.shake(160, 0.003);
    emit("toast", {
      title:
        ENEMIES[e.kind].name.toUpperCase() +
        " · +" +
        ENEMIES[e.kind].damage +
        " BS",
      text:
        ENEMIES[e.kind].quotes[
          Math.floor(this.random() * ENEMIES[e.kind].quotes.length)
        ] + " · 3s escape grace.",
      duration: 3.2,
    });
  }
  corporateEvent() {
    if (this.active.vpn) return;
    let options =
      this.level.id === 1
        ? [EVENTS[0], EVENTS[2]]
        : EVENTS.filter((e) => e.type !== "hands" || this.level.id >= 4);
    const e =
      this.level.id >= 4 && this.eventType === ""
        ? EVENTS[4]
        : options[Math.floor(this.random() * options.length)];
    this.eventType = e.type;
    this.eventUntil = this.elapsed + 9;
    this.eventZone = null;
    if (e.type === "slack")
      this.enemies
        .filter((e) => e.kind === "manager")
        .forEach((e) => e.investigate({ x: e.x, y: e.y }, 8, true));
    if (e.type === "pizza") {
      const pantry = this.level.interactions.find((i) => i.type === "coffee");
      if (pantry) this.enemies.forEach((e) => e.investigate(pantry, 8, true));
    }
    if (e.type === "hands") {
      this.audio.sfx("founder");
      this.enemies.forEach((e) => {
        e.repath = 0;
        e.routeIndex = (e.routeIndex + 1) % e.route.length;
      });
    }
    if (e.type === "scope") this.exitBlock = 8;
    if (e.type === "fun") {
      const hr = this.enemies.find((e) => e.kind === "hr");
      this.eventZone = hr ? { x: hr.x, y: hr.y } : { x: 550, y: 420 };
    }
    emit("toast", { title: e.title, text: e.text, duration: 4 });
  }
  drawEffects() {
    const g = this.cones;
    g.clear();
    for (const e of this.enemies) {
      if (this.active.vpn || e.state === "distracted") continue;
      const d = ENEMIES[e.kind],
        range =
          d.range *
          (this.eventType === "hands" && this.elapsed < this.eventUntil
            ? 1.2
            : 1);
      const pts: Phaser.Math.Vector2[] = [new Phaser.Math.Vector2(e.x, e.y)];
      for (
        let a = e.angle - d.fov / 2;
        a <= e.angle + d.fov / 2 + 0.01;
        a += d.fov / 30
      ) {
        let max = range;
        for (let r = 12; r < range; r += 9) {
          const p = { x: e.x + Math.cos(a) * r, y: e.y + Math.sin(a) * r };
          if (blocked(p, 1, this.obstacles)) {
            max = r - 5;
            break;
          }
        }
        pts.push(
          new Phaser.Math.Vector2(
            e.x + Math.cos(a) * max,
            e.y + Math.sin(a) * max,
          ),
        );
      }
      g.fillStyle(
        e.state === "chase" ? 0xff6b73 : d.color,
        e.awareness > 0.1 ? 0.17 : 0.075,
      );
      g.fillPoints(pts, true);
      if (e.awareness > 0.03) {
        g.lineStyle(3, e.awareness > 0.65 ? 0xff7379 : 0xffd580, 0.9);
        g.beginPath();
        g.arc(
          e.x,
          e.y,
          25,
          -Math.PI / 2,
          -Math.PI / 2 + Math.PI * 2 * e.awareness,
        );
        g.strokePath();
      }
    }
    const m = this.markers;
    m.clear();
    for (const i of this.level.interactions) {
      const used = this.used.has(i.id),
        color =
          i.type === "hide"
            ? 0xc0abf3
            : i.type === "switch"
              ? 0x9cf1c6
              : i.type === "coffee"
                ? 0xf2c795
                : i.type === "fun"
                  ? 0xf5a9d0
                  : 0x82cfee;
      m.lineStyle(
        used ? 1 : 2,
        color,
        used ? 0.25 : 0.55 + Math.sin(this.elapsed * 3) * 0.12,
      ).strokeCircle(i.x, i.y, i.type === "hide" ? 20 : 16);
      m.lineStyle(2, color, used ? 0.3 : 1);
      if (i.type === "switch") {
        m.strokeRect(i.x - 5, i.y - 6, 10, 12);
        m.lineBetween(i.x, i.y - 3, i.x, i.y + 3);
      } else if (i.type === "hide") {
        m.lineBetween(i.x - 6, i.y, i.x, i.y - 5)
          .lineBetween(i.x, i.y - 5, i.x + 6, i.y)
          .strokeRect(i.x - 4, i.y, 8, 7);
      } else if (i.type === "coffee") {
        m.strokeRect(i.x - 5, i.y - 5, 8, 10).strokeRect(
          i.x + 3,
          i.y - 3,
          4,
          5,
        );
      } else if (i.type === "fun") {
        m.strokeRect(i.x - 8, i.y - 7, 5, 12)
          .strokeRect(i.x + 3, i.y - 7, 5, 12)
          .lineBetween(i.x - 1, i.y - 10, i.x + 1, i.y - 15);
      } else {
        m.strokeCircle(i.x, i.y - 3, 4).lineBetween(i.x, i.y + 3, i.x, i.y + 6);
      }
    }
    const ready = this.level.required.every(
      (i) => this.collected.has(i) || this.used.has(i),
    );
    const ec = center(this.level.exit);
    m.lineStyle(
      3,
      ready ? 0xa7ffcc : 0xffcc79,
      0.6 + Math.sin(this.elapsed * 4) * 0.25,
    ).strokeRoundedRect(
      this.level.exit.x - 5,
      this.level.exit.y - 5,
      this.level.exit.w + 10,
      this.level.exit.h + 10,
      4,
    );
    if (this.eventZone && this.elapsed < this.eventUntil) {
      m.fillStyle(0xff7ebc, 0.15).fillCircle(
        this.eventZone.x,
        this.eventZone.y,
        62,
      );
      m.lineStyle(3, 0xff7ebc, 0.8).strokeCircle(
        this.eventZone.x,
        this.eventZone.y,
        62,
      );
    }
    this.fx.clear();
    if (
      this.active.call ||
      this.active.calendar ||
      this.active.slack ||
      this.active.vpn
    ) {
      this.fx
        .lineStyle(
          2,
          this.active.vpn
            ? 0x91cbff
            : this.active.calendar
              ? 0xffd584
              : 0xb0f9d0,
          0.8,
        )
        .strokeCircle(this.pos.x, this.pos.y, 26);
    }
    if (this.lastSprinting) {
      this.fx
        .lineStyle(1, 0xe6e6d4, 0.4)
        .lineBetween(
          this.pos.x - this.facing.x * 18,
          this.pos.y - this.facing.y * 18,
          this.pos.x - this.facing.x * 30,
          this.pos.y - this.facing.y * 30,
        );
    }
    // A small on-world breadcrumb points to the next unfinished objective, not through walls.
    const next = this.level.required.find(
      (i) => !this.collected.has(i) && !this.used.has(i),
    );
    const goal: Point = next
      ? this.level.items.find((i) => i.id === next) ||
        this.level.interactions.find((i) => i.id === next) ||
        ec
      : ec;
    if (dist(this.pos, goal) > 75) {
      const a = Math.atan2(goal.y - this.pos.y, goal.x - this.pos.x),
        x = this.pos.x + Math.cos(a) * 40,
        y = this.pos.y + Math.sin(a) * 40;
      this.fx
        .fillStyle(0xfce2a0, 0.9)
        .fillTriangle(
          x + Math.cos(a) * 7,
          y + Math.sin(a) * 7,
          x + Math.cos(a + 2.5) * 6,
          y + Math.sin(a + 2.5) * 6,
          x + Math.cos(a - 2.5) * 6,
          y + Math.sin(a - 2.5) * 6,
        );
    }
    for (const [id, obj] of this.itemObjects)
      if (!this.collected.has(id))
        obj.setY(
          (this.level.items.find((i) => i.id === id)?.y || 0) +
            Math.sin(this.elapsed * 3 + id.length) * 2,
        );
  }
  updateHud() {
    const objectives = this.level.required.map((id) => ({
      id,
      label: this.level.items.find((i) => i.id === id)
        ? "Collect your badge"
        : this.level.interactions.find((i) => i.id === id)?.label || id,
      done: this.collected.has(id) || this.used.has(id),
    }));
    emit("hud", {
      level: this.level.id,
      name: this.level.name,
      elapsed: this.elapsed,
      bs: this.bs,
      stamina: this.stamina,
      coffee: this.coffee,
      wfh: this.wfh,
      wfhActive: this.wfhActive,
      hidden: this.hidden,
      active: { ...this.active },
      cooldowns: { ...this.cooldowns },
      objectives,
      spots: this.spots,
      collectibles: this.collectibles,
      ready: objectives.every((i) => i.done),
      target: this.target?.label || "",
      suspicion: Math.max(0, ...this.enemies.map((e) => e.awareness)),
      daily: this.options.daily,
      seed: this.options.seed,
      context: this.hintText,
      dialogue:
        this.enemies
          .filter((e) => this.elapsed < e.quoteUntil && dist(e, this.pos) < 260)
          .sort((a, b) => dist(a, this.pos) - dist(b, this.pos))
          .map((e) => ({
            speaker: ENEMIES[e.kind].name,
            text: e.quote,
            color: ENEMIES[e.kind].color,
          }))[0] || null,
    });
  }
  finish(win: boolean, alt = false) {
    if (this.ended) return;
    this.ended = true;
    this.won = win;
    this.audio.sfx(win ? "exit" : "fail");
    if (win) this.audio.music("victory");
    const score =
      scoreRun(
        this.elapsed,
        this.level.par,
        this.spots,
        this.hits,
        this.collectibles,
        this.distractions,
        this.bs,
      ) +
      this.funScore * 2;
    const result: Result = {
      level: this.level.id,
      time: Math.round(this.elapsed * 10) / 10,
      bs: Math.round(this.bs),
      spots: this.spots,
      hits: this.hits,
      collectibles: this.collectibles,
      distractions: this.distractions,
      score,
      funScore: this.funScore,
      medal: medal(score, this.spots, this.hits, this.elapsed, this.level.par),
      daily: this.options.daily,
      seed: this.options.seed,
    };
    const earned: string[] = [];
    if (this.spots === 0) earned.push("ghost");
    if (
      this.level.id === 1 &&
      this.hits === 0 &&
      this.nonRequiredInteractions === 0
    )
      earned.push("email");
    if (this.level.id === 2 && !this.enemiesHit.has("hr"))
      earned.push("culture");
    if (this.internTime >= 12) earned.push("yap");
    if (this.elapsed < 45) earned.push("speed");
    if (this.level.id === 5 && this.hits === 0) earned.push("founder");
    if (this.bluffs >= 3) earned.push("busy");
    if (this.level.id === 5) earned.push("all");
    if (
      this.collectibles ===
      this.level.items.filter((i) => i.kind === "laptop").length
    )
      earned.push("laptop");
    if (alt) earned.push("wfh");
    if (this.options.daily) earned.push("daily");
    if (this.coffeeUsed >= 3) earned.push("kaapi");
    if (win) {
      const r = alt ? this.level.altExit! : this.level.exit;
      const c = center(r);
      for (let i = 0; i < 36; i++) {
        const pixel = this.add
          .rectangle(
            c.x,
            c.y,
            4 + this.random() * 4,
            4,
            [0xa6f4cd, 0xffd682, 0xbd9bfc][i % 3],
          )
          .setDepth(100);
        this.tweens.add({
          targets: pixel,
          x: c.x + (this.random() - 0.5) * 240,
          y: c.y + (this.random() - 0.5) * 220,
          angle: 180,
          alpha: 0,
          duration: this.reducedMotion ? 10 : 900,
          onComplete: () => pixel.destroy(),
        });
      }
      this.tweens.add({
        targets: this.player,
        x: c.x,
        y: c.y,
        alpha: 0,
        scaleX: 0.4,
        scaleY: 0.4,
        duration: this.reducedMotion ? 10 : 600,
      });
    } else {
      this.player.setTint(0xff8a91);
      if (!this.reducedMotion) this.cameras.main.shake(350, 0.006);
    }
    this.time.delayedCall(win && !this.reducedMotion ? 850 : 250, () =>
      emit("end", { win, result, earned: win ? earned : [], alt }),
    );
    this.updateHud();
  }
  snapshot() {
    return {
      level: this.level.id,
      pos: { ...this.pos },
      elapsed: this.elapsed,
      bs: this.bs,
      stamina: this.stamina,
      spots: this.spots,
      hits: this.hits,
      hidden: this.hidden,
      ended: this.ended,
      collected: [...this.collected],
      used: [...this.used],
      coffee: this.coffee,
      funScore: this.funScore,
      funCompleted: [...this.funCompleted],
      active: { ...this.active },
      cooldowns: { ...this.cooldowns },
      target: this.target?.id,
      enemies: this.enemies.map((e) => ({
        kind: e.kind,
        x: e.x,
        y: e.y,
        state: e.state,
        awareness: e.awareness,
      })),
      objectives: this.level.required,
      obstacles: this.obstacles.map((o) => ({ ...o })),
    };
  }
}
