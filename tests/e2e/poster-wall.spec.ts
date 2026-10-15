import { expect, test, type Page } from '@playwright/test';

const WALL = 'Bức tường poster thịnh hành';
const DETAIL_URL = /\/vi\/(movie|tv)\/\d+$/;

/** The wall's section: its h2 sits outside the carousel region. */
async function scrollToWall(page: Page) {
  await page.goto('/vi');
  const heading = page.getByRole('heading', { level: 2, name: WALL });
  await heading.scrollIntoViewIfNeeded();
  return page.locator('section', { has: heading });
}

// three.js is requested only after the browser is idle (timeout 2s); give it
// that long before asserting that nothing was loaded.
const ENHANCE_WINDOW_MS = 3000;

test.describe('desktop', () => {
  test.skip(({ isMobile }) => isMobile, 'desktop pointer only');

  test('enhances the wall into a 3D canvas that opens a detail page', async ({
    page,
  }) => {
    const wall = await scrollToWall(page);
    const canvas = wall.locator('canvas');
    await expect(canvas).toBeVisible({ timeout: 15_000 });
    await expect(canvas).toHaveAttribute('aria-hidden', 'true');
    await expect(wall.getByTestId('poster-wall-fallback')).toHaveAttribute(
      'data-scene',
      'ready'
    );

    // Scroll into the track so the stage is pinned under the header, then
    // sweep along the middle row until the cursor shows a poster is under it
    // (cards alternate with gaps).
    await page.evaluate(() => {
      const track = document.querySelector('[data-testid=poster-wall-track]')!;
      window.scrollTo(
        0,
        track.getBoundingClientRect().top + window.scrollY + 200
      );
    });
    await expect
      .poll(async () => Math.round((await canvas.boundingBox())!.y))
      .toBe(64);
    const box = (await canvas.boundingBox())!;
    const y = box.y + box.height / 2;
    const cursor = () =>
      canvas.evaluate((el) => (el as HTMLElement).style.cursor);
    let x = box.x + box.width / 2;
    for (let step = 0; step < 20; step++) {
      await page.mouse.move(x, y);
      if ((await cursor()) === 'pointer') break;
      x += step % 2 === 0 ? (step + 1) * 20 : -(step + 1) * 20;
    }
    expect(await cursor()).toBe('pointer');
    await page.mouse.click(x, y);

    await expect(page).toHaveURL(DETAIL_URL);
  });

  test('keeps the grid links keyboard accessible over the canvas', async ({
    page,
  }) => {
    const wall = await scrollToWall(page);
    await expect(wall.locator('canvas')).toBeVisible({ timeout: 15_000 });
    const fallback = wall.getByTestId('poster-wall-fallback');
    await expect(fallback).toHaveCSS('opacity', '0');

    const firstLink = wall.getByTestId('media-card').first().getByRole('link');
    await firstLink.focus();
    // Focus reveals the carousel on an opaque surface, so the focus ring
    // and the titles are never invisible.
    await expect(fallback).toHaveCSS('opacity', '1');
    await expect(fallback).not.toHaveCSS(
      'background-color',
      'rgba(0, 0, 0, 0)'
    );
    await page.keyboard.press('Enter');

    await expect(page).toHaveURL(DETAIL_URL);
  });

  test.describe('with reduced motion', () => {
    test.use({ reducedMotion: 'reduce' });

    test('shows the carousel and never loads the 3D scene', async ({
      page,
    }) => {
      const wall = await scrollToWall(page);
      await page.waitForTimeout(ENHANCE_WINDOW_MS);
      await expect(wall.locator('canvas')).toHaveCount(0);
      await expect(wall.getByRole('region', { name: WALL })).toHaveAttribute(
        'aria-roledescription',
        'carousel'
      );
      await expect(
        wall.getByTestId('media-card').first().getByRole('link')
      ).toBeVisible();
    });
  });
});

test('mobile shows the carousel and never loads the 3D scene', async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, 'touch devices only');
  const wall = await scrollToWall(page);
  await page.waitForTimeout(ENHANCE_WINDOW_MS);
  await expect(wall.locator('canvas')).toHaveCount(0);
  await expect(wall.getByRole('region', { name: WALL })).toHaveAttribute(
    'aria-roledescription',
    'carousel'
  );
  await expect(
    wall.getByTestId('media-card').first().getByRole('link')
  ).toBeVisible();
});

for (const viewport of [
  { width: 1280, height: 800 },
  { width: 360, height: 740 },
]) {
  test(`the wall causes no horizontal scroll at ${viewport.width}px`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await scrollToWall(page);
    await page.waitForTimeout(ENHANCE_WINDOW_MS);
    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
  });
}
