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

// Vertical offset of the reveal slide, in px. The settled state computes to
// an identity matrix rather than `none`, so compare the offset, not the string.
async function offsetY(locator: Locator) {
  return locator.evaluate(
    (element) => new DOMMatrixReadOnly(getComputedStyle(element).transform).m42
  );
}

test.describe('row reveal', () => {
  test('rows slide in and settle once scrolled into view', async ({ page }) => {
    await page.goto('/vi');
    const row = rows(page).last();
    await expect(row).toBeAttached();
    expect(await style(row, 'animationName')).toBe('row-reveal');

    await row.scrollIntoViewIfNeeded();
    // Centre the row so its whole entry range has elapsed.
    await row.evaluate((element) =>
      element.scrollIntoView({ block: 'center' })
    );
    await expect.poll(() => offsetY(row)).toBe(0);

    const card = row.locator('[data-slot="carousel-item"]').first();
    expect(await style(card, 'animationName')).toBe('row-reveal-item');
    await expect.poll(() => offsetY(card)).toBe(0);
  });

  // Regression for #90: tools that never scroll (axe in Lighthouse) measure
  // rows in their start state, so that state must keep full contrast.
  test('a row not yet scrolled into view is offset but not faded', async ({
    page,
  }) => {
    await page.goto('/vi');
    const row = rows(page).last();
    await expect(row).toBeAttached();
    const card = row.locator('[data-slot="carousel-item"]').first();

    expect(await offsetY(row)).toBeGreaterThan(0);
    expect(await offsetY(card)).toBeGreaterThan(0);
    expect(await style(row, 'opacity')).toBe('1');
    expect(await style(card, 'opacity')).toBe('1');
  });

  test('a row already on screen at load is in its end state', async ({
    page,
  }) => {
    // A tall viewport puts the first Detail row on screen without scrolling.
    await page.setViewportSize({ width: 1280, height: 2400 });
    await page.goto('/vi/movie/550');
    const row = rows(page).first();
    await expect(row).toBeVisible();
    await expect.poll(() => offsetY(row)).toBe(0);
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
