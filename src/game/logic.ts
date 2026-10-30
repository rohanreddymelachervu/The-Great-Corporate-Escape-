import type { Point, Rect } from "./types";
export const clamp = (v: number, a: number, b: number) =>
  Math.max(a, Math.min(b, v));
export const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
export const center = (r: Rect): Point => ({
  x: r.x + r.w / 2,
  y: r.y + r.h / 2,
});
export function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++)
    h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
export function rng(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function dailySeed(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}
export function circleHits(p: Point, r: number, b: Rect): boolean {
  const x = clamp(p.x, b.x, b.x + b.w),
    y = clamp(p.y, b.y, b.y + b.h);
  return (p.x - x) ** 2 + (p.y - y) ** 2 < r * r;
}
export function blocked(p: Point, r: number, obstacles: Rect[]): boolean {
  return obstacles.some((b) => circleHits(p, r, b));
}
/** Swept, axis-separated circle movement, sub-stepped to avoid tunnelling. */
export function move(
  p: Point,
  dx: number,
  dy: number,
  r: number,
  obstacles: Rect[],
): Point {
  let x = p.x,
    y = p.y;
  const n = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 5));
  for (let i = 0; i < n; i++) {
    const nx = x + dx / n,
      ny = y + dy / n;
    if (!blocked({ x: nx, y }, r, obstacles)) x = nx;
    if (!blocked({ x, y: ny }, r, obstacles)) y = ny;
  }
  return { x, y };
}
/** Liang–Barsky line / AABB intersection. Walls really stop sight and sound. */
export function segmentHits(a: Point, b: Point, r: Rect): boolean {
  let lo = 0,
    hi = 1;
  const dx = b.x - a.x,
    dy = b.y - a.y;
  for (const [p, q] of [
    [-dx, a.x - r.x],
    [dx, r.x + r.w - a.x],
    [-dy, a.y - r.y],
    [dy, r.y + r.h - a.y],
  ]) {
    if (p === 0) {
      if (q < 0) return false;
    } else {
      const t = q / p;
      if (p < 0) lo = Math.max(lo, t);
      else hi = Math.min(hi, t);
      if (lo > hi) return false;
    }
  }
  return true;
}
export const visible = (a: Point, b: Point, obs: Rect[]) =>
  !obs.some((r) => segmentHits(a, b, r));
export function inCone(
  a: Point,
  b: Point,
  angle: number,
  range: number,
  fov: number,
  obs: Rect[],
): boolean {
  if (dist(a, b) > range) return false;
  const d = Math.atan2(b.y - a.y, b.x - a.x) - angle;
  return (
    Math.abs(Math.atan2(Math.sin(d), Math.cos(d))) <= fov / 2 &&
    visible(a, b, obs)
  );
}
/** Fixed grid A*, shared by patrol, investigation and pursuit. Radius inflation prevents corner clipping. */
export class Navigator {
  readonly step = 24;
  readonly cols: number;
  readonly rows: number;
  readonly walk: Uint8Array;
  constructor(
    readonly width: number,
    readonly height: number,
    readonly obstacles: Rect[],
    readonly radius = 12,
  ) {
    this.cols = Math.ceil(width / this.step);
    this.rows = Math.ceil(height / this.step);
    this.walk = new Uint8Array(this.cols * this.rows);
    for (let y = 0; y < this.rows; y++)
      for (let x = 0; x < this.cols; x++) {
        const p = this.point(y * this.cols + x);
        this.walk[y * this.cols + x] = blocked(p, radius + 2, obstacles)
          ? 0
          : 1;
      }
  }
  point(i: number): Point {
    return {
      x: ((i % this.cols) + 0.5) * this.step,
      y: (Math.floor(i / this.cols) + 0.5) * this.step,
    };
  }
  private closest(p: Point): number {
    let best = -1,
      d = Infinity;
    const cx = Math.floor(p.x / this.step),
      cy = Math.floor(p.y / this.step);
    for (let r = 0; r < 8; r++) {
      for (
        let y = Math.max(0, cy - r);
        y <= Math.min(this.rows - 1, cy + r);
        y++
      )
        for (
          let x = Math.max(0, cx - r);
          x <= Math.min(this.cols - 1, cx + r);
          x++
        ) {
          const i = y * this.cols + x;
          if (this.walk[i]) {
            const dd = dist(p, this.point(i));
            if (dd < d && visible(p, this.point(i), this.obstacles)) {
              d = dd;
              best = i;
            }
          }
        }
      if (best >= 0) break;
    }
    return best;
  }
  path(a: Point, b: Point): Point[] {
    if (
      visible(a, b, this.obstacles) &&
      !this.obstacles.some((o) =>
        segmentHits(a, b, {
          x: o.x - this.radius,
          y: o.y - this.radius,
          w: o.w + 2 * this.radius,
          h: o.h + 2 * this.radius,
        }),
      )
    )
      return [b];
    const start = this.closest(a),
      goal = this.closest(b);
    if (start < 0 || goal < 0) return [];
    const n = this.walk.length,
      g = new Float32Array(n).fill(Infinity),
      f = new Float32Array(n).fill(Infinity),
      prev = new Int32Array(n).fill(-1),
      closed = new Uint8Array(n);
    const open = [start];
    g[start] = 0;
    f[start] = dist(this.point(start), this.point(goal));
    let iterations = 0;
    while (open.length && iterations++ < n) {
      let bi = 0;
      for (let i = 1; i < open.length; i++)
        if (f[open[i]] < f[open[bi]]) bi = i;
      const cur = open.splice(bi, 1)[0];
      if (cur === goal) {
        const path: Point[] = [];
        let p = cur;
        while (p !== start) {
          path.unshift(this.point(p));
          p = prev[p];
          if (p < 0) return [];
        }
        if (!blocked(b, this.radius, this.obstacles)) path.push(b);
        return path;
      }
      closed[cur] = 1;
      const cx = cur % this.cols,
        cy = Math.floor(cur / this.cols);
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const x = cx + dx,
          y = cy + dy,
          ni = y * this.cols + x;
        if (
          x < 0 ||
          y < 0 ||
          x >= this.cols ||
          y >= this.rows ||
          !this.walk[ni] ||
          closed[ni]
        )
          continue;
        const ng = g[cur] + this.step;
        if (ng < g[ni]) {
          prev[ni] = cur;
          g[ni] = ng;
          f[ni] = ng + dist(this.point(ni), this.point(goal));
          if (!open.includes(ni)) open.push(ni);
        }
      }
    }
    return [];
  }
}
export function scoreRun(
  time: number,
  par: number,
  spots: number,
  hits: number,
  items: number,
  distractions: number,
  bs: number,
) {
  return Math.max(
    100,
    Math.round(
      5000 +
        Math.max(0, par * 2 - time) * 35 +
        (spots === 0 ? 2500 : 0) +
        (hits === 0 ? 1500 : 0) +
        items * 300 +
        Math.min(distractions, 6) * 150 -
        bs * 18 -
        spots * 180,
    ),
  );
}
export function medal(
  score: number,
  spots: number,
  hits: number,
  time: number,
  par: number,
): string {
  if (spots === 0 && hits === 0 && time <= par * 1.5) return "Ghost Employee";
  return score >= 9500 ? "Gold" : score >= 6500 ? "Silver" : "Bronze";
}
