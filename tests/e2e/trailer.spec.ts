import { expect, test } from '@playwright/test';

// Fight Club: a stable TMDB title with a trailer and videos.
const DETAIL = '/vi/movie/550';

test.beforeEach(async ({ page }) => {
  // The tests only check that the iframe is mounted; never load YouTube.
  await page.route(/youtube-nocookie\.com/, (route) => route.abort());
});

test('trailer dialog shows an iframe and Escape restores focus', async ({
  page,
}) => {
  await page.goto(DETAIL);
  const trigger = page.getByRole('button', { name: /^Trailer: / }).first();
  await trigger.click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('iframe')).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(page.locator('iframe')).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test('detail videos mount an iframe only after a click', async ({ page }) => {
  await page.goto(DETAIL);
  const play = page.getByRole('button', { name: /^Phát: / }).first();
  await expect(play).toBeVisible();
  await expect(page.locator('iframe')).toHaveCount(0);

  await play.click();
  await expect(page.locator('iframe')).toHaveCount(1);
  await expect(page.locator('iframe')).toBeFocused();
});
