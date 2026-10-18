import { expect, test } from '@playwright/test';

// Detail ambient tint (poster-color.ts). TMDB posters change, so the test
// checks structure and contrast, never a specific hue.

for (const theme of ['dark', 'light'] as const) {
  test(`the poster tint keeps text readable (${theme} theme)`, async ({
    page,
  }) => {
    await page.addInitScript((value) => {
      localStorage.setItem('theme', value);
    }, theme);
    await page.goto('/vi/movie/550');

    const tint = page.locator('.ambient-tint');
    await expect(tint).toHaveCount(1);
    expect(
      await tint.evaluate((el) => el.style.getPropertyValue('--ambient-h'))
    ).toMatch(/^\d+(\.\d+)?$/);

    // Worst case: the tint as a solid color with no overlay, against the
    // page text color. WCAG 1.4.3 asks 4.5:1 for body text.
    const ratio = await page.evaluate(() => {
      const ctx = document.createElement('canvas').getContext('2d')!;
      const luminance = (color: string) => {
        ctx.clearRect(0, 0, 1, 1);
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, 1, 1);
        const [r, g, b] = [
          ...ctx.getImageData(0, 0, 1, 1).data.slice(0, 3),
        ].map((v) => {
          const c = v / 255;
          return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
        });
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
      };
      const tint = getComputedStyle(
        document.querySelector('.ambient-tint')!
      ).backgroundColor;
      const text = getComputedStyle(document.querySelector('h1')!).color;
      const [hi, lo] = [luminance(tint), luminance(text)].sort((a, b) => b - a);
      return (hi + 0.05) / (lo + 0.05);
    });
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });
}

test('the browser UI color follows the poster', async ({ page }) => {
  await page.goto('/vi/movie/550');

  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute(
    'content',
    /^#[0-9a-f]{6}$/
  );
});
