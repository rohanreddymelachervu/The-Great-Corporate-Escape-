import { test, expect, Page } from "@playwright/test";
declare global {
  interface Window {
    __office: any;
  }
}
const state = (p: Page) => p.evaluate(() => window.__office.snapshot());
async function ready(p: Page, qa = false) {
  await p.goto("/" + (qa ? "?qa=1" : ""));
  await p.waitForFunction(() => window.__office?.ready());
}
async function start(p: Page, level = 1) {
  if (level === 1) await p.getByRole("button", { name: "CLOCK OUT" }).click();
  else await p.evaluate((l) => window.__office.qa.start(l), level);
  await p.waitForFunction(
    (l) =>
      window.__office.snapshot().level === l &&
      window.__office.snapshot().elapsed > 0.1,
    level,
  );
}
async function position(p: Page, x: number, y: number) {
  await p.evaluate(([x, y]) => window.__office.qa.position(x, y), [x, y]);
  await p.waitForTimeout(100);
}
async function travel(p: Page, axis: "x" | "y", goal: number) {
  const now = (await state(p)).pos[axis],
    key = axis === "x" ? (goal > now ? "d" : "a") : goal > now ? "s" : "w";
  await p.keyboard.down(key);
  try {
    await p.waitForFunction(
      ({ axis, goal, positive }) => {
        const s = window.__office.snapshot();
        const n = s.pos[axis];
        return s.ended || (positive ? n >= goal - 2 : n <= goal + 2);
      },
      { axis, goal, positive: goal > now },
      { timeout: 12000, polling: "raf" },
    );
  } finally {
    await p.keyboard.up(key);
  }
}
test("menu, guide, floor locks, achievements and sound settings are real", async ({
  page,
}) => {
  await ready(page);
  await expect(page.locator("canvas")).toBeVisible();
  await page.getByRole("button", { name: "HOW TO ESCAPE" }).click();
  await expect(
    page.getByRole("heading", { name: "THE SURVIVAL GUIDE." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "GOT IT. LEAVING." }).click();
  await page.getByRole("button", { name: "CHOOSE FLOOR" }).click();
  await expect(page.locator('[data-floor="2"]')).toBeDisabled();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("button", { name: "ACHIEVEMENTS" }).click();
  await expect(page.locator(".achievement")).toHaveCount(12);
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByLabel("Music volume").fill("0.2");
  await page.getByLabel("Mute all audio").check();
  await page.getByRole("button", { name: "DONE" }).click();
  await expect(page.locator("#sound-btn")).toHaveText("MUTED");
  await page.reload();
  await expect(page.locator("#sound-btn")).toHaveText("MUTED");
});
test("keyboard movement, walls, coffee charges, pause and instant restart", async ({
  page,
}) => {
  await ready(page);
  await start(page);
  await page.keyboard.down("a");
  await page.waitForTimeout(700);
  await page.keyboard.up("a");
  expect((await state(page)).pos.x).toBeGreaterThanOrEqual(34);
  await page.keyboard.press("1");
  expect((await state(page)).coffee).toBe(1);
  await page.keyboard.press("Escape");
  const before = await state(page);
  await page.waitForTimeout(600);
  expect((await state(page)).elapsed).toBe(before.elapsed);
  await page.getByRole("button", { name: "RESTART FLOOR" }).click();
  await page.waitForFunction(
    () =>
      window.__office.snapshot().coffee === 2 &&
      window.__office.snapshot().elapsed < 1,
  );
  expect((await state(page)).hits).toBe(0);
});
test("complete floor 1 with actual keyboard movement; no teleport or completion hooks", async ({
  page,
}) => {
  await ready(page);
  await start(page);
  await travel(page, "x", 330);
  await travel(page, "y", 240);
  await travel(page, "x", 220);
  expect((await state(page)).collected).toContain("l1-badge");
  await travel(page, "x", 330);
  await travel(page, "y", 600);
  await travel(page, "x", 650);
  await travel(page, "y", 650);
  await page.keyboard.press("e");
  await expect(page.locator("#objectives")).toContainText("REACH THE ELEVATOR");
  await travel(page, "y", 700);
  await travel(page, "x", 1030);
  await travel(page, "y", 115);
  await expect(
    page.getByRole("heading", { name: "OUT OF OFFICE." }),
  ).toBeVisible();
  await expect(page.locator(".result-achievements")).toContainText(
    "Professional Ghost",
  );
  await page.getByRole("button", { name: "NEXT FLOOR" }).click();
  await page.waitForFunction(() => window.__office.snapshot().level === 2);
});
test("hiding, coffee recovery and movement cancel", async ({ page }) => {
  await ready(page, true);
  await start(page);
  await position(page, 190, 450);
  await page.keyboard.press("e");
  expect((await state(page)).hidden).toBe(true);
  await page.keyboard.down("d");
  await page.waitForTimeout(180);
  await page.keyboard.up("d");
  expect((await state(page)).hidden).toBe(false);
  await page.evaluate(() => window.__office.qa.bs(65));
  await position(page, 550, 652);
  await page.keyboard.press("e");
  expect((await state(page)).bs).toBeLessThan(50);
  expect((await state(page)).coffee).toBe(3);
});
test("advanced abilities have timers, stationary camouflage cancels, VPN stops enemy movement", async ({
  page,
}) => {
  await ready(page, true);
  await start(page, 4);
  await page.keyboard.press("2");
  expect((await state(page)).active.call).toBeGreaterThan(6);
  await page.keyboard.press("3");
  expect((await state(page)).active.slack).toBeGreaterThan(7);
  await page.keyboard.down("d");
  await page.waitForTimeout(200);
  await page.keyboard.up("d");
  expect((await state(page)).active.slack).toBe(0);
  await page.keyboard.press("5");
  const a = (await state(page)).enemies;
  await page.waitForTimeout(400);
  const b = (await state(page)).enemies;
  expect(b.map((e: any) => [e.x, e.y])).toEqual(a.map((e: any) => [e.x, e.y]));
  await page.keyboard.press("4");
  expect((await state(page)).active.calendar).toBeGreaterThan(6);
});
test("BS failure is real and retry resets state", async ({ page }) => {
  await ready(page, true);
  await start(page);
  await page.evaluate(() => window.__office.qa.bs(100));
  await expect(
    page.getByRole("heading", { name: "PROMOTED TO STAYING LATE." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "RETRY INSTANTLY" }).click();
  await page.waitForFunction(
    () =>
      window.__office.snapshot().bs === 0 && !window.__office.snapshot().ended,
  );
  expect((await state(page)).coffee).toBe(2);
});
for (const level of [2, 3, 4, 5])
  test(`floor ${level} required badge/switch and elevator trigger win (QA positioning, real rules)`, async ({
    page,
  }) => {
    await ready(page, true);
    await start(page, level);
    const { LEVELS } = await import("../src/game/levels");
    const l = LEVELS[level - 1],
      badge = l.items.find((i) => i.kind === "badge")!,
      sw = l.interactions.find((i) => l.required.includes(i.id))!;
    await position(page, badge.x, badge.y);
    expect((await state(page)).collected).toContain(badge.id);
    await position(page, sw.x, sw.y);
    await page.keyboard.press("e");
    expect((await state(page)).used).toContain(sw.id);
    await position(page, l.exit.x + l.exit.w / 2, l.exit.y + l.exit.h / 2);
    await expect(
      page.getByRole("heading", {
        name: level === 5 ? "YOU HAVE A LIFE." : "OUT OF OFFICE.",
      }),
    ).toBeVisible();
  });
test("rare WFH token opens a genuine alternative exit", async ({ page }) => {
  await ready(page, true);
  await start(page, 5);
  const { LEVELS } = await import("../src/game/levels");
  const l = LEVELS[4];
  for (const id of l.required) {
    const item = l.items.find((i) => i.id === id);
    if (item) await position(page, item.x, item.y);
    else {
      const sw = l.interactions.find((i) => i.id === id)!;
      await position(page, sw.x, sw.y);
      await page.keyboard.press("e");
    }
  }
  const token = l.items.find((i) => i.kind === "wfh")!;
  await position(page, token.x, token.y);
  await page.keyboard.press("6");
  await expect(page.locator("#ability-wfh")).toHaveText("APPROVED");
  const alt = l.altExit!;
  await position(page, alt.x + alt.w / 2, alt.y + alt.h / 2);
  await expect(page.locator(".result-achievements")).toContainText(
    "Remote Possibility",
  );
});
test("daily uses the same UTC seed and advertises honest local scoring", async ({
  page,
}) => {
  await ready(page);
  await page.getByRole("button", { name: "DAILY ESCAPE" }).click();
  await expect(page.locator("#modal-root")).toContainText("honor-system");
  await page.getByRole("button", { name: "ATTEMPT TODAY" }).click();
  await page.waitForFunction(
    () => !document.querySelector("#hud")!.hasAttribute("hidden"),
  );
  const seed = new Date().toISOString().slice(0, 10);
  await expect(page.locator("#run-mode")).toContainText(seed);
});
test("mobile portrait joystick, ability buttons and no page overflow", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  await ready(page);
  await page.getByRole("button", { name: "CLOCK OUT" }).tap();
  await page.waitForTimeout(250);
  const before = await state(page),
    r = await page.locator("#joystick").boundingBox();
  expect(r).not.toBeNull();
  await page.dispatchEvent("#joystick", "pointerdown", {
    pointerId: 1,
    clientX: r!.x + r!.width / 2 + 29,
    clientY: r!.y + r!.height / 2,
    pointerType: "touch",
    buttons: 1,
  });
  await page.waitForTimeout(450);
  await page.dispatchEvent("#joystick", "pointerup", {
    pointerId: 1,
    pointerType: "touch",
  });
  expect((await state(page)).pos.x).toBeGreaterThan(before.pos.x + 15);
  await page.locator('[data-ability="coffee"]').tap();
  expect((await state(page)).coffee).toBe(1);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: "test-results/mobile-portrait.png" });
  await context.close();
});
