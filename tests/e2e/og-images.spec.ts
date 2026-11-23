import { expect, test, type APIRequestContext } from '@playwright/test';
import sharp from 'sharp';

// Share images (src/lib/og.tsx). HTTP only: the mobile project would repeat
// the same requests.
test.skip(({ isMobile }) => isMobile, 'same requests as desktop');

function metaContent(html: string, key: string): string | null {
  const match = html.match(
    new RegExp(`<meta (?:property|name)="${key}" content="([^"]*)"`)
  );
  return match ? match[1].replaceAll('&amp;', '&') : null;
}

// Some apps (e.g. WhatsApp) drop previews larger than ~300 KB.
const MAX_CARD_BYTES = 300 * 1024;

async function expectCard(
  request: APIRequestContext,
  url: string,
  { cacheSeconds = 86400 } = {}
) {
  // Absolute (metadataBase = SITE_URL, which may differ from the test
  // server): request the same path on the server under test.
  const { pathname, search } = new URL(url);
  const response = await request.get(pathname + search);

  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toBe('image/jpeg');
  // Rendered on demand: the CDN caches it, a degraded card only briefly.
  expect(response.headers()['cache-control']).toContain(
    `s-maxage=${cacheSeconds}`
  );
  const body = await response.body();
  expect(body.length).toBeLessThan(MAX_CARD_BYTES);
  const { format, width, height } = await sharp(body).metadata();
  expect({ format, width, height }).toEqual({
    format: 'jpeg',
    width: 1200,
    height: 630,
  });
}

for (const [path, imagePath] of [
  ['/vi', '/vi/opengraph-image'],
  // Nested pages name the site card explicitly (buildMetadata).
  ['/vi/movie', '/vi/opengraph-image'],
  ['/en/discover', '/en/opengraph-image'],
  ['/vi/movie/550', '/vi/movie/550/opengraph-image'],
  ['/en/tv/1399', '/en/tv/1399/opengraph-image'],
] as const) {
  test(`${path} shares a 1200×630 card`, async ({ request }) => {
    const html = await (await request.get(path)).text();
    const ogImage = metaContent(html, 'og:image');
    const twitterImage = metaContent(html, 'twitter:image');

    expect(ogImage).toMatch(/^https?:\/\//);
    expect(new URL(ogImage!).pathname).toBe(imagePath);
    expect(twitterImage).toMatch(/^https?:\/\//);
    expect(metaContent(html, 'twitter:card')).toBe('summary_large_image');
    await expectCard(request, ogImage!);
    await expectCard(request, twitterImage!);
  });
}

test('an unknown title still gets the site card, not an error', async ({
  request,
}) => {
  await expectCard(
    request,
    'http://localhost/vi/movie/999999999/opengraph-image',
    { cacheSeconds: 300 }
  );
});
