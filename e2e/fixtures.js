import { test as base, expect } from '@playwright/test';

// Every test fails if the page throws, logs an error, or a request fails.
export const test = base.extend({
  pageErrors: [
    async ({ page }, use) => {
      const errors = [];
      page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
      page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text()}`));
      page.on('response', (r) => r.status() >= 400 && errors.push(`${r.status()} ${r.url()}`));
      await use(errors);
      expect(errors, 'page errors').toEqual([]);
    },
    { auto: true },
  ],
});
export { expect };

/** Run a function against the dev-only game hook (window.__driftDuel). */
export const game = (page, fn, arg) => page.evaluate(fn, arg);
export const mode = (page) => page.evaluate(() => window.__driftDuel.mode);
export const playerCar = (page) =>
  page.evaluate(() => {
    const c = window.__driftDuel.session.player.car;
    return { speed: c.speed, forwardSpeed: c.forwardSpeed, steer: c.steer, nitro: c.nitro, boosting: c.boosting, drifting: c.drifting };
  });

/** Open the game, press start and wait for the green light. */
export async function startRace(page, query = 'track=harbor&car=vela&skill=easy') {
  await page.goto(`play.html?${query}`);
  await expect(page.locator('#menu')).toBeVisible();
  await page.locator('#btn-start').click();
  await expect(page.locator('#countdown')).toBeVisible();
  await expect.poll(() => mode(page), { timeout: 20_000 }).toBe('race');
}

/** Raw touch input through CDP (Playwright's tap() cannot hold or swipe). */
export async function touchSession(page) {
  const cdp = await page.context().newCDPSession(page);
  return (type, points) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points });
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
