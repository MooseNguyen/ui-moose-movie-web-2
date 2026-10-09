import { expect, test, type Page } from '@playwright/test';

async function searchFromHeader(page: Page, term: string) {
  await page
    .getByRole('banner')
    .getByRole('button', { name: 'Tìm kiếm' })
    .click();
  const dialog = page.getByRole('dialog', {
    name: 'Tìm phim lẻ, phim bộ và người',
  });
  const input = dialog.getByRole('searchbox', { name: 'Từ khóa tìm kiếm' });
  await expect(input).toBeFocused();
  await input.fill(term);
  await input.press('Enter');
  await expect(dialog).toBeHidden();
}

test('header search shows results and load more appends cards', async ({
  page,
}) => {
  await page.goto('/vi');
  await searchFromHeader(page, 'batman');

  await expect(page).toHaveURL(/\/vi\/search\?q=batman(&|$)/);
  const cards = page.getByTestId('media-card');
  await expect(cards.first()).toBeVisible();
  const before = await cards.count();
  expect(before).toBeGreaterThan(0);

  await page.getByRole('button', { name: 'Tải thêm' }).click();
  await expect.poll(() => cards.count()).toBeGreaterThan(before);
});

// Diacritics and a literal percent sign must survive URL encoding unchanged.
for (const term of ['người nhện', '50%']) {
  test(`search query "${term}" round-trips exactly`, async ({ page }) => {
    await page.goto('/vi');
    await searchFromHeader(page, term);

    await expect(page).toHaveURL(/\/vi\/search\?/);
    expect(new URL(page.url()).searchParams.get('q')).toBe(term);
    await expect(
      page
        .getByRole('main')
        .getByRole('searchbox', { name: 'Từ khóa tìm kiếm' })
    ).toHaveValue(term);
  });
}
