import { expect, test } from '@playwright/test';

// Real 404 status codes, not a "not found" page served with 200 (soft 404).
for (const path of [
  '/vi/does-not-exist',
  '/vi/movie/abc',
  '/vi/movie/999999999',
]) {
  test(`${path} responds 404`, async ({ page }) => {
    const response = await page.goto(path);
    expect(response?.status()).toBe(404);
  });
}

const VIEWPORTS = [
  { width: 360, height: 740 },
  { width: 1280, height: 800 },
];

for (const path of ['/vi', '/vi/movie', '/vi/movie/550']) {
  for (const viewport of VIEWPORTS) {
    test(`${path} has no horizontal scroll at ${viewport.width}px`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).toBeAttached();
      const { scrollWidth, clientWidth } = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
    });
  }
}
