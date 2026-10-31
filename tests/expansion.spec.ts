import { test, expect, Page } from "@playwright/test";
import { LEVELS } from "../src/game/levels";
import { blocked, visible, center, scoreRun } from "../src/game/logic";
import type { HitKind } from "../src/game/types";
async function ready(p: Page, level = 1) {
  await p.goto("/?qa=1");
  await p.waitForFunction(() => window.__office?.ready());
  await p.evaluate((l) => window.__office.qa.start(l, "heist-tests"), level);
  await p.waitForFunction(
    (l) =>
      window.__office.snapshot().level === l &&
      window.__office.snapshot().elapsed > 0.15,
    level,
  );
}
const state = (p: Page) => p.evaluate(() => window.__office.snapshot());
async function pos(p: Page, x: number, y: number) {
  await p.evaluate(([x, y]) => window.__office.qa.position(x, y), [x, y]);
  await p.waitForTimeout(90);
}
async function item(p: Page, kind: string) {
  const i = (await state(p)).items.find((i: any) => i.kind === kind);
  expect(i).toBeTruthy();
  await pos(p, i.x, i.y);
  return i;
}
for (const kind of [
  "photo",
  "meeting",
  "yap",
  "paper",
  "allhands",
  "scope",
  "gossip",
  "door",
] as HitKind[])
  test(`hit cutaway ${kind} animates, freezes the office and auto-resumes`, async ({
    page,
  }) => {
    await ready(page);
    await page.evaluate((k) => window.__office.qa.hit(k, 10), kind);
    await expect(page.locator(".hit-scene")).toBeVisible();
    await expect(page.locator(".hit-scene__eyebrow")).toContainText(
      kind.toUpperCase(),
    );
    const frozen = await state(page);
    const a = await page
      .locator(".hit-scene canvas")
      .evaluate((c: HTMLCanvasElement) => c.toDataURL());
    await page.waitForTimeout(350);
    const b = await page
      .locator(".hit-scene canvas")
      .evaluate((c: HTMLCanvasElement) => c.toDataURL());
    expect(a).not.toBe(b);
    expect((await state(page)).elapsed).toBe(frozen.elapsed);
    expect((await state(page)).bs).toBe(10);
    await expect(page.locator(".hit-scene")).toHaveCount(0, { timeout: 4500 });
    await page.waitForFunction(
      (t) => window.__office.snapshot().elapsed > t,
      frozen.elapsed,
    );
    expect((await state(page)).cinematic).toBe(false);
  });
