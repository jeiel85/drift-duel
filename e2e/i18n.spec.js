import { expect, test } from './fixtures.js';

test.beforeEach(({}, info) => test.skip(info.project.name !== 'desktop', 'menu text only'));

const HANGUL = /[가-힣]/;
/** Visible text of the page, minus the button that offers Korean. */
const visibleText = (page) =>
  page.evaluate(() => {
    const out = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const el = walker.currentNode.parentElement;
      if (el.closest('#btn-lang') || !el.checkVisibility()) continue;
      out.push(walker.currentNode.textContent.trim());
    }
    return out.filter(Boolean).join(' | ');
  });

test('English UI has no Korean left, and the switch goes to Korean and stays', async ({ page }) => {
  await page.goto('play.html?lang=en');
  await expect(page.locator('#btn-start')).toHaveText('Start race');
  await expect(page.locator('#track-list .card')).toHaveCount(3);
  expect(await page.locator('html').getAttribute('lang')).toBe('en');
  const text = await visibleText(page);
  expect(text.match(new RegExp(`.{0,20}${HANGUL.source}.{0,20}`, 'g')) ?? []).toEqual([]);
  // Attribute text too (aria-labels).
  const aria = await page.evaluate(() => [...document.querySelectorAll('[aria-label]:not(#btn-lang)')].map((e) => e.getAttribute('aria-label')));
  expect(aria.filter((a) => HANGUL.test(a))).toEqual([]);

  // Menu picks survive the language reload.
  await page.locator('[data-track="1"]').click();
  await page.locator('[data-car="bruiser"]').click();
  await page.locator('[data-skill="hard"]').click();
  await page.locator('#btn-lang').click();
  await expect(page.locator('#btn-start')).toHaveText('레이스 시작');
  await expect(page.locator('#track-list .card.on')).toContainText('Red Canyon');
  await expect(page.locator('#car-list .card.on')).toContainText('Bruiser V8');
  await expect(page.locator('#skill-list .on')).toHaveText('Hard');
  expect(new URL(page.url()).searchParams.get('lang')).toBeNull(); // saved, so the URL is clean
  await page.reload();
  await expect(page.locator('#btn-lang')).toHaveText('English');
});

test('with storage blocked the language switch still works through the URL', async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException('blocked', 'SecurityError');
    };
    Storage.prototype.getItem = () => {
      throw new DOMException('blocked', 'SecurityError');
    };
  });
  await page.goto('play.html?lang=ko&track=harbor');
  await expect(page.locator('#btn-start')).toHaveText('레이스 시작');
  await page.locator('[data-track="2"]').click();
  await page.locator('#btn-lang').click();
  await expect(page.locator('#btn-start')).toHaveText('Start race');
  const params = new URL(page.url()).searchParams;
  expect(params.get('lang')).toBe('en');
  expect(params.get('track')).toBe('neon');
  await expect(page.locator('#track-list .card.on')).toContainText('Neon Rain');
});

test('inside a portal iframe the about link opens the public web build', async ({ page }) => {
  await page.route('**/portal-test.html', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><iframe src="/play.html?lang=en" allow="clipboard-write \'none\'" width="960" height="600"></iframe>',
    }),
  );
  await page.goto('portal-test.html');
  const game = page.frameLocator('iframe');
  await expect(game.locator('#btn-start')).toHaveText('Start race');
  const about = game.locator('#link-about');
  await expect(about).toHaveAttribute('href', 'https://jeiel85.github.io/drift-duel/');
  await expect(about).toHaveAttribute('target', '_blank');
});
