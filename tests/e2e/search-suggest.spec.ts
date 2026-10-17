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

  for (const theme of ['dark', 'light'] as const) {
    test(`the highlighted option is clearly visible (${theme} theme)`, async ({
      page,
    }) => {
      await page.addInitScript((value) => {
        localStorage.setItem('theme', value);
      }, theme);
      await openWithShortcut(page);
      await combobox(page).fill('batman');
      await expect(
        page.getByRole('listbox').getByRole('option').nth(1)
      ).toBeVisible();
      await page.keyboard.press('ArrowDown');

      // WCAG 1.4.11: the indicator of a component state needs 3:1 against
      // what surrounds it. Colors are converted to sRGB through a canvas,
      // since computed styles may be lab()/oklch().
      const ratio = await page.evaluate(() => {
        const ctx = document.createElement('canvas').getContext('2d')!;
        const rgb = (color: string) => {
          ctx.clearRect(0, 0, 1, 1);
          ctx.fillStyle = color;
          ctx.fillRect(0, 0, 1, 1);
          return [...ctx.getImageData(0, 0, 1, 1).data.slice(0, 3)];
        };
        const luminance = (color: string) => {
          const [r, g, b] = rgb(color).map((v) => {
            const c = v / 255;
            return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
          });
          return 0.2126 * r + 0.7152 * g + 0.0722 * b;
        };
        const selected = document.querySelector<HTMLElement>(
          '[role="option"][aria-selected="true"]'
        )!;
        // Tailwind stacks several shadows (unused ones are transparent):
        // take the visible inset one, "<color> 3px 0px 0px 0px inset"; the
        // color itself may contain spaces and digits, e.g. "lab(98 0 0)".
        const bar = getComputedStyle(selected)
          .boxShadow.split(/,(?![^(]*\))/)
          .map((layer) => layer.trim())
          .find(
            (layer) =>
              layer.endsWith('inset') && !layer.startsWith('rgba(0, 0, 0, 0)')
          );
        // Without a bar, the background is the only indicator.
        const indicator =
          bar?.match(/^(.*?)\s+-?[\d.]+px/)?.[1] ??
          getComputedStyle(selected).backgroundColor;
        const surface = getComputedStyle(
          document.querySelector('[role="dialog"]')!
        ).backgroundColor;
        const [hi, lo] = [luminance(indicator), luminance(surface)].sort(
          (a, b) => b - a
        );
        return (hi + 0.05) / (lo + 0.05);
      });

      expect(ratio).toBeGreaterThanOrEqual(3);
    });
  }
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
