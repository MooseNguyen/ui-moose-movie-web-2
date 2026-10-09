import { expect, test } from '@playwright/test';

test('a genre chip filters the URL and survives a reload', async ({ page }) => {
  await page.goto('/vi/discover');
  const genres = page.getByRole('group', { name: 'Thể loại' });
  const chip = genres.getByRole('button').first();
  const name = (await chip.textContent())?.trim() ?? '';
  expect(name).not.toBe('');

  await chip.click();
  await expect(page).toHaveURL(/[?&]genres=\d+/);
  await expect(chip).toHaveAttribute('aria-pressed', 'true');
  await expect(chip).toBeFocused();

  await page.reload();
  await expect(page).toHaveURL(/[?&]genres=\d+/);
  await expect(
    genres.getByRole('button', { name, exact: true })
  ).toHaveAttribute('aria-pressed', 'true');
});

test('the year select works with the real keyboard', async ({ page }) => {
  await page.goto('/vi/discover');
  const year = page.getByRole('combobox', { name: 'Năm' });
  await year.focus();
  await page.keyboard.press('Enter');
  // Keys pressed before Radix has moved focus into the open list hit the
  // trigger instead (a speed no person reaches), so wait for each focus move.
  const options = page.getByRole('listbox').getByRole('option');
  await expect(options.first()).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(options.nth(1)).toBeFocused();
  await page.keyboard.press('Enter');

  await expect(page).toHaveURL(/[?&]year=\d{4}/);
  await expect(page.getByRole('listbox')).toBeHidden();
});

test('a client-side filter change on TV keeps the TV document title', async ({
  page,
}) => {
  await page.goto('/vi/discover?type=tv');
  await expect(page).toHaveTitle(/Khám phá phim bộ/);

  await page
    .getByRole('group', { name: 'Thể loại' })
    .getByRole('button')
    .first()
    .click();
  await expect(page).toHaveURL(/[?&]genres=\d+/);
  // The title was already right before the click, so first wait until the
  // new route's metadata is applied (its canonical carries the filter).
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    /[?&]genres=\d+/
  );
  await expect(page).toHaveTitle(/Khám phá phim bộ/);
});
