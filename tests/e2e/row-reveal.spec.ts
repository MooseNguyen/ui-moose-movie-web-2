import { expect, test, type Locator, type Page } from '@playwright/test';

// Scroll-driven reveal of media rows (CSS `animation-timeline`, see
// globals.css). Structure only: no assertions on specific titles.

const rows = (page: Page) => page.locator('section.row-reveal');

async function style(locator: Locator, property: 'animationName' | 'opacity') {
  return locator.evaluate(
    (element, prop) => getComputedStyle(element)[prop],
    property
  );
}

test.describe('row reveal', () => {
  test('rows animate and end fully visible once scrolled into view', async ({
    page,
  }) => {
    await page.goto('/vi');
    const row = rows(page).last();
    await expect(row).toBeAttached();
    expect(await style(row, 'animationName')).toBe('row-reveal');

    await row.scrollIntoViewIfNeeded();
    // Centre the row so its whole entry range has elapsed.
    await row.evaluate((element) =>
      element.scrollIntoView({ block: 'center' })
    );
    await expect.poll(() => style(row, 'opacity')).toBe('1');

    const card = row.locator('[data-slot="carousel-item"]').first();
    expect(await style(card, 'animationName')).toBe('row-reveal-item');
    await expect.poll(() => style(card, 'opacity')).toBe('1');
  });

  test('a row already on screen at load is not dimmed', async ({ page }) => {
    // A tall viewport puts the first Detail row on screen without scrolling.
    await page.setViewportSize({ width: 1280, height: 2400 });
    await page.goto('/vi/movie/550');
    const row = rows(page).first();
    await expect(row).toBeVisible();
    await expect.poll(() => style(row, 'opacity')).toBe('1');
  });

  test('no horizontal scroll while rows animate', async ({ page }) => {
    await page.goto('/vi');
    await rows(page).last().scrollIntoViewIfNeeded();
    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});

test.describe('row reveal with reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('rows are static', async ({ page }) => {
    await page.goto('/vi');
    const row = rows(page).first();
    await expect(row).toBeAttached();
    expect(await style(row, 'animationName')).toBe('none');
    expect(await style(row, 'opacity')).toBe('1');
  });
});
