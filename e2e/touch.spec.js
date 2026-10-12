import { expect, game, playerCar, sleep, startRace, test, touchSession } from './fixtures.js';

test.beforeEach(({}, info) => test.skip(info.project.name !== 'mobile', 'touch flow'));

test('settings toggles persist', async ({ page }) => {
  await page.goto('play.html');
  const stored = () => page.evaluate(() => JSON.parse(localStorage.getItem('drift-duel:v1') ?? '{}'));
  await page.locator('#opt-assist').tap();
  expect((await stored()).assist).toBe(false);
  await expect(page.locator('#opt-assist')).toHaveAttribute('aria-pressed', 'false');
  await page.locator('#opt-haptics').tap();
  expect((await stored()).haptics).toBe(false);
});

test('touch guide shows during the countdown and hides after the start', async ({ page }) => {
  await page.goto('play.html');
  await page.locator('#btn-start').tap();
  await expect(page.locator('#touch-guide')).toBeVisible();
  await expect(page.locator('#touch-guide')).toBeHidden({ timeout: 20_000 });
});

test('tap steers a little, hold steers fully, both halves brake', async ({ page }) => {
  await startRace(page);
  const touch = await touchSession(page);
  await expect.poll(async () => (await playerCar(page)).speed, { timeout: 20_000 }).toBeGreaterThan(15);

  await touch('touchStart', [{ x: 330, y: 600, id: 1 }]);
  await sleep(60);
  const tap = (await playerCar(page)).steer;
  expect(tap).toBeLessThan(0.5);
  // Poll instead of sleeping: on CI's software renderer a frame can take longer
  // than the 0.1 s step cap, so wall-clock time outruns game time.
  await expect.poll(async () => (await playerCar(page)).steer, { timeout: 10_000 }).toBeGreaterThan(0.95);
  await touch('touchEnd', []);

  // The full-lock hold may have scrubbed speed on a barrier; brake from speed again.
  await expect.poll(async () => (await playerCar(page)).forwardSpeed, { timeout: 20_000 }).toBeGreaterThan(15);
  const before = (await playerCar(page)).forwardSpeed;
  await touch('touchStart', [
    { x: 60, y: 600, id: 1 },
    { x: 330, y: 600, id: 2 },
  ]);
  await sleep(700);
  await touch('touchEnd', []);
  expect((await playerCar(page)).forwardSpeed).toBeLessThan(before - 5);
});

test('swipe up fires nitro until tapped off; an empty tank does nothing', async ({ page }) => {
  await startRace(page);
  const touch = await touchSession(page);
  await game(page, () => (window.__driftDuel.session.player.car.nitro = 1));

  // A real flick: 90 px up in two quick moves (the game requires >45 px within 450 ms).
  await touch('touchStart', [{ x: 300, y: 650, id: 1 }]);
  await touch('touchMove', [{ x: 300, y: 600, id: 1 }]);
  await touch('touchMove', [{ x: 300, y: 560, id: 1 }]);
  await touch('touchEnd', []);
  await sleep(400);
  expect((await playerCar(page)).boosting).toBe(true); // still on after the finger lifted

  await page.locator('#btn-nitro').tap();
  await expect.poll(async () => (await playerCar(page)).boosting).toBe(false);

  await game(page, () => (window.__driftDuel.session.player.car.nitro = 0.05));
  await page.locator('#btn-nitro').tap();
  await sleep(300);
  expect((await playerCar(page)).boosting).toBe(false);
});

test('pause button is a comfortable tap target', async ({ page }) => {
  await startRace(page);
  const box = await page.locator('#btn-pause').boundingBox();
  expect(box.width).toBeGreaterThanOrEqual(44);
  expect(box.height).toBeGreaterThanOrEqual(44);
});
