import { expect, test } from './fixtures.js';

test('desktop embeds the live demo', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop');
  await page.goto('./');
  await expect(page.frameLocator('#demo iframe').locator('#btn-start')).toBeVisible();
});

test('mobile: poster opens the game, sticky play bar, no overflow, 44px targets', async ({ page }, info) => {
  test.skip(info.project.name !== 'mobile');
  await page.goto('./');
  await expect(page.locator('#demo iframe')).toHaveCount(0);

  const layout = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth - window.innerWidth,
    small: [...document.querySelectorAll('a, button')]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        const hidden = el.hidden || el.closest('[hidden]') || (el.id === 'sticky-cta' && !el.classList.contains('show'));
        return !hidden && r.width > 0 && (r.width < 44 || r.height < 44);
      })
      .map((el) => el.textContent.trim()),
  }));
  expect(layout.overflow).toBe(0);
  expect(layout.small).toEqual([]);

  const sticky = page.locator('#sticky-cta');
  await expect(sticky).not.toHaveClass(/show/);
  await page.evaluate(() => window.scrollTo(0, 1400));
  await expect(sticky).toHaveClass(/show/);
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(sticky).not.toHaveClass(/show/);

  await page.locator('#demo-screen').tap();
  await expect(page).toHaveURL(/play\.html/);
});
