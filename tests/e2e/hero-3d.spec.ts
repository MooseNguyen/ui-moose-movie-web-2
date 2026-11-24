import { expect, test, type Page } from '@playwright/test';

const HERO = 'Thịnh hành tuần này';
const DETAIL_URL = /\/vi\/(movie|tv)\/\d+$/;

// three.js is requested only after load + idle (timeout 2s); give it that
// long before asserting that nothing was loaded.
const ENHANCE_WINDOW_MS = 3000;

const hero = (page: Page) => page.getByRole('region', { name: HERO });
const stageCanvas = (page: Page) =>
  page.getByTestId('hero-stage-canvas').locator('canvas');

/** Collects console errors and uncaught exceptions for the whole test. */
function collectErrors(page: Page) {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}

/** Stops autoplay so the selection only changes on purpose. */
async function pauseSlideshow(page: Page) {
  await hero(page)
    .getByRole('button', { name: 'Tạm dừng trình chiếu' })
    .click();
}

test.describe('desktop', () => {
  test.skip(({ isMobile }) => isMobile, 'desktop pointer only');

  test('fades in a decorative 3D stage over the slider, without console errors', async ({
    page,
  }) => {
    const errors = collectErrors(page);
    await page.goto('/vi');
    const stage = page.getByTestId('hero-stage');
    await expect(stage).toHaveAttribute('data-hero-stage', 'ready', {
      timeout: 15_000,
    });
    await expect(stage).toHaveAttribute('aria-hidden', 'true');
    await expect(stageCanvas(page)).toBeVisible();
    // One WebGL context per page: the hero's.
    await expect(page.locator('canvas')).toHaveCount(1);

    // The server-rendered slide stays the content: heading, details link
    // and trailer button of the selected title.
    const slide = hero(page).getByRole('group', { name: /^1 \// });
    await expect(slide.getByRole('heading', { level: 2 })).toBeVisible();
    await expect(
      slide.getByRole('link', { name: /^Chi tiết: / })
    ).toBeVisible();
    await expect(slide.getByRole('button', { name: /^Trailer/ })).toBeVisible();

    const canvas = stageCanvas(page);
    const total = await canvas.getAttribute('data-textures-total');
    expect(Number(total)).toBeGreaterThan(0);
    await expect(canvas).toHaveAttribute('data-textures-loaded', total!, {
      timeout: 15_000,
    });
    expect(errors).toEqual([]);
  });

  test('the slider controls drive the 3D selection, and Details opens it', async ({
    page,
  }) => {
    await page.goto('/vi');
    await expect(stageCanvas(page)).toBeVisible({ timeout: 15_000 });
    await pauseSlideshow(page);
    const canvas = stageCanvas(page);
    await expect(canvas).toHaveAttribute('data-selected', '0');

    await hero(page)
      .getByRole('button', { name: 'Trang chiếu tiếp theo' })
      .click();
    await expect(canvas).toHaveAttribute('data-selected', '1');
    await hero(page).getByRole('button', { name: 'Đến trang chiếu 3' }).click();
    await expect(canvas).toHaveAttribute('data-selected', '2');

    const slide = hero(page).getByRole('group', { name: /^3 \// });
    const title = await slide.getByRole('heading', { level: 2 }).textContent();
    await slide.getByRole('link', { name: `Chi tiết: ${title}` }).click();
    await expect(page).toHaveURL(DETAIL_URL);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(title!);
  });

  test('keyboard arrows on the hero turn the 3D selection too', async ({
    page,
  }) => {
    await page.goto('/vi');
    await expect(stageCanvas(page)).toBeVisible({ timeout: 15_000 });
    await pauseSlideshow(page);
    // Focus stays inside the region (on the pause toggle).
    await page.keyboard.press('ArrowRight');
    await expect(stageCanvas(page)).toHaveAttribute('data-selected', '1');
  });

  test('clicking the front poster opens its detail page', async ({ page }) => {
    await page.goto('/vi');
    const canvas = stageCanvas(page);
    await expect(canvas).toBeVisible({ timeout: 15_000 });
    await pauseSlideshow(page);
    const total = await canvas.getAttribute('data-textures-total');
    await expect(canvas).toHaveAttribute('data-textures-loaded', total!, {
      timeout: 15_000,
    });

    // Sweep around the middle of the stage until the cursor shows a poster
    // that has faded in under the pointer.
    const box = (await canvas.boundingBox())!;
    const y = box.y + box.height / 2;
    const cursor = () =>
      canvas.evaluate((el) => (el as HTMLElement).style.cursor);
    let x = box.x + box.width / 2;
    for (let step = 0; step < 12; step++) {
      await page.mouse.move(x, y);
      await page.waitForTimeout(100);
      if ((await cursor()) === 'pointer') break;
      x += 20;
    }
    expect(await cursor()).toBe('pointer');
    await page.mouse.click(x, y);

    await expect(page).toHaveURL(DETAIL_URL);
  });

  test('loads every poster texture even when the HTTP cache holds no-cors copies', async ({
    page,
  }) => {
    // TMDB sends Access-Control-Allow-Origin only to CORS requests and does
    // not vary its cache on Origin. Reproduce an earlier visit (or any plain
    // <img>) caching the hero's w342 poster URLs without CORS headers.
    await page.goto('/vi/movie');
    const warmed = await page.evaluate(async (heroName) => {
      const html = await (await fetch('/vi')).text();
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const region = doc.querySelector(`[aria-label="${heroName}"]`);
      const paths = [
        ...new Set(
          [...(region?.querySelectorAll('img') ?? [])]
            .map((img) =>
              /image\.tmdb\.org\/t\/p\/\w+(\/[^?\s]+)/.exec(img.src)
            )
            .filter((match) => match !== null)
            .map((match) => match[1])
        ),
      ];
      await Promise.all(
        paths.map(
          (path) =>
            new Promise((resolve) => {
              const img = new Image(); // no crossOrigin: a no-cors request
              img.onload = img.onerror = resolve;
              img.src = `https://image.tmdb.org/t/p/w342${path}`;
            })
        )
      );
      return paths.length;
    }, HERO);
    expect(warmed).toBeGreaterThan(0);

    const errors = collectErrors(page);
    await page.goto('/vi');
    const canvas = stageCanvas(page);
    await expect(canvas).toBeVisible({ timeout: 15_000 });
    const total = await canvas.getAttribute('data-textures-total');
    await expect(canvas).toHaveAttribute('data-textures-loaded', total!, {
      timeout: 15_000,
    });
    expect(errors).toEqual([]);
  });

  test('a narrow desktop window keeps the plain slider', async ({ page }) => {
    await page.setViewportSize({ width: 900, height: 800 });
    await page.goto('/vi');
    await expect(hero(page)).toBeVisible();
    await page.waitForTimeout(ENHANCE_WINDOW_MS);
    await expect(page.locator('canvas')).toHaveCount(0);
  });

  test.describe('with reduced motion', () => {
    test.use({ reducedMotion: 'reduce' });

    test('shows the slider and never loads the 3D scene', async ({ page }) => {
      const requests: string[] = [];
      page.on('request', (request) => requests.push(request.url()));
      await page.goto('/vi');
      await expect(hero(page)).toBeVisible();
      await page.waitForTimeout(ENHANCE_WINDOW_MS);
      await expect(page.getByTestId('hero-stage')).toHaveCount(0);
      await expect(page.locator('canvas')).toHaveCount(0);
      // No CORS texture request was ever made.
      expect(requests.filter((url) => url.includes('cors=1'))).toEqual([]);
    });
  });
});

test('mobile shows the slider and never loads the 3D scene', async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, 'touch devices only');
  const requests: string[] = [];
  page.on('request', (request) => requests.push(request.url()));
  await page.goto('/vi');
  const slide = hero(page).getByRole('group', { name: /^1 \// });
  await expect(slide.getByRole('heading', { level: 2 })).toBeVisible();
  await page.waitForTimeout(ENHANCE_WINDOW_MS);
  await expect(page.getByTestId('hero-stage')).toHaveCount(0);
  await expect(page.locator('canvas')).toHaveCount(0);
  expect(requests.filter((url) => url.includes('cors=1'))).toEqual([]);
});
