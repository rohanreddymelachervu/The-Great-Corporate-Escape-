import type { HitEvent, HitKind } from "../game/types";
import "./hit-scenes.css";

type Options = {
  container: HTMLElement;
  event: HitEvent;
  longHaul: boolean;
  reducedMotion: boolean;
  sprites: Record<string, CanvasImageSource>;
  onDone: () => void;
};

const INK = "#171c31",
  NAVY = "#101625",
  WALL = "#29324b";
const MINT = "#a3f7cf",
  CORAL = "#f08687",
  CREAM = "#e3d8cf";
const GOLD = "#f0ce7b",
  LILAC = "#b3a0e1",
  TEAL = "#639b9d";
const DURATION: Record<HitKind, readonly [number, number]> = {
  photo: [1450, 3500],
  meeting: [1350, 3400],
  yap: [1450, 3700],
  paper: [1500, 3600],
  allhands: [1550, 3800],
  scope: [1450, 3700],
  gossip: [1400, 3500],
  door: [1300, 3300],
};
const LABEL: Record<HitKind, string> = {
  photo: "CULTURE CAPTURE",
  meeting: "CALENDAR AMBUSH",
  yap: "AGENTIC MONOLOGUE",
  paper: "FORMS & CONSEQUENCES",
  allhands: "MANDATORY INSPIRATION",
  scope: "ONE TINY REQUIREMENT",
  gossip: "LOCATION SHARED",
  door: "JUST ONE QUICK QUESTION",
};
const clamp = (n: number) => Math.max(0, Math.min(1, n));
const phase = (p: number, start: number, end: number) =>
  clamp((p - start) / (end - start));
const ease = (n: number) => 1 - (1 - clamp(n)) ** 3;
const mix = (a: number, b: number, n: number) => a + (b - a) * n;

/** Self-contained presentation. The caller owns simulation pause/resume and focus on return.
 * Returned cancellation is silent; natural completion and intentional skips call onDone once.
 */
