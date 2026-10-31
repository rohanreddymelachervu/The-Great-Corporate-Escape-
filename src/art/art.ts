import Phaser from "phaser";
import type { Level, Prop } from "../game/types";

/** The entire office is drawn locally, one real pixel at a time. No asset requests. */
const C = {
  void: 0x101625,
  ink: 0x171c31,
  wall: 0x29324b,
  wallLight: 0x46516c,
  tile: 0x354855,
  tileAlt: 0x374b58,
  seam: 0x2a3b49,
  teal: 0x639b9d,
  carpet: 0x4b4b69,
  lavender: 0x9991bf,
  coral: 0xf08687,
  mint: 0xa3f7cf,
  wood: 0x956e71,
  woodLight: 0xc69c93,
  cream: 0xe3d8cf,
  violet: 0xa795ed,
  darkWood: 0x5a4c60,
  leaf: 0x679f8c,
  leafLight: 0xa2c7a2,
};
const hex = (n: number): string => `#${n.toString(16).padStart(6, "0")}`;
const blend = (a: number, b: number, t: number): number => {
  const r = Math.round(((a >> 16) & 255) * (1 - t) + ((b >> 16) & 255) * t);
  const g = Math.round(((a >> 8) & 255) * (1 - t) + ((b >> 8) & 255) * t);
  const q = Math.round((a & 255) * (1 - t) + (b & 255) * t);
  return (r << 16) | (g << 8) | q;
};

type Costume = {
  skin: string;
  skinShade: string;
  hair: string;
  shirt: string;
  shade: string;
  trouser: string;
  accent: string;
};
const costumes: Record<string, Costume> = {
  staff: {
    skin: "#c39173",
    skinShade: "#94634e",
    hair: "#302d40",
    shirt: "#81a6b8",
    shade: "#557589",
    trouser: "#354b62",
    accent: "#f3d196",
  },
  player: {
    skin: "#c98e70",
    skinShade: "#976653",
    hair: "#232039",
    shirt: "#a9e6cc",
    shade: "#639a94",
    trouser: "#514968",
    accent: "#f5c89d",
  },
  manager: {
    skin: "#c08b75",
    skinShade: "#93604f",
    hair: "#332a37",
    shirt: "#56647f",
    shade: "#35415d",
    trouser: "#29334d",
    accent: "#fa8b89",
  },
  hr: {
    skin: "#a97058",
    skinShade: "#79513f",
    hair: "#25202f",
    shirt: "#6aa39f",
    shade: "#3e737b",
    trouser: "#e2c9b2",
    accent: "#e8b568",
  },
  intern: {
    skin: "#dba582",
    skinShade: "#ae755e",
    hair: "#3c2c39",
    shirt: "#ad98d2",
    shade: "#776997",
    trouser: "#444f6c",
    accent: "#a5f5d3",
  },
  founder: {
    skin: "#ba8062",
    skinShade: "#82503e",
    hair: "#272333",
    shirt: "#3b3b50",
    shade: "#262a3b",
    trouser: "#5c6b89",
    accent: "#e7a472",
  },
  pm: {
    skin: "#c18d72",
    skinShade: "#94614f",
    hair: "#39273c",
    shirt: "#c78d79",
    shade: "#8b6269",
    trouser: "#454a66",
    accent: "#a1c3d2",
  },
  gossip: {
    skin: "#b97e63",
    skinShade: "#89523f",
    hair: "#302133",
    shirt: "#bd87ac",
    shade: "#805c88",
    trouser: "#6b527b",
    accent: "#e2c17d",
  },
};