test("long-haul preference persists and cutaway skip does not leak a dodge or interaction", async ({
  page,
}) => {
  await ready(page);
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByLabel("Hit scene length").selectOption("long");
  await page.getByRole("button", { name: "DONE" }).click();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("office-escape-v1")!).settings
          .hitScenes,
    ),
  ).toBe("long");
  await page.evaluate(() => window.__office.qa.hit("scope", 20));
  await page.waitForTimeout(1750);
  await expect(page.locator(".hit-scene")).toBeVisible();
  await page.keyboard.press("Space");
  await expect(page.locator(".hit-scene")).toHaveCount(0);
  const s = await state(page);
  expect(s.dashCooldown).toBe(0);
  expect(s.bs).toBe(20);
});
test("a lethal animated hit completes before the real game-over screen and retry remains usable", async ({
  page,
}) => {
  await ready(page);
  await page.evaluate(() => window.__office.qa.hit("allhands", 100));
  await expect(page.locator(".hit-scene")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "PROMOTED TO STAYING LATE." }),
  ).toBeVisible({ timeout: 6000 });
  await expect(page.locator(".hit-scene")).toHaveCount(0);
  await page.getByRole("button", { name: "RETRY INSTANTLY" }).click();
  await page.waitForFunction(
    () =>
      window.__office.snapshot().bs === 0 &&
      !window.__office.snapshot().cinematic,
  );
});
test("stealing TV requires a hold, grants value once, visibly burdens the bag and defeats Slack camouflage", async ({
  page,
}) => {
  await ready(page, 3);
  const tv = await item(page, "tv");
  await page.keyboard.down("e");
  await page.waitForFunction(
    () => window.__office.snapshot().lootValue >= 800,
    {},
    { timeout: 5000 },
  );
  await page.keyboard.up("e");
  let s = await state(page);
  expect(s.collected).toContain(tv.id);
  expect(s.lootWeight).toBe(3);
  expect(s.lootValue).toBe(800);
  await expect(page.locator("#bag-status")).toContainText("800");
  await expect(page.locator("#bag-status")).toContainText("−9%");
  await page.keyboard.press("3");
  expect((await state(page)).active.slack || 0).toBe(0);
  await expect(page.locator("#toast")).toContainText("TV IS NOT A SPREADSHEET");
  await page.keyboard.press("e");
  expect((await state(page)).lootValue).toBe(800);
});
test("releasing or moving cancels an unfinished theft without awarding points", async ({
  page,
}) => {
  await ready(page);
  await item(page, "tv");
  await page.keyboard.down("e");
  await page.waitForTimeout(350);
  expect((await state(page)).theft.progress).toBeGreaterThan(0);
  await page.keyboard.up("e");
  await page.waitForTimeout(80);
  expect((await state(page)).theft.id).toBeNull();
  expect((await state(page)).lootValue).toBe(0);
  await page.keyboard.down("e");
  await page.waitForTimeout(150);
  await page.keyboard.down("a");
  await page.waitForTimeout(100);
  await page.keyboard.up("a");
  await page.keyboard.up("e");
  expect((await state(page)).lootValue).toBe(0);
  expect((await state(page)).theft.id).toBeNull();
});
test("snacks give actual recovery and loot is only banked by escaping", async ({
  page,
}) => {
  await ready(page, 5);
  await page.evaluate(() => window.__office.qa.bs(40));
  for (let n = 0; n < 2; n++) {
    await item(page, "snacks");
    await page.keyboard.press("e");
    await page.waitForTimeout(80);
  }
  expect((await state(page)).lootValue).toBe(200);
  expect((await state(page)).bs).toBe(28);
  await item(page, "wfh");
  await page.keyboard.press("6");
  const exit = center(LEVELS[4].altExit!);
  await pos(page, exit.x, exit.y);
  await expect(
    page.getByRole("heading", { name: "YOU HAVE A LIFE." }),
  ).toBeVisible();
  await expect(page.locator("#modal-root")).toContainText(
    "Snack Equity Vested",
  );
  const saved = await page.evaluate(
    () => JSON.parse(localStorage.getItem("office-escape-v1")!).bests["v2-5"],
  );
  expect(saved.lootValue).toBe(200);
  const expected =
    scoreRun(
      saved.time,
      LEVELS[4].par,
      saved.spots,
      saved.hits,
      0,
      saved.distractions,
      saved.bs,
    ) +
    saved.lootValue +
    (saved.funScore || 0) * 2 +
    (saved.dodges || 0) * 125;
  expect(Math.abs(saved.score - expected)).toBeLessThanOrEqual(2);
});
test("a failed escape does not bank a stolen bag", async ({ page }) => {
  await ready(page);
  await item(page, "snacks");
  await page.keyboard.press("e");
  await page.waitForTimeout(80);
  await page.evaluate(() => window.__office.qa.bs(100));
  await expect(
    page.getByRole("heading", { name: "PROMOTED TO STAYING LATE." }),
  ).toBeVisible();
  await expect(page.locator(".result-achievements")).toContainText("LOOT LOST");
  expect(
    await page.evaluate(
      () =>
        Object.keys(
          JSON.parse(localStorage.getItem("office-escape-v1") || '{"bests":{}}')
            .bests,
        ).length,
    ),
  ).toBe(0);
});
test("meeting rooms warn, release people physically, and staff can spot and interrupt the player", async ({
  page,
}) => {
  await ready(page);
  await expect
    .poll(
      async () => {
        const s = await state(page);
        return s.staff.some((p: any) => p.phase === "corridor");
      },
      { timeout: 16000, intervals: [500] },
    )
    .toBe(true);
  let s = await state(page);
  const staff = s.staff.find((a: any) => a.phase === "corridor");
  const candidate = [0, 0.3, -0.3, 0.6, -0.6]
    .map((a) => ({
      x: staff.x + Math.cos(staff.angle + a) * 65,
      y: staff.y + Math.sin(staff.angle + a) * 65,
    }))
    .find(
      (p) => !blocked(p, 13, s.obstacles) && visible(staff, p, s.obstacles),
    );
  expect(candidate).toBeTruthy();
  await pos(page, candidate!.x, candidate!.y);
  await expect
    .poll(async () => (await state(page)).spots, { timeout: 5000 })
    .toBeGreaterThan(s.spots);
  s = await state(page);
  const p = s.staff.find((a: any) => a.id === staff.id);
  await pos(page, p.x + Math.cos(p.angle) * 18, p.y + Math.sin(p.angle) * 18);
  await expect(page.locator(".hit-scene__eyebrow")).toContainText("DOOR", {
    timeout: 5000,
  });
  expect((await state(page)).lastHit.kind).toBe("door");
});
for (const viewport of [
  { width: 390, height: 844 },
  { width: 844, height: 390 },
])
  test(`hit cutaway stays in bounds and touch ACT can steal at ${viewport.width}×${viewport.height}`, async ({
    browser,
  }) => {
    const c = await browser.newContext({
      viewport,
      isMobile: true,
      hasTouch: true,
    });
    const page = await c.newPage();
    await ready(page);
    await item(page, "keyboard");
    const act = await page.locator("#touch-interact").boundingBox();
    await page.mouse.move(act!.x + act!.width / 2, act!.y + act!.height / 2);
    await page.mouse.down();
    await page.waitForFunction(
      () => window.__office.snapshot().lootValue >= 220,
    );
    await page.mouse.up();
    await page.evaluate(() => window.__office.qa.hit("paper", 10));
    await expect(page.locator(".hit-scene")).toBeVisible();
    const bounds = await page.evaluate(() => {
      const a = document.querySelector("#game")!.getBoundingClientRect(),
        b = document
          .querySelector(".hit-scene__panel")!
          .getBoundingClientRect(),
        skip = document
          .querySelector(".hit-scene__skip")!
          .getBoundingClientRect();
      return (
        b.left >= a.left &&
        b.right <= a.right &&
        b.top >= a.top &&
        b.bottom <= a.bottom &&
        skip.bottom <= a.bottom &&
        skip.height >= 44
      );
    });
    expect(bounds).toBe(true);
    await page.waitForTimeout(300);
    await page.locator(".hit-scene__skip").tap();
    await expect(page.locator(".hit-scene")).toHaveCount(0);
    await c.close();
  });