export function playHitScene(options: Options): () => void {
  const { container, event, longHaul, reducedMotion, sprites, onDone } =
    options;
  const duration = DURATION[event.kind][longHaul ? 1 : 0];
  const overlay = document.createElement("div");
  overlay.className = `hit-scene${reducedMotion ? " hit-scene--reduced" : ""}`;
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute(
    "aria-label",
    `${event.title || LABEL[event.kind]}. Office paused. Press E, Space, Enter or Escape to skip.`,
  );
  const panel = document.createElement("section");
  panel.className = "hit-scene__panel";
  const header = document.createElement("header");
  header.className = "hit-scene__header";
  const eyebrow = document.createElement("span");
  eyebrow.className = "hit-scene__eyebrow";
  eyebrow.textContent = `OFFICE INTERRUPTION / ${event.kind.toUpperCase()}`;
  const title = document.createElement("h2");
  title.textContent = event.title || LABEL[event.kind];
  header.append(eyebrow, title);
  const stage = document.createElement("div");
  stage.className = "hit-scene__stage";
  const canvas = document.createElement("canvas");
  canvas.width = 640;
  canvas.height = 280;
  canvas.setAttribute("aria-hidden", "true");
  stage.append(canvas);
  const footer = document.createElement("footer");
  footer.className = "hit-scene__footer";
  const copy = document.createElement("div");
  copy.className = "hit-scene__copy";
  const text = document.createElement("p");
  text.className = "hit-scene__caption";
  text.textContent = event.text || LABEL[event.kind];
  const hint = document.createElement("p");
  hint.className = "hit-scene__hint";
  hint.textContent = "OFFICE PAUSED · E / TAP TO SKIP";
  copy.append(text, hint);
  const skip = document.createElement("button");
  skip.type = "button";
  skip.className = "hit-scene__skip";
  skip.textContent = "SKIP ›";
  skip.setAttribute("aria-label", "Skip interruption and return to the office");
  footer.append(copy, skip);
  panel.append(header, stage, footer);
  overlay.append(panel);
  container.append(overlay);

  let active = true,
    elapsed = 0,
    previous = performance.now(),
    frame = 0;
  const ctx = canvas.getContext("2d");
  const paint = ctx
    ? createPainter(ctx, sprites, reducedMotion, longHaul)
    : null;
  const block = (e: Event) => {
    e.stopImmediatePropagation();
    if (e.cancelable) e.preventDefault();
  };
  const cleanup = () => {
    if (!active) return;
    active = false;
    cancelAnimationFrame(frame);
    window.removeEventListener("keydown", key, true);
    window.removeEventListener("keyup", keyUp, true);
    document.removeEventListener("visibilitychange", visibility);
    overlay.removeEventListener("pointerdown", block);
    overlay.removeEventListener("pointerup", block);
    overlay.removeEventListener("touchmove", block);
    overlay.removeEventListener("wheel", block);
    skip.removeEventListener("click", clicked);
    overlay.removeEventListener("click", block);
    overlay.remove();
    // No focus restoration: the orchestrator returns focus to the game.
  };
  const finish = () => {
    if (!active) return;
    cleanup();
    onDone();
  };
  const canSkip = () => elapsed >= 250 && !document.hidden;
  function key(e: KeyboardEvent) {
    block(e);
    if (e.key === "Tab") {
      skip.focus({ preventScroll: true });
      return;
    }
    const name = e.key.toLowerCase();
    if (
      !e.repeat &&
      canSkip() &&
      ["e", " ", "enter", "escape", "spacebar"].includes(name)
    )
      finish();
  }
  function keyUp(e: KeyboardEvent) {
    block(e);
  }
  function clicked(e: MouseEvent) {
    block(e);
    if (canSkip()) finish();
  }
  function visibility() {
    previous = performance.now();
  }
  function tick(now: number) {
    if (!active) return;
    if (!document.hidden) elapsed += Math.max(0, now - previous);
    previous = now;
    const p = clamp(elapsed / duration);
    if (paint) paint(event.kind, p, elapsed);
    if (elapsed >= duration) {
      finish();
      return;
    }
    frame = requestAnimationFrame(tick);
  }
  window.addEventListener("keydown", key, true);
  window.addEventListener("keyup", keyUp, true);
  document.addEventListener("visibilitychange", visibility);
  overlay.addEventListener("pointerdown", block);
  overlay.addEventListener("pointerup", block);
  overlay.addEventListener("touchmove", block, { passive: false });
  overlay.addEventListener("wheel", block, { passive: false });
  skip.addEventListener("click", clicked);
  overlay.addEventListener("click", block);
  skip.focus({ preventScroll: true });
  frame = requestAnimationFrame(tick);
  return cleanup;
}

