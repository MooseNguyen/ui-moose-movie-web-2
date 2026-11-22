import { expect, test, type Locator, type Page } from '@playwright/test';
import { TMDB_WIDTHS } from '../../src/lib/tmdb-image-loader';

// Card posters must download the smallest TMDB width that still covers the
// rendered width on the device (`sizes` in carousel-layout.ts / MediaGrid.tsx):
// a larger file wastes bandwidth, a smaller one looks blurry.

const VIEWPORTS = [
  { width: 412, height: 823, deviceScaleFactor: 1.75 },
  { width: 768, height: 1024, deviceScaleFactor: 2 },
  { width: 1280, height: 800, deviceScaleFactor: 1 },
  { width: 1440, height: 900, deviceScaleFactor: 2 },
];

const LAYOUTS = [
  {
    name: 'carousel card on Home',
    path: '/vi',
    // A row, not the trending wall: on desktop the wall's carousel sits
    // behind its 3D canvas.
    poster: (page: Page) =>
      page
        .getByRole('region', { name: 'Phim lẻ phổ biến' })
        .getByTestId('media-card')
        .first()
        .locator('img'),
  },
  {
    name: 'grid card on the movie list',
    path: '/vi/movie',
    poster: (page: Page) =>
      page.locator('ul').getByTestId('media-card').first().locator('img'),
  },
];

async function loadedPoster(poster: Locator) {
  await poster.scrollIntoViewIfNeeded();
  await expect
    .poll(() =>
      poster.evaluate(
        (img: HTMLImageElement) => img.complete && img.naturalWidth > 0
      )
    )
    .toBe(true);
  return poster.evaluate((img: HTMLImageElement) => ({
    cssWidth: img.getBoundingClientRect().width,
    currentSrc: img.currentSrc,
  }));
}

for (const viewport of VIEWPORTS) {
  test.describe(`${viewport.width}px @${viewport.deviceScaleFactor}x`, () => {
    test.use({
      viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: viewport.deviceScaleFactor,
    });

    for (const layout of LAYOUTS) {
      test(`${layout.name} loads the smallest sufficient TMDB width`, async ({
        page,
      }, testInfo) => {
        test.skip(
          testInfo.project.name !== 'chromium',
          'Viewports are set explicitly; one project is enough.'
        );
        await page.goto(layout.path);
        const { cssWidth, currentSrc } = await loadedPoster(
          layout.poster(page)
        );

        const needed = cssWidth * viewport.deviceScaleFactor;
        const expected = TMDB_WIDTHS.find((width) => width >= needed);
        const loaded = currentSrc.match(/\/t\/p\/w(\d+)\//)?.[1];
        expect(
          Number(loaded),
          `${cssWidth}px x ${viewport.deviceScaleFactor} = ${needed}px`
        ).toBe(expected);
      });
    }
  });
}
