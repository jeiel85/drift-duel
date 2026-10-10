import { expect, game, mode, playerCar, startRace, test } from './fixtures.js';

test.beforeEach(({}, info) => test.skip(info.project.name !== 'desktop', 'keyboard flow'));

test('full race: countdown, drift, pause, nitro, finish, results and save', async ({ page }) => {
  await startRace(page);
  await expect.poll(async () => (await playerCar(page)).speed, { timeout: 20_000 }).toBeGreaterThan(15);

  await page.keyboard.down('ArrowRight');
  await expect.poll(async () => (await playerCar(page)).drifting).toBe(true);
  await page.keyboard.up('ArrowRight');

  await page.keyboard.press('KeyP');
  await expect(page.locator('#pause')).toBeVisible();
  expect(await mode(page)).toBe('paused');
  await page.locator('#btn-resume').click();
  expect(await mode(page)).toBe('race');

  await game(page, () => (window.__driftDuel.session.player.car.nitro = 1));
  await page.keyboard.down('Space');
  await expect.poll(async () => (await playerCar(page)).boosting).toBe(true);
  await page.keyboard.up('Space');

  // Hand the car to the autopilot for a one-lap finish.
  await game(page, () => {
    const s = window.__driftDuel.session;
    s.player.isBot = true;
    s.laps = 1;
  });
  await expect.poll(() => mode(page), { timeout: 120_000 }).toBe('results');
  await expect(page.locator('#results')).toBeVisible();
  await expect(page.locator('#res-time')).toHaveText(/^\d+:\d{2}\.\d{2}$/);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('drift-duel:v1')));
  expect(saved.races).toBe(1);
  expect(saved.best.harbor).toBeGreaterThan(0);

  await page.locator('#btn-menu').click();
  await expect(page.locator('#menu')).toBeVisible();
  await expect(page.locator('#track-list')).toContainText('베스트');
});
