import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
const url = pathToFileURL(resolve("release/office-escape.html")).href;
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ["--no-sandbox"],
});
await mkdir("test-results", { recursive: true });
const reports = [];
for (const viewport of [
  { width: 1280, height: 900 },
  { width: 390, height: 844 },
  { width: 844, height: 390 },
]) {
  const mobile = viewport.width === 390 || viewport.height === 390;
  const context = await browser.newContext({
    viewport,
    isMobile: mobile,
    hasTouch: mobile,
  });
  await context.setOffline(true);
  const page = await context.newPage(),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(url, { waitUntil: "domcontentloaded" });
  const frame = page.mainFrame();
  await frame.waitForFunction(
    () => window.__office?.ready(),
    {},
    { timeout: 30000 },
  );
  await page.screenshot({
    path: `test-results/release-menu-${viewport.width}.png`,
  });
  await frame.getByRole("button", { name: "CLOCK OUT" }).click();
  await frame.waitForFunction(() => window.__office.snapshot().elapsed > 0.3);
  const state = () => frame.evaluate(() => window.__office.snapshot());
  async function travel(axis, goal) {
    const s = await state(),
      old = s.pos[axis],
      key = axis === "x" ? (goal > old ? "d" : "a") : goal > old ? "s" : "w";
    await page.keyboard.down(key);
    try {
      await frame.waitForFunction(
        ({ axis, goal, positive }) => {
          const s = window.__office.snapshot();
          return (
            s.ended ||
            (positive ? s.pos[axis] >= goal - 2 : s.pos[axis] <= goal + 2)
          );
        },
        { axis, goal, positive: goal > old },
        { timeout: 15000, polling: "raf" },
      );
    } finally {
      await page.keyboard.up(key);
    }
  }
  if (!mobile) {
    for (const [a, g] of [
      ["x", 330],
      ["y", 240],
      ["x", 220],
      ["x", 330],
      ["y", 600],
      ["x", 650],
      ["y", 650],
    ])
      await travel(a, g);
    await page.keyboard.press("e");
    for (const [a, g] of [
      ["y", 700],
      ["x", 1030],
      ["y", 115],
    ])
      await travel(a, g);
    await frame.getByRole("heading", { name: "OUT OF OFFICE." }).waitFor();
    await page.screenshot({ path: "test-results/release-victory.png" });
    reports.push({
      viewport,
      mobile,
      fullKeyboardEscape: true,
      result: await state(),
      errors,
    });
  } else {
    const before = (await state()).pos;
    const joy = await frame.locator("#joystick").boundingBox();
    if (!joy) throw new Error("Joystick missing");
    await page.mouse.move(joy.x + joy.width / 2 + 30, joy.y + joy.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(450);
    await page.mouse.up();
    const after = (await state()).pos;
    if (after.x <= before.x + 15)
      throw new Error("Public mobile joystick did not move");
    await frame.locator('[data-ability="coffee"]').tap();
    if ((await state()).coffee !== 1) throw new Error("Coffee not functional");
    await page.screenshot({
      path: `test-results/release-game-${viewport.width}.png`,
    });
    reports.push({
      viewport,
      mobile,
      joystickMovement: after.x - before.x,
      coffeeConsumed: true,
      canvasMatchesStage: await frame.evaluate(() => {
        const c = document.querySelector("canvas"),
          r = document.querySelector("#game").getBoundingClientRect();
        return (
          Math.abs(c.width - r.width) <= 1 && Math.abs(c.height - r.height) <= 1
        );
      }),
      errors,
    });
  }
  await context.close();
}
await browser.close();
const summary = { url, checkedAt: new Date().toISOString(), reports };
await writeFile(
  "test-results/offline-release.json",
  JSON.stringify(summary, null, 2),
);
console.log(JSON.stringify(summary, null, 2));
if (reports.some((r) => r.errors.length || r.canvasMatchesStage === false))
  process.exit(1);
