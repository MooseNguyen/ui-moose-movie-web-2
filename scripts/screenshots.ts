import { expect, test, type Page } from '@playwright/test';

const OUT_DIR = 'docs/screenshots';

/** Waits until every image inside the viewport has finished loading. */
async function settle(page: Page) {
  await page.waitForLoadState('networkidle');
  await page.waitForFunction(() =>
    Array.from(document.images)
      .filter((img) => {
        const rect = img.getBoundingClientRect();
        // Carousel slides beyond the right edge stay lazy and never load.
        return (
          rect.bottom > 0 &&
          rect.top < window.innerHeight &&
          rect.right > 0 &&
          rect.left < window.innerWidth
        );
      })
      .every((img) => img.complete)
  );
}

async function capture(page: Page, name: string) {
  await settle(page);
  await page.screenshot({
    path: `${OUT_DIR}/${name}-${test.info().project.name}.jpg`,
    type: 'jpeg',
    quality: 70,
  });
}

test('home', async ({ page }) => {
  await page.goto('/vi');
  await capture(page, 'home');
});

test('detail', async ({ page }) => {
  await page.goto('/vi/movie/550');
  await capture(page, 'detail');
});

test('discover', async ({ page }) => {
  await page.goto('/vi/discover');
  await capture(page, 'discover');
});

test('favorites', async ({ page }) => {
  await page.goto('/vi/movie');
  const buttons = page
    .getByTestId('media-card')
    .getByRole('button', { name: /^Yêu thích: / });
  // Disabled until the store has read localStorage.
  await expect(buttons.first()).toBeEnabled();
  for (let i = 0; i < 4; i++) {
    await buttons.nth(i).click();
    await expect(buttons.nth(i)).toHaveAttribute('aria-pressed', 'true');
  }
  await page.goto('/vi/favorites');
  await expect(page.getByTestId('media-card')).toHaveCount(4);
  await capture(page, 'favorites');
});
