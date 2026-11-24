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

// The hero's 3D stage loads after the page is idle (timeout 2s); give it
// that long before asserting what the wall looks like.
const ENHANCE_WINDOW_MS = 3000;

test('the wall is a plain carousel of card links on every device', async ({
  page,
}) => {
  const wall = await scrollToWall(page);
  await page.waitForTimeout(ENHANCE_WINDOW_MS);

  // The page's only WebGL canvas is the hero's (desktop): never the wall's.
  await expect(wall.locator('canvas')).toHaveCount(0);
  await expect(wall.getByRole('region', { name: WALL })).toHaveAttribute(
    'aria-roledescription',
    'carousel'
  );
  const firstLink = wall.getByTestId('media-card').first().getByRole('link');
  await expect(firstLink).toBeVisible();
  await firstLink.click();

  await expect(page).toHaveURL(DETAIL_URL);
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
