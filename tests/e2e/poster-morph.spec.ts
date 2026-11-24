import { expect, test, type Page } from '@playwright/test';

// Card → Detail poster morph (poster-transition.ts). Records every view
// transition the page starts, with the names of the animated groups.

type Recorded = {
  groups: string[];
  /** View-transition animations as `pseudo-element animation-name`. */
  named: string[];
  skipped: string | null;
};

async function recordViewTransitions(page: Page) {
  await page.addInitScript(() => {
    const log: Recorded[] = [];
    Object.assign(window, { __viewTransitions: log });
    const start = Document.prototype.startViewTransition;
    Document.prototype.startViewTransition = function (
      ...args: Parameters<typeof start>
    ) {
      const transition = start.apply(this, args);
      const entry: Recorded = { groups: [], named: [], skipped: null };
      log.push(entry);
      transition.ready.then(
        () => {
          const animations = document.getAnimations();
          const pseudo = (animation: Animation) =>
            (animation.effect as KeyframeEffect).pseudoElement ?? '';
          entry.groups = animations
            .map(pseudo)
            .filter((name) => name.startsWith('::view-transition-group('));
          entry.named = animations
            .filter((animation) =>
              pseudo(animation).startsWith('::view-transition')
            )
            .map(
              (animation) =>
                `${pseudo(animation)} ${(animation as CSSAnimation).animationName}`
            );
        },
        (error: unknown) => {
          entry.skipped = String(error);
        }
      );
      return transition;
    };
  });
}

const recorded = (page: Page) =>
  page.evaluate(
    () =>
      (window as unknown as { __viewTransitions: Recorded[] }).__viewTransitions
  );

// Detail page rows: one page load, no Home hero swapping in meanwhile.
async function clickRelatedCard(page: Page) {
  await page.goto('/vi/movie/550');
  const link = page.getByTestId('media-card').first().getByRole('link');
  await link.scrollIntoViewIfNeeded();
  const href = await link.getAttribute('href');
  const [, type, id] = href!.match(/\/(movie|tv)\/(\d+)$/)!;
  // Clicks before hydration are plain page loads: retry until the client
  // navigation (and its transition) happens.
  await expect(async () => {
    await link.click();
    await expect(page).toHaveURL(new RegExp(`/${type}/${id}$`), {
      timeout: 2000,
    });
  }).toPass();
  return `poster-${type}-${id}`;
}

test.describe('poster morph', () => {
  test.beforeEach(({ page }) => recordViewTransitions(page));

  test('the clicked card poster morphs into the Detail poster', async ({
    page,
  }) => {
    const name = await clickRelatedCard(page);

    await expect
      .poll(async () => (await recorded(page)).at(-1))
      .toMatchObject({
        skipped: null,
        groups: expect.arrayContaining([`::view-transition-group(${name})`]),
        // The poster flies with depth (lift and swing), not just a 2D morph.
        named: expect.arrayContaining([
          `::view-transition-old(${name}) poster-depth`,
          `::view-transition-new(${name}) poster-depth`,
        ]),
      });
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('a Discover filter change starts no transition', async ({ page }) => {
    await page.goto('/vi/discover?type=tv');
    const genre = page
      .getByRole('group', { name: 'Thể loại' })
      .getByRole('button')
      .first();
    await expect(async () => {
      await genre.click();
      await expect(page).toHaveURL(/[?&]genres=\d+/, { timeout: 2000 });
    }).toPass();

    expect(await recorded(page)).toEqual([]);
  });
});

test.describe('poster morph with reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });
  test.beforeEach(({ page }) => recordViewTransitions(page));

  test('navigates without animating', async ({ page }) => {
    await clickRelatedCard(page);

    await expect.poll(async () => (await recorded(page)).length).toBe(1);
    expect((await recorded(page))[0].groups).toEqual([]);
    expect((await recorded(page))[0].named).toEqual([]);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });
});
