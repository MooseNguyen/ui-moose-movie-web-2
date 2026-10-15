import { expect, test } from '@playwright/test';

test('home hero leads to a detail page with title and cast', async ({
  page,
}) => {
  await page.goto('/vi');
  await expect(
    page.getByRole('region', { name: 'Thịnh hành tuần này' })
  ).toBeVisible();

  // A row card, not the trending wall: on desktop the wall's grid is hidden
  // behind its 3D canvas (covered by poster-wall.spec.ts).
  await page
    .getByRole('region', { name: 'Phim lẻ phổ biến' })
    .getByTestId('media-card')
    .first()
    .getByRole('link')
    .click();

  await expect(page).toHaveURL(/\/vi\/(movie|tv)\/\d+$/);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(
    page.getByRole('heading', { level: 2, name: 'Diễn viên' })
  ).toBeVisible();
});