/** 24 × 32 sprites, with a shared foot line and a transparent pixel shadow. */
export function createTextures(scene: Phaser.Scene): void {
  for (const [kind, p] of Object.entries(costumes)) {
    if (scene.textures.exists(kind)) continue;
    const canvas = document.createElement("canvas");
    canvas.width = 24;
    canvas.height = 32;
    const ctx = canvas.getContext("2d");
    if (!ctx) continue;
    ctx.imageSmoothingEnabled = false;
    const r = (
      x: number,
      y: number,
      w: number,
      h: number,
      color: string,
    ): void => {
      ctx.fillStyle = color;
      ctx.fillRect(x, y, w, h);
    };
    const ink = "#171a2c";
    // Stepped, translucent ground shadow — included inside the exact sprite bounds.
    r(4, 29, 16, 2, "#0d14264f");
    r(7, 31, 10, 1, "#0d142628");
    // Shoes and trouser silhouette. Different pixels give the feet a readable stance.
    r(7, 23, 10, 6, ink);
    r(8, 23, 3, 5, p.trouser);
    r(13, 23, 3, 5, p.trouser);
    r(6, 28, 5, 2, ink);
    r(13, 28, 6, 2, ink);
    r(7, 28, 3, 1, "#8fa4b0");
    r(14, 28, 3, 1, "#8fa4b0");
    // Body outline, shoulders, and articulated sleeves.
    r(7, 13, 10, 12, ink);
    r(5, 15, 14, 7, ink);
    r(7, 14, 10, 10, p.shirt);
    r(7, 21, 10, 3, p.shade);
    r(5, 16, 3, 5, p.shade);
    r(16, 15, 3, 6, p.shade);
    r(5, 21, 3, 3, p.skinShade);
    r(16, 21, 3, 3, p.skinShade);
    r(5, 21, 2, 2, p.skin);
    r(17, 21, 2, 2, p.skin);
    r(9, 12, 6, 3, p.skinShade);
    r(10, 12, 4, 3, p.skin);
    // Face and hair outline; all faces have asymmetric one-pixel highlights.
    r(7, 4, 10, 9, ink);
    r(6, 5, 12, 5, ink);
    r(7, 5, 10, 6, p.skin);
    r(8, 11, 8, 2, p.skin);
    r(7, 9, 1, 3, p.skinShade);
    r(8, 12, 7, 1, p.skinShade);
    r(6, 3, 12, 4, p.hair);
    r(7, 2, 10, 2, p.hair);
    r(7, 4, 3, 4, p.hair);
    r(8, 3, 6, 1, "#5b4151");
    r(10, 8, 1, 2, ink);
    r(15, 8, 1, 2, ink);
    r(13, 10, 1, 1, p.skinShade);
    r(11, 12, 3, 1, "#704e53");
    if (kind === "player") {
      // Mint jacket, coral badge clip, messenger strap, and an anxious raised brow.
      r(9, 15, 5, 8, "#e1e7dc");
      r(11, 16, 2, 6, "#657c8a");
      r(7, 14, 2, 9, "#c6f6dd");
      r(14, 14, 2, 9, p.shade);
      r(7, 15, 2, 3, "#303c51");
      r(9, 18, 2, 3, "#303c51");
      r(11, 21, 2, 3, "#303c51");
      r(14, 17, 2, 3, "#f4b2a2");
      r(14, 17, 2, 1, "#fff0d2");
      r(9, 7, 3, 1, p.hair);
      r(14, 6, 3, 1, p.hair);
      r(6, 1, 4, 3, p.hair);
      r(8, 1, 7, 2, p.hair);
      r(16, 4, 2, 3, p.hair);
      r(16, 25, 2, 2, "#a0e2ca");
    } else if (kind === "manager") {
      // Oversized suit lapels, tightly knotted coral tie, frown, and a silver watch.
      r(10, 14, 5, 7, "#eee1d7");
      r(11, 15, 2, 2, p.accent);
      r(12, 17, 2, 5, "#d3767e");
      r(8, 15, 2, 5, "#8290a4");
      r(15, 15, 2, 5, "#8290a4");
      r(10, 20, 1, 3, "#a1abba");
      r(15, 21, 1, 1, "#d9d3c8");
      r(5, 21, 3, 1, "#b0c5cc");
      r(6, 21, 1, 1, "#ece5d5");
      r(9, 7, 3, 1, p.hair);
      r(14, 7, 3, 1, p.hair);
      r(12, 11, 3, 1, "#694452");
      r(14, 3, 3, 2, "#9a9298");
      r(16, 5, 1, 2, "#9a9298");
      // Tiny briefcase, not a weapon.
      r(2, 23, 5, 5, ink);
      r(3, 24, 4, 3, "#705564");
      r(3, 22, 3, 1, "#b3a097");
    } else if (kind === "hr") {
      // Long teal kurta and a gold lanyard over a cream tunic seam.
      r(7, 22, 10, 4, p.shade);
      r(8, 25, 3, 3, p.trouser);
      r(13, 25, 3, 3, p.trouser);
      r(11, 15, 2, 10, "#92c5b6");
      r(9, 15, 1, 4, p.accent);
      r(14, 15, 1, 4, p.accent);
      r(10, 19, 4, 3, "#ecdfc2");
      r(11, 20, 2, 1, "#72959e");
      r(5, 5, 2, 12, p.hair);
      r(17, 5, 2, 13, p.hair);
      r(18, 4, 2, 3, p.hair);
      r(9, 8, 3, 2, "#445261");
      r(14, 8, 3, 2, "#445261");
      r(12, 8, 2, 1, "#445261");
      r(10, 9, 1, 1, "#c8cbb8");
      r(15, 9, 1, 1, "#c8cbb8");
      r(6, 11, 1, 2, p.accent);
      r(17, 11, 1, 2, p.accent);
      r(16, 19, 6, 9, ink);
      r(17, 20, 4, 7, "#bb9c80");
      r(18, 20, 2, 1, "#e5d1a6");
      r(18, 23, 2, 1, "#7c6a6c");
      r(18, 25, 2, 1, "#7c6a6c");
    } else if (kind === "intern") {
      // Lavender hoodie, enormous mint headphones, tousled hair, red trainers.
      r(8, 14, 8, 3, "#c5afe6");
      r(9, 17, 1, 4, "#e4d7ef");
      r(14, 17, 1, 4, "#e4d7ef");
      r(9, 21, 6, 2, "#746490");
      r(10, 21, 4, 1, "#9380b3");
      r(5, 5, 2, 6, "#456d75");
      r(17, 5, 2, 6, "#456d75");
      r(5, 6, 2, 4, p.accent);
      r(17, 6, 2, 4, p.accent);
      r(7, 2, 10, 1, p.accent);
      r(8, 1, 3, 3, p.hair);
      r(12, 1, 4, 3, p.hair);
      r(10, 4, 3, 3, p.hair);
      r(10, 8, 2, 1, ink);
      r(15, 8, 2, 1, ink);
      r(11, 11, 4, 1, "#f3d3b2");
      r(7, 28, 3, 1, "#ef9a91");
      r(14, 28, 3, 1, "#ef9a91");
      r(2, 21, 3, 5, "#efd0b1");
      r(2, 21, 3, 1, "#faf0d2");
      r(3, 23, 1, 2, "#807493");
    } else if (kind === "founder") {
      // Unstructured black tee, orange sneakers, beard and wire-frame glasses.
      r(7, 13, 10, 3, "#434154");
      r(10, 18, 5, 3, "#c9baca");
      r(11, 17, 2, 5, "#e4c6bd");
      r(13, 18, 2, 1, p.accent);
      r(11, 22, 4, 1, p.shade);
      r(8, 10, 8, 3, p.hair);
      r(10, 11, 4, 1, "#b57b63");
      r(9, 7, 4, 3, "#222535");
      r(14, 7, 4, 3, "#222535");
      r(13, 8, 1, 1, "#222535");
      r(10, 8, 2, 1, "#97b1bb");
      r(15, 8, 2, 1, "#97b1bb");
      r(7, 1, 3, 3, p.hair);
      r(11, 1, 4, 2, p.hair);
      r(15, 2, 3, 3, p.hair);
      r(5, 21, 3, 2, "#151f30");
      r(6, 21, 1, 1, "#a3efd0");
      r(6, 28, 5, 1, p.accent);
      r(13, 28, 6, 1, p.accent);
    } else if (kind === "pm") {
      // Rolled sleeves, utility vest, blue lanyard and a sideways sprint clipboard.
      r(5, 16, 3, 4, "#a4b7c7");
      r(16, 16, 3, 4, "#a4b7c7");
      r(11, 14, 3, 10, "#bed0d7");
      r(7, 15, 3, 8, "#d6a08b");
      r(8, 19, 2, 2, "#8b6269");
      r(15, 19, 2, 2, "#8b6269");
      r(10, 15, 1, 5, "#628aab");
      r(14, 15, 1, 5, "#628aab");
      r(11, 20, 3, 2, "#e8ddbc");
      r(5, 4, 3, 6, p.hair);
      r(6, 2, 10, 3, p.hair);
      r(16, 4, 2, 3, p.hair);
      r(9, 7, 3, 1, p.hair);
      r(14, 8, 3, 1, p.hair);
      r(12, 11, 2, 1, "#f2d2af");
      r(15, 22, 8, 6, ink);
      r(16, 23, 6, 4, "#a3adc8");
      r(17, 24, 4, 1, "#696384");
      r(17, 26, 2, 1, "#d98f8e");
      r(20, 26, 1, 1, "#98d5bc");
    } else {
      // Plum sari, gold diagonal border, high bun, bangles and a steaming chai.
      r(7, 23, 10, 5, p.shade);
      r(8, 24, 8, 3, "#9f6f9c");
      r(8, 14, 3, 3, p.accent);
      r(10, 17, 3, 3, p.accent);
      r(12, 20, 3, 3, p.accent);
      r(14, 23, 3, 4, p.accent);
      r(10, 17, 1, 2, "#f4dba2");
      r(16, 1, 4, 4, p.hair);
      r(15, 0, 3, 2, p.hair);
      r(17, 4, 2, 6, p.hair);
      r(6, 10, 1, 3, p.accent);
      r(17, 10, 1, 3, p.accent);
      r(13, 6, 1, 1, "#de867f");
      r(9, 7, 3, 1, p.hair);
      r(14, 7, 3, 1, p.hair);
      r(11, 11, 4, 1, "#f0c2a6");
      r(5, 21, 3, 1, p.accent);
      r(17, 21, 3, 1, p.accent);
      r(1, 18, 4, 5, "#efd4b4");
      r(1, 18, 4, 1, "#fff0ce");
      r(0, 19, 1, 3, "#b6a293");
      r(2, 15, 1, 2, "#c1c4ce");
      r(3, 13, 1, 2, "#8d9eae");
    }
    scene.textures.addCanvas(kind, canvas);
  }
}

