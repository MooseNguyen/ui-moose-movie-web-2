import { expect, test, type Locator, type Page } from '@playwright/test';

// Pointer tilt for media cards (TiltController + globals.css). Structure only:
// no assertions on specific titles.

// Detail page rows: on Home the poster wall's cards sit under its canvas.
const PAGE = '/vi/movie/550';
const firstCard = (page: Page) => page.getByTestId('media-card').first();

const transform = (locator: Locator) =>
  locator.evaluate((element) => getComputedStyle(element).transform);

async function hoverNearCorner(page: Page, card: Locator) {
  await card.scrollIntoViewIfNeeded();
  const box = await card.boundingBox();
  if (!box) throw new Error('card has no box');
  // Two moves so the controller sees a pointer inside the card.
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.move(box.x + box.width * 0.9, box.y + box.height * 0.1);
}

test.describe('card tilt', () => {
  test.skip(({ isMobile }) => isMobile, 'covered by the touch test below');

  test('a card tilts under the pointer and settles when it leaves', async ({
    page,
  }) => {
    await page.goto(PAGE);
    const card = firstCard(page);
    // Retry the hover: moves made before hydration have no listener yet.
    await expect(async () => {
      await hoverNearCorner(page, card);
      await expect(card).toHaveAttribute('data-tilting', '', { timeout: 500 });
    }).toPass();
    await expect.poll(() => transform(card)).not.toBe('none');

    await page.mouse.move(1, 1);
    await expect(card).not.toHaveAttribute('data-tilting');
    await expect.poll(() => transform(card)).toBe('none');
  });

  test('a tilted card still navigates to Detail', async ({ page }) => {
    await page.goto(PAGE);
    const card = firstCard(page);
    await hoverNearCorner(page, card);
    await card.getByRole('link').first().click();
    await expect(page).toHaveURL(/\/vi\/(movie|tv)\/\d+/);
  });
});

test.describe('card tilt is off', () => {
  test('on touch devices', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'touch only');
    await page.goto(PAGE);
    const card = firstCard(page);
    await card.hover();
    await expect(card).not.toHaveAttribute('data-tilting');
  });

  test.describe('with reduced motion', () => {
    test.use({ reducedMotion: 'reduce' });

    test('cards stay flat under the pointer', async ({ page, isMobile }) => {
      test.skip(isMobile, 'no pointer hover on touch');
      await page.goto(PAGE);
      const card = firstCard(page);
      await hoverNearCorner(page, card);
      await expect(card).not.toHaveAttribute('data-tilting');
      expect(await transform(card)).toBe('none');
    });
  });
});
