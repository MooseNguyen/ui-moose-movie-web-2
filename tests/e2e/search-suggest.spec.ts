import { expect, test, type Page } from '@playwright/test';

// Search dialog with live suggestions (SearchCombobox). Structure only: TMDB
// results change, so no assertions on specific titles.

const dialog = (page: Page) => page.getByRole('dialog');
const combobox = (page: Page) => page.getByRole('combobox');
// Compares path and query exactly (hrefs contain `?`, unsafe in a RegExp).
const isAt = (href: string | null) => (url: URL) =>
  url.pathname + url.search === href;

const trigger = (page: Page) =>
  page.getByRole('banner').getByRole('button', { name: 'Tìm kiếm' });

async function openWithShortcut(page: Page) {
  await page.goto('/vi');
  // Keys pressed before hydration have no listener yet: retry.
  await expect(async () => {
    await page.keyboard.press('ControlOrMeta+k');
    await expect(dialog(page)).toBeVisible({ timeout: 1000 });
  }).toPass();
  await expect(combobox(page)).toBeFocused();
}

test.describe('search suggestions (keyboard)', () => {
  test.skip(({ isMobile }) => isMobile, 'no keyboard shortcut on touch');

  test('Ctrl/⌘+K, type, arrow down, Enter opens the first suggestion', async ({
    page,
  }) => {
    await openWithShortcut(page);

    await combobox(page).fill('batman');
    const options = page.getByRole('listbox').getByRole('option');
    await expect(options.nth(1)).toBeVisible();
    await expect(combobox(page)).toHaveAttribute('aria-expanded', 'true');

    await page.keyboard.press('ArrowDown');
    const first = options.first();
    await expect(first).toHaveAttribute('aria-selected', 'true');
    await expect(combobox(page)).toHaveAttribute(
      'aria-activedescendant',
      (await first.getAttribute('id'))!
    );
    const href = await first.getAttribute('href');

    await page.keyboard.press('Enter');

    await expect(page).toHaveURL(isAt(href));
    await expect(dialog(page)).toBeHidden();
  });

  test('Enter with nothing selected goes to the results page', async ({
    page,
  }) => {
    await openWithShortcut(page);

    await combobox(page).fill('người nhện');
    await page.keyboard.press('Enter');

    await expect(page).toHaveURL(/\/vi\/search\?q=ng%C6%B0%E1%BB%9Di/);
    await expect(dialog(page)).toBeHidden();
  });

  test('the shortcut closes the dialog again and focus returns', async ({
    page,
  }) => {
    await page.goto('/vi');
    await expect(async () => {
      await trigger(page).click();
      await expect(dialog(page)).toBeVisible({ timeout: 1000 });
    }).toPass();

    await page.keyboard.press('ControlOrMeta+k');

    await expect(dialog(page)).toBeHidden();
    await expect(trigger(page)).toBeFocused();
  });
});

test('touch: tapping a suggestion opens it', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'touch only');
  await page.goto('/vi');
  await expect(async () => {
    await trigger(page).tap();
    await expect(dialog(page)).toBeVisible({ timeout: 1000 });
  }).toPass();

  await combobox(page).fill('batman');
  const options = page.getByRole('listbox').getByRole('option');
  // More than the "see all" option: the suggestions have arrived.
  await expect(options.nth(1)).toBeVisible();
  const first = options.first();
  const href = await first.getAttribute('href');
  await first.tap();

  await expect(page).toHaveURL(isAt(href));
});

test.describe('suggest endpoint', () => {
  test('answers a query with cacheable JSON', async ({ request }) => {
    const response = await request.get(
      '/api/search/suggest?q=batman&locale=vi'
    );

    expect(response.status()).toBe(200);
    expect(response.headers()['cache-control']).toContain('s-maxage=300');
    const { items } = await response.json();
    expect(items.length).toBeGreaterThan(0);
    expect(items.length).toBeLessThanOrEqual(8);
  });

  test('rejects a one-letter query', async ({ request }) => {
    const response = await request.get('/api/search/suggest?q=b&locale=vi');

    expect(response.status()).toBe(400);
  });
});