type G = Phaser.GameObjects.Graphics;
function box(
  g: G,
  x: number,
  y: number,
  w: number,
  h: number,
  color: number,
  alpha = 1,
): void {
  if (w <= 0 || h <= 0) return;
  g.fillStyle(color, alpha);
  g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}
function edge(
  g: G,
  x: number,
  y: number,
  w: number,
  h: number,
  color: number,
): void {
  box(g, x, y, w, 1, color);
  box(g, x, y + h - 1, w, 1, color);
  box(g, x, y, 1, h, color);
  box(g, x + w - 1, y, 1, h, color);
}
function label(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  color: number,
  size = 10,
): void {
  scene.add
    .text(Math.round(x), Math.round(y), text, {
      fontFamily: "monospace",
      fontSize: `${size}px`,
      color: hex(color),
      resolution: 2,
      letterSpacing: 1,
    })
    .setDepth(2)
    .setAlpha(0.68);
}
function paper(g: G, x: number, y: number, w = 10, h = 12): void {
  box(g, x + 1, y + 2, w, h, C.ink, 0.25);
  box(g, x, y, w, h, C.cream);
  box(g, x + 2, y + 3, Math.max(2, w - 4), 1, 0x9196a9);
  box(g, x + 2, y + 6, Math.max(2, w - 6), 1, 0x9196a9);
}
function cup(g: G, x: number, y: number): void {
  box(g, x, y + 1, 7, 6, 0xe3cfc0);
  box(g, x + 1, y, 5, 2, 0xeadfcd);
  box(g, x + 2, y + 1, 3, 1, 0x71515b);
  box(g, x + 7, y + 2, 2, 3, 0xb6aaa6);
}
function plant(g: G, x: number, y: number, w: number, h: number): void {
  const cx = x + w / 2,
    cy = y + h * 0.46;
  box(g, cx - 8, y + h - 12, 16, 12, C.ink);
  box(g, cx - 7, y + h - 11, 14, 7, 0xc2a39b);
  box(g, cx - 5, y + h - 4, 10, 4, 0x8e7780);
  box(g, cx - 8, y + h - 13, 16, 3, 0xd1b4a5);
  box(g, cx - 5, y + h - 13, 10, 1, 0x4b424b);
  box(g, cx - 1, cy, 2, Math.max(4, h * 0.45), 0x536f70);
  const leaves = [
    [-9, -6, 8, 5],
    [2, -10, 7, 7],
    [-5, -17, 5, 9],
    [-12, 3, 10, 5],
    [1, 0, 11, 5],
    [-5, 10, 6, 4],
  ];
  for (let i = 0; i < leaves.length; i++) {
    const [dx, dy, lw, lh] = leaves[i];
    box(g, cx + dx - 1, cy + dy + 2, lw + 2, lh, 0x273f45);
    box(g, cx + dx, cy + dy, lw, lh, i % 2 ? C.leaf : C.leafLight);
    box(g, cx + dx + 1, cy + dy, lw - 2, 1, 0xc2d4ad, 0.6);
  }
}
function monitor(g: G, x: number, y: number, w: number, h: number): void {
  box(g, x - 5, y - 5, w + 10, h + 9, C.violet, 0.045);
  box(g, x - 2, y - 2, w + 4, h + 4, C.ink);
  box(g, x, y, w, h, 0x665b92);
  box(g, x + 1, y + 1, w - 2, h - 2, 0x8776b5);
  box(g, x + 2, y + 2, w - 4, 3, 0xa897d7);
  box(g, x + 3, y + 7, Math.max(3, w * 0.45), 1, 0xd1baf1);
  box(g, x + 3, y + 10, Math.max(2, w * 0.65), 1, 0xc1c9ee);
  if (h > 17) box(g, x + 3, y + 13, Math.max(2, w * 0.3), 1, C.mint);
  box(g, x + w / 2 - 2, y + h + 2, 4, 5, 0x596279);
  box(g, x + w / 2 - 7, y + h + 6, 14, 2, C.ink);
  box(g, x + w - 3, y + h, 1, 1, C.mint);
}

