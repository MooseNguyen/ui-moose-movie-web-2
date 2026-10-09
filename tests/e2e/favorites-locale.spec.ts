import { expect, test } from '@playwright/test';

test('a favorite survives reload and a locale switch, and undo restores it', async ({
  page,
}) => {
  await page.goto('/vi/movie');
  const favorite = page
    .getByTestId('media-card')
    .first()
    .getByRole('button', { name: /^Yêu thích: / });
  // Disabled until the store has read localStorage.
  await expect(favorite).toBeEnabled();
  await favorite.click();
  await expect(favorite).toHaveAttribute('aria-pressed', 'true');

  await page.goto('/vi/favorites');
  const cards = page.getByTestId('media-card');
  await expect(cards).toHaveCount(1);

  await page.reload();
  await expect(cards).toHaveCount(1);

  await page.getByRole('button', { name: 'Ngôn ngữ' }).click();
  await page.getByRole('menuitemradio', { name: 'English' }).click();
  await expect(page).toHaveURL(/\/en\/favorites$/);
  // Wait for the en render, so the count below cannot match the stale vi DOM.
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(cards).toHaveCount(1);

  await page
    .getByRole('button', { name: /^Remove .+ from favorites$/ })
    .click();
  await expect(cards).toHaveCount(0);
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(cards).toHaveCount(1);
});
