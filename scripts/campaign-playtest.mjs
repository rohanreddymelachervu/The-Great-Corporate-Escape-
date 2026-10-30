// Real-input campaign traversal. Reads public state; never uses QA positioning.
import { chromium } from "@playwright/test";
import { build } from "esbuild";
import { mkdir, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
await mkdir("test-results", { recursive: true });
await build({
  entryPoints: ["src/game/logic.ts"],
  outfile: "test-results/route-logic.mjs",
  bundle: true,
  platform: "node",
  format: "esm",
});
await build({
  entryPoints: ["src/game/levels.ts"],
  outfile: "test-results/route-levels.mjs",
  bundle: true,
  platform: "node",
  format: "esm",
});
const { Navigator, dist, center } = await import(
  pathToFileURL(resolve("test-results/route-logic.mjs"))
);
const { LEVELS } = await import(
  pathToFileURL(resolve("test-results/route-levels.mjs"))
);
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ["--no-sandbox"],
});
const context = await browser.newContext({
  viewport: { width: 1280, height: 900 },
});
const page = await context.newPage(),
  errors = [],
  results = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(pathToFileURL(resolve("release/office-escape.html")).href);
await page.waitForFunction(() => window.__office?.ready());
await page.getByRole("button", { name: "CLOCK OUT" }).click();
const state = () => page.evaluate(() => window.__office.snapshot());
const held = new Set();
async function keys(wanted) {
  for (const k of [...held])
    if (!wanted.includes(k)) {
      await page.keyboard.up(k);
      held.delete(k);
    }
  for (const k of wanted)
    if (!held.has(k)) {
      await page.keyboard.down(k);
      held.add(k);
    }
}
let lastAction = 0;
async function defense(s) {
  if (s.elapsed < lastAction + 0.6) return;
  const near = s.enemies.some((e) => dist(e, s.pos) < 160),
    seen = s.enemies.some((e) => e.awareness > 0.3 || e.state === "chase");
  if (!near && !seen) return;
  if (s.level >= 4 && !s.cooldowns.vpn) {
    await page.keyboard.press("5");
    lastAction = s.elapsed;
    return;
  }
  if (s.level >= 3 && !s.cooldowns.calendar) {
    await page.keyboard.press("4");
    lastAction = s.elapsed;
    return;
  }
  if (s.level >= 2 && !s.cooldowns.call) {
    await page.keyboard.press("2");
    lastAction = s.elapsed;
    return;
  }
  if (s.coffee > 0 && !s.cooldowns.coffee) {
    await page.keyboard.press("1");
    lastAction = s.elapsed;
  }
}
async function go(target) {
  const deadline = Date.now() + 35000;
  let stuck = 0,
    previous = null,
    path = [],
    at = 0,
    previousObstacles = "";
  while (Date.now() < deadline) {
    const s = await state();
    if (s.ended) {
      await keys([]);
      return false;
    }
    const distance = dist(s.pos, target);
    if (distance < 17) {
      await keys([]);
      return true;
    }
    const signature = s.obstacles.length + ":" + target.x + ":" + target.y;
    if (!path.length || signature !== previousObstacles) {
      const nav = new Navigator(1120, 800, s.obstacles, 12);
      path = nav.path(s.pos, target);
      at = 0;
      previousObstacles = signature;
      if (!path.length)
        throw new Error("No navigable route to " + JSON.stringify(target));
    }
    while (at < path.length - 1 && dist(s.pos, path[at]) < 9) at++;
    const p = path[at],
      dx = p.x - s.pos.x,
      dy = p.y - s.pos.y;
    const wanted = [];
    if (Math.abs(dx) > 4) wanted.push(dx > 0 ? "d" : "a");
    if (Math.abs(dy) > 4) wanted.push(dy > 0 ? "s" : "w");
    const near = s.enemies.some((e) => dist(e, s.pos) < 200);
    if (s.stamina > 35 && !near) wanted.push("Shift");
    await defense(s);
    await keys(wanted);
    await page.waitForTimeout(35);
    if (previous && dist(previous, s.pos) < 0.8) stuck++;
    else stuck = 0;
    previous = s.pos;
    if (stuck > 15) {
      path = [];
      stuck = 0;
    }
  }
  await keys([]);
  throw new Error(
    "Traversal timed out at " +
      JSON.stringify((await state()).pos) +
      " for " +
      JSON.stringify(target),
  );
}
try {
  for (const l of LEVELS) {
    await page.waitForFunction(
      (id) =>
        window.__office.snapshot().level === id &&
        window.__office.snapshot().elapsed > 0.15,
      l.id,
    );
    lastAction = 0;
    for (const id of l.required) {
      const item = l.items.find((i) => i.id === id);
      if (item) {
        await go(item);
        await page.waitForTimeout(100);
      } else {
        const sw = l.interactions.find((i) => i.id === id);
        await go(sw);
        await page.keyboard.press("e");
        await page.waitForTimeout(100);
      }
    }
    const s = await state();
    if (s.bs > 35) {
      const station = l.interactions.find((i) => i.type === "coffee");
      await go(station);
      await page.keyboard.press("e");
    }
    await go(center(l.exit));
    await page
      .getByRole("heading", {
        name: l.id === 5 ? "YOU HAVE A LIFE." : "OUT OF OFFICE.",
      })
      .waitFor({ timeout: 5000 });
    const end = await state();
    results.push({
      level: l.id,
      time: end.elapsed,
      bs: end.bs,
      spots: end.spots,
      hits: end.hits,
      objectives: end.collected,
      noPositioningHelpers: true,
    });
    console.log("ESCAPED", results[results.length - 1]);
    await page.screenshot({ path: `test-results/campaign-floor-${l.id}.png` });
    if (l.id < 5)
      await page.getByRole("button", { name: "NEXT FLOOR" }).click();
  }
  await writeFile(
    "test-results/campaign-playtest.json",
    JSON.stringify(
      { checkedAt: new Date().toISOString(), errors, results },
      null,
      2,
    ),
  );
  if (errors.length) throw new Error(errors.join("\n"));
} catch (e) {
  await keys([]);
  await page.screenshot({ path: "test-results/campaign-failure.png" });
  console.error("STATE", await state());
  throw e;
} finally {
  await browser.close();
}