/** All art is drawn locally: original cast sprites plus deliberately chunky pixel props. */
function createPainter(
  ctx: CanvasRenderingContext2D,
  sprites: Record<string, CanvasImageSource>,
  reduced: boolean,
  long: boolean,
) {
  let time = 0;
  // Cache unavailable/invalid sources once instead of throwing every frame.
  const missing = new Set<string>();
  const rect = (x: number, y: number, w: number, h: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  };
  const line = (
    x: number,
    y: number,
    x2: number,
    y2: number,
    color: string,
    width = 2,
  ) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(Math.round(x), Math.round(y));
    ctx.lineTo(Math.round(x2), Math.round(y2));
    ctx.stroke();
  };
  const words = (
    text: string,
    x: number,
    y: number,
    color = CREAM,
    size = 12,
    align: CanvasTextAlign = "left",
  ) => {
    ctx.fillStyle = color;
    ctx.font = `bold ${size}px monospace`;
    ctx.textAlign = align;
    ctx.fillText(text, Math.round(x), Math.round(y));
  };
  const box = (
    x: number,
    y: number,
    w: number,
    h: number,
    color = WALL,
    edge = TEAL,
  ) => {
    rect(x - 2, y - 2, w + 4, h + 4, edge);
    rect(x, y, w, h, color);
  };
  const progress = (p: number, a: number, b: number) => {
    const n = phase(p, a, b);
    return reduced ? Math.floor(n * 5) / 5 : ease(n);
  };
  function person(
    kind: string,
    x: number,
    floor: number,
    opts: {
      walk?: boolean;
      face?: number;
      gesture?: boolean;
      scale?: number;
      alpha?: number;
    } = {},
  ) {
    const scale = opts.scale ?? 2.5,
      w = 24 * scale,
      h = 32 * scale;
    const bob = reduced
      ? 0
      : opts.walk
        ? Math.sin(time / 70) * 2
        : Math.sin(time / 230 + x) * 0.7;
    const face = opts.face ?? 1;
    ctx.save();
    ctx.globalAlpha = opts.alpha ?? 1;
    rect(x - w * 0.38, floor - 3, w * 0.76, 5, "#10162580");
    ctx.translate(Math.round(x), Math.round(floor - h + bob));
    ctx.scale(face, 1);
    const source = sprites[kind];
    let drawn = false;
    if (source && !missing.has(kind)) {
      try {
        ctx.drawImage(source, -w / 2, 0, w, h);
        drawn = true;
      } catch {
        missing.add(kind);
      }
    }
    if (!drawn) {
      rect(-w * 0.22, 3, w * 0.44, h * 0.27, CREAM);
      rect(-w * 0.25, 0, w * 0.5, h * 0.1, INK);
      rect(
        -w * 0.3,
        h * 0.3,
        w * 0.6,
        h * 0.4,
        kind === "player" ? MINT : kind === "hr" ? TEAL : CORAL,
      );
      rect(-w * 0.25, h * 0.7, w * 0.2, h * 0.3, INK);
      rect(w * 0.05, h * 0.7, w * 0.2, h * 0.3, INK);
      rect(w * 0.1, h * 0.12, 3, 3, INK);
    }
    if (opts.walk) {
      const foot = reduced ? 0 : Math.sin(time / 65) * 5;
      rect(-w * 0.28 + foot, h - 5, 12, 5, INK);
      rect(w * 0.05 - foot, h - 5, 12, 5, INK);
    }
    if (opts.gesture) {
      const hand = reduced ? -3 : Math.sin(time / 150) * 4;
      rect(w * 0.23, h * 0.43 + hand, 17, 7, CREAM);
      rect(w * 0.43, h * 0.35 + hand, 6, 13, CREAM);
    }
    ctx.restore();
  }
  function bubble(
    text: string,
    x: number,
    y: number,
    color = MINT,
    width = 100,
  ) {
    box(x, y, width, 27, INK, color);
    rect(x + 12, y + 27, 8, 6, color);
    words(text, x + width / 2, y + 18, color, 12, "center");
  }
  function paper(x: number, y: number, angle: number, label = "FORM") {
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    ctx.rotate(reduced ? 0 : angle);
    rect(-17, -23, 35, 46, INK);
    rect(-15, -21, 30, 41, CREAM);
    rect(-10, -14, 19, 4, CORAL);
    for (let row = 0; row < 3; row++)
      rect(-10, -4 + row * 6, 18 - row * 3, 2, TEAL);
    words(label, 0, 16, INK, 6, "center");
    ctx.restore();
  }
  function room(label: string) {
    rect(0, 0, 640, 280, WALL);
    rect(0, 200, 640, 80, "#354855");
    rect(0, 197, 640, 4, TEAL);
    for (let x = 0; x < 640; x += 64) line(x, 202, x - 40, 280, "#293e4b");
    line(0, 240, 640, 240, "#293e4b");
    words(label, 20, 25, TEAL, 10);
  }
  function balloon(x: number, y: number, color: string) {
    const drift = reduced ? 0 : Math.sin(time / 300 + x) * 3;
    line(x + drift, y + 24, x, y + 95, CREAM, 1);
    rect(x - 9 + drift, y, 18, 25, color);
    rect(x - 14 + drift, y + 6, 28, 13, color);
    rect(x - 6 + drift, y + 3, 4, 8, CREAM);
  }
  const scenes: Record<HitKind, (p: number) => void> = {
    photo(p) {
      room("PEOPLE OPERATIONS / MEMORIES ARE MANDATORY");
      box(95, 39, 320, 126, "#344157", CORAL);
      words("WE CHOSE TO BE HERE", 255, 67, CREAM, 15, "center");
      words("COMPANY PHOTO / FRIDAY 17:59", 255, 88, MINT, 10, "center");
      balloon(119, 97, CORAL);
      balloon(399, 94, MINT);
      const lineup = progress(p, 0.03, 0.37),
        pose = p > 0.4;
      const px = mix(60, 265, lineup);
      person("player", px, 231, { walk: lineup < 1, face: pose ? 1 : -1 });
      person("hr", mix(130, 190, lineup), 232, {
        walk: lineup < 1,
        gesture: true,
      });
      person("manager", mix(430, 342, lineup), 230, {
        walk: lineup < 1,
        face: -1,
      });
      // A tripod camera, aimed at the lineup, slides into frame.
      const cx = mix(670, 535, progress(p, 0.15, 0.48));
      line(cx, 174, cx - 25, 237, INK, 5);
      line(cx, 174, cx + 25, 237, INK, 5);
      line(cx, 174, cx, 235, INK, 4);
      box(cx - 33, 133, 65, 38, INK, TEAL);
      rect(cx - 13, 139, 28, 26, TEAL);
      rect(cx - 6, 146, 14, 12, NAVY);
      rect(cx - 20, 126, 20, 8, CREAM);
      if (p > 0.43 && p < 0.68) bubble("SMILE. PLEASE.", 161, 103, CORAL, 125);
      // Exactly one flash window; no strobe, and never flash in reduced-motion mode.
      if (!reduced && p > 0.67 && p < 0.71) rect(0, 0, 640, 280, "#fff9e0b0");
      if (p >= 0.71) {
        const drop = progress(p, 0.71, 0.86);
        ctx.save();
        ctx.translate(440, mix(-70, 73, drop));
        ctx.rotate(reduced ? 0 : -0.1);
        box(-55, -42, 110, 87, CREAM, INK);
        rect(-47, -34, 94, 53, TEAL);
        person("hr", -24, 16, { scale: 1.1 });
        person("player", 2, 16, { scale: 1.1 });
        person("manager", 27, 16, { scale: 1.1 });
        words("CULTURE: PROVEN", 0, 34, INK, 9, "center");
        ctx.restore();
      }
      if (long && p > 0.87)
        bubble("ONE MORE FOR LINKEDIN", 152, 106, MINT, 196);
    },
    meeting(p) {
      room("MANAGER / THIS COULD HAVE BEEN AN EMAIL");
      const slide = progress(p, 0.03, 0.38);
      person("player", mix(90, 260, slide), 235, { walk: slide < 1 });
      person("manager", mix(560, 410, slide), 231, {
        walk: slide < 1,
        face: -1,
        gesture: true,
      });
      for (const [dest, from] of [
        [248, -60],
        [398, 700],
      ]) {
        const x = mix(from, dest, slide);
        box(x - 24, 168, 46, 46, "#514968", LILAC);
        rect(x - 26, 213, 52, 8, INK);
        rect(x - 22, 219, 6, 30, INK);
        rect(x + 15, 219, 6, 30, INK);
      }
      const tx = mix(-420, 145, slide);
      rect(tx + 23, 220, 10, 50, INK);
      rect(tx + 291, 220, 10, 50, INK);
      box(tx, 205, 333, 18, "#956e71", "#c69c93");
      // Agenda pages stack upward while calendar blocks occupy the whole week.
      const count = Math.floor(phase(p, 0.32, 0.9) * (long ? 13 : 8));
      for (let i = 0; i < count; i++) {
        box(304 + (i % 2) * 3, 194 - i * 6, 67, 5, CREAM, INK);
      }
      if (count)
        words("AGENDA", 337, 184 - (count - 1) * 6, CORAL, 9, "center");
      box(50, 44, 143, 84, INK, TEAL);
      words("YOUR WEEK", 121, 61, MINT, 10, "center");
      for (let i = 0; i < 15; i++) {
        const filled = i < Math.floor(phase(p, 0.35, 0.94) * 16);
        rect(
          59 + (i % 5) * 26,
          70 + Math.floor(i / 5) * 17,
          22,
          13,
          filled ? CORAL : WALL,
        );
      }
      if (p > 0.56)
        bubble(
          long && p > 0.8 ? "LET'S BOOK A FOLLOW-UP" : "QUICK SYNC?",
          379,
          74,
          CORAL,
          long && p > 0.8 ? 203 : 115,
        );
    },
    yap(p) {
      room("INTERN / THE AUTOMATION HAS DEVELOPED A MONOLOGUE");
      person("intern", mix(64, 139, progress(p, 0, 0.25)), 242, {
        walk: p < 0.25,
        gesture: true,
      });
      person("player", 335, 234, { face: p > 0.46 ? -1 : 1 });
      const points = [
        [203, 53],
        [390, 48],
        [465, 139],
        [286, 124],
        [55, 117],
        [447, 213],
        [189, 211],
      ];
      const n = Math.floor(phase(p, 0.1, 0.83) * (long ? 7 : 5));
      for (let i = 0; i < n; i++) {
        const [x, y] = points[i];
        if (i > 0) {
          const [lx, ly] = points[i - 1];
          line(lx + 52, ly + 14, x + 48, y + 14, LILAC, 3);
        }
        const arrive = progress(p, 0.1 + i * 0.09, 0.2 + i * 0.09);
        const yy = y + (1 - arrive) * (reduced ? 0 : 25);
        box(x, yy, 105, 38, INK, i % 2 ? MINT : LILAC);
        words("AGENT", x + 52, yy + 19, i % 2 ? MINT : LILAC, 13, "center");
        rect(x + 12, yy + 27, 66, 2, TEAL);
        rect(x + 14, yy + 40, 76, 4, INK);
        if (i < n - 1) words(">", x + 111, yy + 23, CORAL, 20);
      }
      if (p > 0.76)
        bubble(
          long ? "IT TALKS TO ANOTHER AGENT" : "BUT WHO DOES THE WORK?",
          198,
          13,
          CORAL,
          long ? 230 : 209,
        );
    },
    paper(p) {
      room("PRINTER / PLEASE COMPLETE THE REQUIRED REQUIREMENTS");
      person("player", 370, 239, { face: -1, gesture: p > 0.62 });
      person("staff", 106, 236, { gesture: true });
      box(133, 143, 97, 77, "#718696", INK);
      box(145, 118, 71, 29, CREAM, INK);
      rect(144, 160, 76, 12, INK);
      rect(149, 187, 66, 26, WALL);
      rect(211, 148, 8, 6, MINT);
      const n = long ? 32 : 20;
      // Each form follows its own launch + gravity arc, then stays in the heap.
      for (let i = 0; i < n; i++) {
        const birth = 0.08 + (i / n) * 0.68,
          age = (p - birth) / 0.22;
        if (age < 0) continue;
        const seed = ((i * 37) % 97) / 97;
        const landingX = 322 + seed * 136;
        const landingY = 245 - Math.floor(i / 4) * (long ? 12 : 18);
        const t = Math.min(1, age);
        let x = mix(203, landingX, t);
        let y = mix(156, landingY, t) - Math.sin(t * Math.PI) * 115;
        if (reduced) {
          const step = Math.floor(t * 3) / 3;
          x = mix(203, landingX, step);
          y = mix(156, landingY, step);
        }
        paper(
          x,
          y,
          (seed - 0.5) * 0.7 + (age < 1 ? age * 2 : 0),
          i % 3 === 0 ? "URGENT" : "FORM",
        );
      }
      if (p > 0.8) {
        bubble("JUST ONE SIGNATURE", 64, 62, CORAL, 175);
        words("IN TRIPLICATE.", 340, 60, MINT, 13);
      }
    },
    allhands(p) {
      room("FOUNDER / ATTENDANCE IS A CORE VALUE");
      rect(168, 203, 456, 77, INK);
      rect(168, 203, 456, 9, CORAL);
      // One warm spotlight, never a flash.
      ctx.fillStyle = "#f0ce7b28";
      ctx.beginPath();
      ctx.moveTo(422, 0);
      ctx.lineTo(316, 211);
      ctx.lineTo(555, 211);
      ctx.closePath();
      ctx.fill();
      box(197, 40, 151, 114, NAVY, TEAL);
      words("THE VISION", 272, 59, GOLD, 12, "center");
      line(213, 135, 329, 135, TEAL);
      line(213, 135, 213, 71, TEAL);
      const rise = progress(p, 0.12, 0.65);
      for (let i = 0; i < 4; i++)
        rect(
          227 + i * 25,
          131 - (12 + i * 16) * rise,
          15,
          (12 + i * 16) * rise,
          i === 3 ? CORAL : MINT,
        );
      person("founder", mix(654, 439, progress(p, 0.02, 0.3)), 203, {
        walk: p < 0.3,
        gesture: true,
        scale: 2.9,
        face: -1,
      });
      rect(395, 170, 87, 38, "#956e71");
      rect(399, 169, 79, 6, GOLD);
      line(426, 170, 426, 150, INK, 3);
      rect(421, 147, 12, 6, INK);
      person("player", 99, 255, { face: p > 0.4 ? -1 : 1 });
      person("staff", 192, 282, { scale: 1.7 });
      person("manager", 270, 282, { scale: 1.7 });
      if (long && p > 0.5) {
        rect(201, 64, 142, 83, NAVY);
        words("DO MORE", 271, 96, MINT, 17, "center");
        words("WITH LESS", 271, 122, CORAL, 17, "center");
      }
      if (p > 0.65) {
        const stamp = progress(p, 0.65, 0.8);
        ctx.save();
        ctx.translate(420, mix(-55, 69, stamp));
        ctx.rotate(reduced ? 0 : -0.13);
        box(-108, -22, 216, 44, INK, CORAL);
        words("WE ARE FAMILY", 0, 7, CORAL, 22, "center");
        ctx.restore();
      }
      if (long && p > 0.85) bubble("NO, NOT THE PAY KIND", 347, 112, GOLD, 204);
    },
    scope(p) {
      room("PRODUCT / THE ROADMAP HAS NO OUTER EDGE");
      person("pm", mix(78, 139, progress(p, 0.02, 0.25)), 236, {
        walk: p < 0.25,
        gesture: true,
      });
      person("player", mix(480, 548, progress(p, 0.5, 0.9)), 239, {
        walk: p > 0.5 && p < 0.9,
        face: -1,
      });
      const width = mix(20, 417, progress(p, 0.08, 0.76));
      box(173, 79, width, 105, CREAM, INK);
      ctx.save();
      ctx.beginPath();
      ctx.rect(174, 80, width - 1, 103);
      ctx.clip();
      words("MVP ROADMAP", 185, 98, INK, 11);
      line(185, 139, 650, 139, TEAL, 4);
      const notes = long ? 18 : 11;
      for (let i = 0; i < notes; i++) {
        const visible = phase(p, 0.15 + i * 0.033, 0.22 + i * 0.033);
        if (!visible) continue;
        const x = 186 + (i % 9) * 46,
          target = 108 + Math.floor(i / 9) * 37;
        const y = mix(target - 36, target, reduced ? 1 : ease(visible));
        box(x, y, 37, 28, i % 3 ? GOLD : CORAL, INK);
        words(
          ["SSO", "AI", "V2", "ASAP", "CRM", "API"][i % 6],
          x + 18,
          y + 12,
          INK,
          8,
          "center",
        );
        rect(x + 5, y + 17, 25, 2, INK);
      }
      ctx.restore();
      // The rolled edge keeps travelling beyond the nominal "MVP".
      rect(172 + width, 72, 14, 119, "#c69c93");
      rect(175 + width, 75, 6, 113, CREAM);
      if (p > 0.5)
        bubble(
          long && p > 0.82 ? "ALSO, MAKE IT SOCIAL" : "TINY CHANGE",
          70,
          37,
          CORAL,
          long && p > 0.82 ? 196 : 119,
        );
      if (p > 0.8) words("PHASE 1 OF ...", 347, 216, MINT, 13, "center");
    },
    gossip(p) {
      room("OFFICE TELEMETRY / SEEN AT YOUR LAST KNOWN LOCATION");
      // A schematic office is the stage itself, not a generic chat backdrop.
      for (const [x, y, w, h] of [
        [25, 42, 176, 98],
        [231, 42, 167, 98],
        [428, 42, 183, 98],
        [25, 167, 176, 84],
        [428, 167, 183, 84],
      ]) {
        box(x, y, w, h, "#263c48", TEAL);
        rect(x + 19, y + 22, 47, 20, WALL);
        rect(x + w - 70, y + 22, 47, 20, WALL);
      }
      person("player", 309, 225, { face: p > 0.45 ? -1 : 1 });
      person("gossip", mix(105, 185, progress(p, 0.02, 0.25)), 230, {
        walk: p < 0.25,
        gesture: true,
      });
      const pin = progress(p, 0.15, 0.4);
      const py = mix(-45, 87, pin);
      rect(294, py, 31, 27, CORAL);
      rect(301, py + 26, 17, 11, CORAL);
      rect(306, py + 37, 7, 7, CORAL);
      rect(303, py + 7, 13, 12, NAVY);
      const nodes = [
        [83, 130],
        [265, 128],
        [480, 128],
        [567, 249],
        [79, 248],
        [552, 124],
      ];
      const n = Math.floor(phase(p, 0.3, 0.87) * (long ? 6 : 4));
      for (let i = 0; i < n; i++) {
        const [x, y] = nodes[i];
        line(309, 140, x, y - 24, "#f0868770", 2);
        person(i % 2 ? "staff" : "gossip", x, y, {
          scale: 1.6,
          gesture: true,
          face: x > 310 ? -1 : 1,
        });
        bubble(
          i === 0 ? "@channel" : "SEEN!",
          x - 40,
          y - 85,
          i % 2 ? MINT : CORAL,
          82,
        );
      }
      if (p > 0.74) bubble("LOCATION: EVERYONE KNOWS", 204, 12, CORAL, 228);
    },
    door(p) {
      room("MEETING ROOM / THE DOOR WAS A TRAP");
      box(352, 31, 170, 211, NAVY, TEAL);
      words("QUICK QUESTION", 437, 22, MINT, 12, "center");
      // Door rotates in pixel perspective by narrowing, exposing the meeting room.
      const opened = progress(p, 0.05, 0.29);
      rect(365, 51, 142, 177, "#354855");
      rect(388, 164, 92, 8, "#956e71");
      rect(395, 172, 7, 40, INK);
      rect(463, 172, 7, 40, INK);
      const dw = mix(162, 14, opened);
      box(357, 35, dw, 202, "#514968", "#718696");
      rect(357 + dw - 14, 137, 5, 8, GOLD);
      const reach = progress(p, 0.23, 0.53),
        pull = progress(p, 0.53, 0.88);
      const sx = mix(mix(443, 322, reach), 440, pull);
      const px = mix(mix(139, 255, progress(p, 0.02, 0.48)), 418, pull);
      // Additional staff step out before the trap closes.
      if (p > 0.26)
        person("staff", mix(485, 492, reach), 228, {
          scale: 2,
          face: -1,
          gesture: true,
        });
      if (long && p > 0.4)
        person("manager", mix(470, 530, reach), 242, { scale: 2, face: -1 });
      person("player", px, 240, { walk: p < 0.88, face: pull > 0 ? -1 : 1 });
      person("staff", sx, 241, {
        walk: reach < 1 || pull > 0,
        face: -1,
        gesture: true,
      });
      if (p > 0.45 && p < 0.9) {
        line(px + 21, 193, sx - 23, 189, CREAM, 7);
        rect(px + 19, 187, 7, 11, CREAM);
      }
      if (p > 0.3 && p < 0.78)
        bubble(
          long ? "GOT A QUICK SECOND?" : "ONE QUICK QUESTION",
          151,
          71,
          CORAL,
          181,
        );
      if (p > 0.88) {
        const closed = progress(p, 0.88, 0.98);
        box(357, 35, mix(14, 162, closed), 202, "#514968", "#718696");
        rect(499, 137, 5, 8, GOLD);
        if (p > 0.96) bubble("NOW A RECURRING INVITE", 182, 71, MINT, 206);
      }
    },
  };
  return (kind: HitKind, p: number, milliseconds: number) => {
    time = milliseconds;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, 640, 280);
    scenes[kind](p);
    // Small static comic corner marks, never screen shake.
    rect(0, 0, 13, 3, MINT);
    rect(0, 0, 3, 13, MINT);
    rect(627, 277, 13, 3, CORAL);
    rect(637, 267, 3, 13, CORAL);
    ctx.restore();
  };
}
