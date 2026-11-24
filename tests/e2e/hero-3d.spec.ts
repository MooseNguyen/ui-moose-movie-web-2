import { expect, test, type Page } from '@playwright/test';

// The Home hero: 3D on desktop pointers (HomeHero → Hero3D), the slideshow
// (HeroSlider) everywhere else. Structure only: titles are live TMDB data.

const HERO = 'Thịnh hành tuần này';
const WALL = 'Bức tường poster thịnh hành';
const DETAIL_URL = /\/vi\/(movie|tv)\/\d+$/;
// three.js is requested only after load and idle (timeout 2s); give it that
// long before asserting that nothing was loaded.
const ENHANCE_WINDOW_MS = 3000;

const hero = (page: Page) => page.getByRole('region', { name: HERO });

/** Fails the test on any uncaught error or console error. */
function collectErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  return errors;
}

test.describe('desktop', () => {
  test.skip(({ isMobile }) => isMobile, 'desktop pointer only');

  test('swaps the slideshow for a 3D hero with working HTML controls', async ({
    page,
  }) => {
    const errors = collectErrors(page);
    await page.goto('/vi');
    const region = hero(page);
    const canvas = region.locator('canvas');
    await expect(canvas).toBeAttached({ timeout: 15_000 });
    await expect(canvas).toHaveAttribute('aria-hidden', 'true');
    await expect(region.getByTestId('hero-3d-canvas')).toHaveAttribute(
      'aria-hidden',
      'true'
    );
    // Every poster becomes a texture (CORS, cache-separated URLs).
    const total = await canvas.getAttribute('data-textures-total');
    expect(Number(total)).toBeGreaterThan(0);
    await expect(region).toHaveAttribute('data-ready', 'true', {
      timeout: 15_000,
    });

    // The selected title is HTML, and the controls are real buttons.
    // Pause first and start from title 1, so auto-advance cannot race the
    // assertions below.
    const heading = region.getByRole('heading', { level: 2 });
    await region.getByRole('button', { name: 'Tạm dừng trình chiếu' }).click();
    await region.getByRole('button', { name: 'Đến trang chiếu 1' }).click();
    const first = await heading.textContent();
    await region.getByRole('button', { name: 'Trang chiếu tiếp theo' }).click();
    await expect(heading).not.toHaveText(first!);
    await expect(
      region.getByRole('button', { name: 'Đến trang chiếu 2' })
    ).toHaveAttribute('aria-current', 'true');

    await region.getByRole('link', { name: /^Chi tiết: / }).click();
    await expect(page).toHaveURL(DETAIL_URL);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('a click on the front poster opens its Detail page', async ({
    page,
  }) => {
    await page.goto('/vi');
    const region = hero(page);
    await expect(region).toHaveAttribute('data-ready', 'true', {
      timeout: 15_000,
    });
    await region.getByRole('button', { name: 'Tạm dừng trình chiếu' }).click();
    const href = await region
      .getByRole('link', { name: /^Chi tiết: / })
      .getAttribute('href');

    // Sweep the right half until the cursor shows a poster is under it.
    const canvas = region.locator('canvas');
    const box = (await canvas.boundingBox())!;
    const cursor = () =>
      canvas.evaluate((el) => (el as HTMLElement).style.cursor);
    let found: { x: number; y: number } | null = null;
    for (const fx of [0.71, 0.68, 0.74, 0.65]) {
      for (const fy of [0.45, 0.4, 0.5, 0.35]) {
        const point = { x: box.x + box.width * fx, y: box.y + box.height * fy };
        await page.mouse.move(point.x, point.y);
        if ((await cursor()) === 'pointer') {
          found = point;
          break;
        }
      }
      if (found) break;
    }
    expect(found).not.toBeNull();
    await page.mouse.click(found!.x, found!.y);
    // The selected title at the front: its own Detail page.
    await expect(page).toHaveURL(new RegExp(`${href}$`));
  });

  test.describe('with reduced motion', () => {
    test.use({ reducedMotion: 'reduce' });

    test('keeps the slideshow and never loads the 3D scene', async ({
      page,
    }) => {
      await page.goto('/vi');
      await page.waitForTimeout(ENHANCE_WINDOW_MS);
      await expect(page.locator('canvas')).toHaveCount(0);
      await expect(page.getByTestId('hero-3d')).toHaveCount(0);
      await expect(hero(page)).toHaveAttribute(
        'aria-roledescription',
        'carousel'
      );
      await expect(
        // The slideshow keeps every slide in the DOM; the first is shown.
        hero(page)
          .getByRole('link', { name: /^Chi tiết: / })
          .first()
      ).toBeVisible();
    });
  });
});

test('mobile keeps the slideshow and never loads the 3D scene', async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, 'touch devices only');
  const errors = collectErrors(page);
  await page.goto('/vi');
  await page.waitForTimeout(ENHANCE_WINDOW_MS);
  await expect(page.locator('canvas')).toHaveCount(0);
  await expect(page.getByTestId('hero-3d')).toHaveCount(0);
  await expect(
    // The slideshow keeps every slide in the DOM; the first is shown.
    hero(page)
      .getByRole('link', { name: /^Chi tiết: / })
      .first()
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test('the trending wall is a plain carousel on every device', async ({
  page,
}) => {
  await page.goto('/vi');
  const heading = page.getByRole('heading', { level: 2, name: WALL });
  await heading.scrollIntoViewIfNeeded();
  const wall = page.locator('section', { has: heading });
  await page.waitForTimeout(ENHANCE_WINDOW_MS);
  await expect(wall.locator('canvas')).toHaveCount(0);
  await expect(wall.getByRole('region', { name: WALL })).toHaveAttribute(
    'aria-roledescription',
    'carousel'
  );
  await wall.getByTestId('media-card').first().getByRole('link').click();
  await expect(page).toHaveURL(DETAIL_URL);
});

for (const viewport of [
  { width: 1280, height: 800 },
  { width: 360, height: 740 },
]) {
  test(`Home causes no horizontal scroll at ${viewport.width}px`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto('/vi');
    await page.waitForTimeout(ENHANCE_WINDOW_MS);
    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
  });
}
