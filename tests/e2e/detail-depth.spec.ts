import { expect, test, type Locator, type Page } from '@playwright/test';

// Layered parallax in the Detail hero (DetailHeroDepth + globals.css).

const PAGE = '/vi/movie/550';
const layer = (page: Page, name: string) =>
  page.locator(`[data-depth-layer="${name}"]`);
const transform = (locator: Locator) =>
  locator.evaluate((element) => getComputedStyle(element).transform);

function collectErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  return errors;
}

test.describe('desktop', () => {
  test.skip(({ isMobile }) => isMobile, 'covered by the touch test below');

  test('layers move apart with the pointer and the scroll', async ({
    page,
  }) => {
    const errors = collectErrors(page);
    await page.goto(PAGE);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.locator('[data-depth-active]')).toHaveCount(1);
    // At rest every layer is exactly where it was rendered: its box with
    // the depth transform equals its box without any transform.
    for (const name of ['backdrop', 'poster', 'text']) {
      const shift = await layer(page, name).evaluate((element) => {
        const html = element as HTMLElement;
        const withDepth = html.getBoundingClientRect();
        html.style.transform = 'none';
        const flat = html.getBoundingClientRect();
        html.style.transform = '';
        return Math.max(
          Math.abs(withDepth.x - flat.x),
          Math.abs(withDepth.y - flat.y),
          Math.abs(withDepth.width - flat.width)
        );
      });
      expect(shift, name).toBeLessThan(0.5);
    }

    const poster = await layer(page, 'poster').boundingBox();
    await page.mouse.move(poster!.x + 10, poster!.y + 10);
    await page.mouse.move(1200, 120, { steps: 4 });
    await expect
      .poll(() => transform(layer(page, 'poster')))
      .toMatch(/^matrix3d/);

    await page.mouse.wheel(0, 200);
    await expect
      .poll(() => transform(layer(page, 'backdrop')))
      .not.toBe('none');
    // The text plane stays readable: it only shifts by a few pixels.
    const text = await layer(page, 'text').evaluate(
      (element) => new DOMMatrix(getComputedStyle(element).transform).m41
    );
    expect(Math.abs(text)).toBeLessThanOrEqual(4);
    expect(errors).toEqual([]);
  });

  test.describe('with reduced motion', () => {
    test.use({ reducedMotion: 'reduce' });

    test('layers stay flat', async ({ page }) => {
      await page.goto(PAGE);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await page.mouse.move(1200, 120, { steps: 4 });
      await page.mouse.wheel(0, 200);
      await expect(page.locator('[data-depth-active]')).toHaveCount(0);
      for (const name of ['backdrop', 'poster', 'text']) {
        expect(await transform(layer(page, name))).toBe('none');
      }
    });
  });
});

test('layers stay flat on touch devices', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'touch only');
  await page.goto(PAGE);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 200));
  await expect(page.locator('[data-depth-active]')).toHaveCount(0);
  for (const name of ['backdrop', 'poster', 'text']) {
    expect(await transform(layer(page, name))).toBe('none');
  }
});
