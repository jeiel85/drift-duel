import { expect, game, mode, playerCar, startRace, test } from './fixtures.js';

test.beforeEach(({}, info) => test.skip(info.project.name !== 'desktop', 'renderer behavior is the same on both'));

test('recovers from a lost WebGL context', async ({ page }) => {
  await startRace(page);
  await page.evaluate(() => {
    const gl = document.querySelector('#scene').getContext('webgl2');
    window.__loseCtx = gl.getExtension('WEBGL_lose_context');
    window.__loseCtx.loseContext();
  });
  await expect(page.locator('#gl-lost')).toBeVisible();
  expect(await mode(page)).toBe('paused');

  await page.evaluate(() => window.__loseCtx.restoreContext());
  await expect(page.locator('#gl-lost')).toBeHidden();
  await page.locator('#btn-resume').click();
  const speed0 = (await playerCar(page)).speed;
  // The scene is drawn again (not a black screen) and the race keeps going.
  await expect
    .poll(() => game(page, () => window.__driftDuel.renderer.info.render.triangles), { timeout: 20_000 })
    .toBeGreaterThan(1000);
  await expect.poll(async () => (await playerCar(page)).speed, { timeout: 20_000 }).not.toBe(speed0);
});

test('a crash in the game loop stops cleanly and offers a pre-filled bug report', async ({ page }) => {
  await startRace(page);
  await game(page, () => {
    window.__driftDuel.session.world.update = () => {
      throw new Error('e2e forced crash');
    };
  });
  await expect(page.locator('#error')).toBeVisible();
  await expect(page.locator('#error-title')).toHaveText('문제가 생겨 멈췄어요');
  const url = new URL(await page.locator('#btn-report').getAttribute('href'));
  expect(url.pathname).toBe('/jeiel85/drift-duel/issues/new');
  expect(url.searchParams.get('title')).toContain('e2e forced crash');
  expect(url.searchParams.get('body')).toMatch(/버전: \d+\.\d+\.\d+/);
  // The auto pageErrors fixture also asserts the error was caught, not thrown every frame.
});

test('without WebGL the player gets a working error screen', async ({ page, pageErrors }) => {
  // Simulate a browser/device where WebGL cannot be created.
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
      return /webgl/i.test(type) ? null : original.call(this, type, ...rest);
    };
  });
  await page.goto('play.html');
  await expect(page.locator('#error')).toBeVisible();
  await expect(page.locator('#error-title')).toHaveText('실행할 수 없어요');
  await expect(page.locator('#menu')).toBeHidden();
  const report = new URL(await page.locator('#btn-report').getAttribute('href'));
  expect(report.searchParams.get('body')).toContain('화면: startup');

  // "다시 시작" must actually reload even though startup aborted.
  const reloaded = page.waitForEvent('framenavigated');
  await page.locator('#btn-reload').click();
  await reloaded;
  // The startup failure is thrown on purpose (uncaught) after showing the screen.
  pageErrors.splice(0, pageErrors.length, ...pageErrors.filter((e) => !/WebGL/i.test(e)));
});

test('a corrupted save does not break the menu', async ({ page }) => {
  await page.goto('play.html');
  await page.evaluate(() =>
    localStorage.setItem(
      'drift-duel:v1',
      JSON.stringify({ best: { harbor: 'fast' }, races: 'many', last: { car: 42 }, assist: 'yes' }),
    ),
  );
  await page.reload();
  await expect(page.locator('#track-list .card')).toHaveCount(3);
  await expect(page.locator('#track-list')).toContainText('기록 없음');
  await expect(page.locator('#opt-assist')).toHaveAttribute('aria-pressed', 'true');
});
