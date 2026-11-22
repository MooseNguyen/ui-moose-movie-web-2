import { expect, test } from '@playwright/test';

// Messages are precompiled at build time (next-intl `precompile`), and unit
// tests do not run that build step. These checks render ICU number and plural
// arguments from the production build. Favorites are seeded in localStorage,
// so nothing depends on TMDB data.

const favorite = (id: number, mediaType: 'movie' | 'tv', title: string) => ({
  id,
  mediaType,
  title,
  posterPath: null,
  voteAverage: 0,
  year: null,
  addedAt: id,
});

const FAVORITES = [
  favorite(1, 'movie', 'Seeded movie one'),
  favorite(2, 'movie', 'Seeded movie two'),
  favorite(3, 'tv', 'Seeded series'),
];

test.beforeEach(async ({ page }) => {
  await page.addInitScript((items) => {
    localStorage.setItem(
      'moose-favorites',
      JSON.stringify({ state: { items }, version: 1 })
    );
  }, FAVORITES);
});

test('favorites tabs and the clear dialog format number and plural arguments', async ({
  page,
}) => {
  await page.goto('/en/favorites');

  // `{count, number}`
  await expect(page.getByRole('tab')).toHaveText([
    'All (3)',
    'Movies (2)',
    'TV Series (1)',
  ]);

  // `{count, plural, one {# title} other {# titles}}`
  await page.getByRole('button', { name: 'Clear all' }).click();
  await expect(page.getByRole('alertdialog')).toContainText(
    'This removes 3 titles from your favorites.'
  );
});