function renderProp(scene: Phaser.Scene, p: Prop): void {
  const { x, y, w, h } = p;
  const g = scene.add.graphics().setDepth(5);
  const accent = p.color ?? C.teal;
  // Pixel-stepped drop shadows give every fixture a small, consistent elevation.
  box(g, x + 3, y + 6, w, h, C.void, 0.36);
  box(g, x + 5, y + h + 6, Math.max(2, w - 6), 3, C.void, 0.14);
  switch (p.kind) {
    case "desk": {
      box(g, x + 4, y + h - 3, 5, 7, C.ink);
      box(g, x + w - 10, y + h - 3, 5, 7, C.ink);
      box(g, x, y, w, h, C.ink);
      box(g, x + 2, y + 2, w - 4, h - 7, C.wood);
      box(g, x + 3, y + 2, w - 6, 3, C.woodLight);
      box(g, x + 2, y + h - 6, w - 4, 4, C.darkWood);
      for (let k = 12; k < w - 4; k += 23)
        box(g, x + k, y + 7, 1, Math.max(0, h - 18), 0xcc9d94, 0.18);
      const screenW = Math.min(30, Math.max(14, w * 0.36));
      const screenH = Math.min(22, Math.max(10, h * 0.35));
      monitor(g, x + w / 2 - screenW / 2 - 3, y + 7, screenW, screenH);
      const ky = Math.min(y + h - 12, y + screenH + 19);
      box(g, x + w / 2 - 18, ky, 27, 7, 0x393f56);
      box(g, x + w / 2 - 17, ky + 1, 25, 4, 0x9b97b1);
      for (let a = 0; a < 6; a++)
        box(g, x + w / 2 - 15 + a * 4, ky + 2, 2, 1, 0x5e6480);
      box(g, x + w / 2 + 13, ky, 8, 9, 0x76617d);
      box(g, x + w / 2 + 15, ky + 1, 3, 5, 0xc2adb9);
      if (w > 66) {
        paper(g, x + 8, y + h - 21, 11, 14);
        cup(g, x + w - 17, y + 10);
      }
      if (h > 66) {
        box(g, x + w / 2 - 13, y + h - 8, 26, 12, C.ink);
        box(g, x + w / 2 - 11, y + h - 7, 22, 8, blend(accent, C.ink, 0.2));
        box(g, x + w / 2 - 10, y + h - 7, 20, 2, accent);
      }
      break;
    }
    case "plant":
      plant(g, x, y, w, h);
      break;
    case "sofa": {
      const shade = blend(accent, C.ink, 0.36);
      box(g, x, y, w, h, C.ink);
      box(g, x + 3, y + 3, w - 6, h - 7, shade);
      box(g, x + 5, y + 4, w - 10, 8, accent);
      box(g, x + 7, y + 5, w - 14, 2, blend(accent, C.cream, 0.22));
      const seats = Math.max(1, Math.floor(w / 29));
      const sw = (w - 18) / seats;
      for (let i = 0; i < seats; i++) {
        box(g, x + 9 + i * sw, y + 15, sw - 2, Math.max(6, h - 22), accent);
        box(
          g,
          x + 11 + i * sw,
          y + 17,
          sw - 6,
          2,
          blend(accent, C.cream, 0.14),
        );
        box(g, x + 10 + i * sw, y + h - 10, sw - 5, 1, shade);
      }
      box(g, x + 2, y + 10, 6, h - 14, shade);
      box(g, x + w - 8, y + 10, 6, h - 14, shade);
      box(g, x + 2, y + 10, 6, 3, accent);
      box(g, x + w - 8, y + 10, 6, 3, accent);
      box(g, x + 8, y + h - 2, 5, 5, C.ink);
      box(g, x + w - 13, y + h - 2, 5, 5, C.ink);
      if (w > 70) {
        box(g, x + 13, y + 17, 13, 12, C.lavender);
        box(g, x + 15, y + 19, 9, 1, 0xc2b6d5);
      }
      break;
    }
    case "coffee": {
      box(g, x, y, w, h, C.ink);
      box(g, x + 2, y + 2, w - 4, h - 4, 0x685e73);
      box(g, x + 2, y + 2, w - 4, 7, C.woodLight);
      box(g, x + 3, y + h - 8, w - 6, 5, C.darkWood);
      const mw = Math.min(32, w - 8),
        mx = x + 5;
      box(g, mx, y + 10, mw, Math.max(18, h - 22), 0x252f43);
      box(g, mx + 2, y + 12, mw - 4, 6, 0x91979f);
      box(g, mx + 4, y + 13, mw - 8, 2, 0xd0c7bf);
      box(g, mx + 5, y + 21, mw - 10, 7, 0x101d2d);
      box(g, mx + mw - 7, y + 22, 2, 2, C.mint);
      box(g, mx + 5, y + 29, mw - 10, 2, 0xabb3b6);
      cup(g, mx + 8, y + 27);
      if (w > 55) {
        box(g, x + w - 18, y + 16, 10, 13, 0xad8f86);
        box(g, x + w - 19, y + 14, 12, 3, 0xe6cbb0);
        box(g, x + w - 16, y + 19, 6, 5, 0xd5bfa4);
        cup(g, x + w - 19, y + h - 16);
      }
      break;
    }
    case "server": {
      box(g, x, y, w, h, C.ink);
      box(g, x + 3, y + 3, w - 6, h - 6, 0x364257);
      box(g, x + 3, y + 3, 3, h - 6, 0x5a6580);
      box(g, x + w - 6, y + 3, 3, h - 6, 0x202d43);
      for (let j = 7; j < h - 8; j += 12) {
        box(g, x + 9, y + j, w - 18, 9, 0x222e42);
        box(g, x + 10, y + j, w - 20, 1, 0x69708b);
        for (let k = 12; k < w - 18; k += 5)
          box(g, x + k, y + j + 3, 2, 3, 0x4d566e);
        box(g, x + w - 14, y + j + 3, 2, 2, j % 3 ? C.mint : C.coral);
      }
      box(g, x + 8, y + h - 4, w - 16, 2, C.violet, 0.65);
      break;
    }
    case "table": {
      box(g, x + 6, y + 5, w - 12, h, C.ink);
      box(g, x, y + 4, w, h - 8, C.ink);
      box(g, x + 4, y, w - 8, h, C.ink);
      box(g, x + 3, y + 6, w - 6, h - 12, C.wood);
      box(g, x + 6, y + 2, w - 12, h - 4, C.wood);
      box(g, x + 7, y + 2, w - 14, 3, C.woodLight);
      box(g, x + 7, y + h - 4, w - 14, 2, C.darkWood);
      box(g, x + w / 2 - 2, y + 10, 1, h - 20, C.darkWood, 0.3);
      if (w > 55 && h > 35) {
        paper(g, x + 13, y + 13, 13, 17);
        paper(g, x + w - 29, y + h - 27, 13, 16);
        cup(g, x + w - 23, y + 12);
        box(g, x + w / 2 - 10, y + h / 2 - 7, 20, 13, C.ink);
        box(g, x + w / 2 - 8, y + h / 2 - 5, 16, 9, 0x8d82ad);
        box(g, x + w / 2 - 8, y + h / 2 + 4, 16, 2, 0xc1abc7);
      }
      break;
    }
    case "balloons": {
      // String lines and block-highlighted pastel balloons; entirely static.
      const colors = [C.coral, C.violet, C.mint];
      for (let i = 0; i < 3; i++) {
        const bx = x + w * (0.23 + i * 0.26),
          by = y + 4 + (i % 2) * 7;
        box(g, bx, by + 16, 1, Math.max(1, h - 25 - (i % 2) * 7), 0x9c9aaf);
        box(g, bx - 5, by, 10, 16, C.ink);
        box(g, bx - 7, by + 4, 14, 8, C.ink);
        box(g, bx - 4, by + 1, 8, 14, colors[i]);
        box(g, bx - 6, by + 4, 12, 7, colors[i]);
        box(g, bx - 3, by + 3, 2, 4, C.cream, 0.6);
        box(g, bx - 1, by + 16, 3, 2, colors[i]);
      }
      box(g, x + w / 2 - 6, y + h - 7, 12, 7, C.darkWood);
      break;
    }
    case "board": {
      box(g, x, y, w, h, C.ink);
      box(g, x + 2, y + 2, w - 4, h - 4, 0xb3b8bb);
      box(g, x + 4, y + 4, w - 8, h - 10, 0xd2d4cc);
      box(g, x + 4, y + h - 5, w - 8, 3, 0x738496);
      const col = (w - 14) / 3;
      for (let i = 0; i < 3; i++) {
        const xx = x + 7 + i * col;
        box(g, xx, y + 8, col - 5, 2, 0x87909e);
        for (let j = 0; j < Math.min(3, Math.floor((h - 20) / 12)); j++) {
          const yy = y + 14 + j * 12;
          box(
            g,
            xx,
            yy,
            Math.min(13, col - 5),
            8,
            [0xc8b6d8, 0xe4b0a1, 0xa7c7b3][i],
          );
          box(g, xx + 2, yy + 3, Math.min(7, col - 9), 1, 0x7c7e8e);
        }
      }
      box(g, x + w - 15, y + h - 4, 8, 2, C.coral);
      break;
    }
    case "shelf": {
      box(g, x, y, w, h, C.ink);
      box(g, x + 3, y + 3, w - 6, h - 6, C.darkWood);
      for (let j = 3; j < h - 9; j += 22) {
        for (let i = 6; i < w - 8; i += 9) {
          const bh = 10 + ((i + j) % 7);
          const bc = [C.lavender, C.teal, C.woodLight, C.coral][
            Math.floor((i + j) / 9) % 4
          ];
          box(g, x + i, y + j + 19 - bh, 6, bh, bc);
          box(
            g,
            x + i + 1,
            y + j + 21 - bh,
            1,
            Math.max(3, bh - 5),
            C.cream,
            0.35,
          );
          box(g, x + i + 1, y + j + 15, 4, 1, C.ink, 0.5);
        }
        box(g, x + 3, y + j + 20, w - 6, 3, C.woodLight);
      }
      box(g, x + 2, y + 1, w - 4, 3, 0xc2a298);
      break;
    }
    case "printer": {
      box(g, x + 3, y + 7, w - 6, h - 7, C.ink);
      box(g, x + 5, y + 8, w - 10, h - 11, 0xa0a3b4);
      box(g, x, y + 11, w, Math.max(12, h - 20), C.ink);
      box(g, x + 2, y + 12, w - 4, Math.max(8, h - 23), 0x7e879d);
      box(g, x + 5, y + 14, w - 10, 5, 0xb7bac4);
      box(g, x + w - 11, y + 15, 4, 2, C.mint);
      box(g, x + 8, y + h - 15, w - 16, 7, 0x303b50);
      paper(g, x + w / 2 - 7, y, 14, 14);
      box(g, x + w / 2 - 8, y + h - 10, 16, 6, C.cream);
      box(g, x + w / 2 - 5, y + h - 7, 10, 1, 0x9b9bac);
      break;
    }
  }
}

/** Background only: gameplay owns gates, exits, items, interactions and actors. */
export function renderOffice(scene: Phaser.Scene, level: Level): void {
  const cacheKey = "office-floor-baked-" + level.id;
  if (scene.textures.exists(cacheKey)) {
    scene.add.image(0, 0, cacheKey).setOrigin(0).setDepth(0);
    return;
  }
  const previousObjects = new Set(scene.children.list);
  const floor = scene.add.graphics().setDepth(0);
  box(floor, 0, 0, level.width, level.height, C.void);
  // A continuous, understated 32px tile grid keeps navigation legible.
  for (let y = 0; y < level.height; y += 32) {
    for (let x = 0; x < level.width; x += 32) {
      box(
        floor,
        x,
        y,
        Math.min(31, level.width - x),
        Math.min(31, level.height - y),
        (x / 32 + y / 32) % 2 ? C.tile : C.tileAlt,
      );
      box(
        floor,
        x + 1,
        y + 1,
        Math.min(29, level.width - x - 1),
        1,
        0x92b4ba,
        0.035,
      );
      // Infrequent flecks are material texture, never pickups or route markers.
      if (((x / 32) * 13 + (y / 32) * 7) % 9 === 0) {
        box(floor, x + 8, y + 19, 3, 1, 0xa8bac3, 0.09);
        box(floor, x + 22, y + 9, 2, 1, C.ink, 0.12);
      }
    }
  }
  const zones = scene.add.graphics().setDepth(1);
  for (const z of level.zones) {
    const isCarpet =
      /meet|conf|board|founder|focus|quiet|war|pitch|sync|demo/i.test(z.label);
    const isCafe = /coffee|cafe|caf[ée]|pantry|chai|break|recept|lounge/i.test(
      z.label,
    );
    const base = blend(
      isCarpet ? C.carpet : isCafe ? 0x5e525f : 0x3d5760,
      z.color,
      0.16,
    );
    box(zones, z.x, z.y, z.w, z.h, base);
    edge(zones, z.x + 2, z.y + 2, z.w - 4, z.h - 4, blend(base, C.cream, 0.12));
    if (isCarpet) {
      // Woven carpet, complete with a double stitched perimeter.
      edge(
        zones,
        z.x + 7,
        z.y + 7,
        z.w - 14,
        z.h - 14,
        blend(base, C.lavender, 0.28),
      );
      for (let yy = z.y + 13; yy < z.y + z.h - 7; yy += 8) {
        for (let xx = z.x + 13; xx < z.x + z.w - 7; xx += 8) {
          box(zones, xx, yy, 3, 1, C.lavender, 0.1);
          box(zones, xx + 2, yy + 1, 1, 2, C.ink, 0.09);
        }
      }
    } else {
      const tile = isCafe ? 24 : 32;
      for (let yy = z.y + tile; yy < z.y + z.h; yy += tile)
        box(zones, z.x, yy, z.w, 1, C.ink, 0.16);
      for (let xx = z.x + tile; xx < z.x + z.w; xx += tile)
        box(zones, xx, z.y, 1, z.h, C.ink, 0.16);
      // Insets are quiet room framing, not gameplay borders.
      box(zones, z.x + 8, z.y + z.h - 10, z.w - 16, 2, C.cream, 0.08);
    }
    // Floor titles use just the architectural name; tutorial prose belongs to UI.
    const roomName = z.label
      .replace(/^\d+\s*·\s*/, "")
      .split(/\s[·—]\s/)[0]
      .trim()
      .toUpperCase();
    const maxLetters = Math.max(6, Math.floor((z.w - 26) / 6.5));
    const floorTitle =
      roomName.length > maxLetters
        ? `${roomName.slice(0, maxLetters - 1)}…`
        : roomName;
    if (z.w > 90 && z.h > 40)
      label(
        scene,
        z.x + 13,
        z.y + 13,
        floorTitle,
        blend(C.cream, base, 0.35),
        9,
      );
  }
  // A narrow building perimeter gives even open-plan levels a finished foundation.
  const trim = scene.add.graphics().setDepth(3);
  edge(trim, 1, 1, level.width - 2, level.height - 2, C.wallLight);
  edge(trim, 4, 4, level.width - 8, level.height - 8, C.ink);
  for (const p of level.props) renderProp(scene, p);
  const walls = scene.add.graphics().setDepth(8);
  for (const w of level.walls) {
    const horizontal = w.w >= w.h;
    box(walls, w.x + 5, w.y + 8, w.w, w.h, C.void, 0.38);
    box(walls, w.x + 2, w.y + 4, w.w, w.h, C.void, 0.35);
    box(walls, w.x, w.y, w.w, w.h, C.ink);
    box(walls, w.x + 1, w.y + 1, w.w - 2, w.h - 3, C.wall);
    box(walls, w.x + 2, w.y + 1, w.w - 4, 3, C.wallLight);
    box(walls, w.x + 2, w.y + w.h - 3, w.w - 4, 2, 0x202b40);
    // Architectural seams and built-in mint practical lights, never exit geometry.
    if (horizontal) {
      for (let xx = w.x + 52; xx < w.x + w.w - 5; xx += 64)
        box(walls, xx, w.y + 4, 1, w.h - 7, 0x171f33, 0.55);
      if (w.w > 130 && w.h >= 9) {
        box(walls, w.x + 17, w.y + 4, 29, 5, C.mint, 0.08);
        box(walls, w.x + 19, w.y + 5, 25, 2, C.mint, 0.72);
      }
    } else {
      box(walls, w.x + 1, w.y + 4, 2, w.h - 8, 0x566179);
      for (let yy = w.y + 52; yy < w.y + w.h - 5; yy += 64)
        box(walls, w.x + 3, yy, w.w - 5, 1, C.ink, 0.65);
    }
  }
  // Bake thousands of tiny original art strokes once, not on every mobile frame.
  const objects = scene.children.list.filter((o) => !previousObjects.has(o));
  objects.sort(
    (a, b) =>
      (a as unknown as Phaser.GameObjects.Components.Depth).depth -
      (b as unknown as Phaser.GameObjects.Components.Depth).depth,
  );
  const baked = scene.add
    .renderTexture(0, 0, level.width + 16, level.height + 16)
    .setOrigin(0)
    .setDepth(0);
  baked.draw(objects);
  baked.saveTexture(cacheKey);
  objects.forEach((o) => o.destroy());
}
