// @vitest-environment node
import { delay, http, HttpResponse } from 'msw';
import sharp from 'sharp';
import { server } from '../../tests/msw/server';
import { oklchToHex } from './oklch';
import {
  AMBIENT_MAX_CHROMA,
  getPosterAmbient,
  vibrantColor,
} from './poster-color';

const POSTER = 'https://image.tmdb.org/t/p/w185/poster.jpg';

function solidJpeg(r: number, g: number, b: number) {
  return sharp({
    create: { width: 20, height: 30, channels: 3, background: { r, g, b } },
  })
    .jpeg()
    .toBuffer();
}

function servePoster(body: Buffer | string | null, status = 200) {
  const calls: string[] = [];
  server.use(
    http.get(POSTER, ({ request }) => {
      calls.push(request.url);
      return new HttpResponse(body, {
        status,
        headers: { 'Content-Type': 'image/jpeg' },
      });
    })
  );
  return calls;
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => vi.restoreAllMocks());

describe('getPosterAmbient', () => {
  it('returns the dominant hue with a capped chroma and a theme color', async () => {
    servePoster(await solidJpeg(220, 30, 30));

    const ambient = await getPosterAmbient('/poster.jpg');

    expect(ambient).not.toBeNull();
    // A red poster: hue near 25–30°, chroma far above the cap.
    expect(ambient!.hue).toBeGreaterThan(15);
    expect(ambient!.hue).toBeLessThan(40);
    expect(ambient!.chroma).toBe(AMBIENT_MAX_CHROMA);
    expect(ambient!.themeColor).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('keeps a grey poster almost colorless', async () => {
    servePoster(await solidJpeg(120, 120, 120));

    const ambient = await getPosterAmbient('/poster.jpg');

    expect(ambient!.chroma).toBeLessThan(0.01);
  });

  it('takes the hue of the colorful area, not a large black background', async () => {
    // Most posters: a dark (or white) background with a colorful subject.
    // The largest area is black, but the tint should be the subject's hue.
    const poster = await sharp({
      create: { width: 20, height: 30, channels: 3, background: '#080808' },
    })
      .composite([
        {
          input: {
            create: {
              width: 8,
              height: 10,
              channels: 3,
              background: '#1f6fd6',
            },
          },
          left: 6,
          top: 10,
        },
      ])
      .jpeg()
      .toBuffer();
    servePoster(poster);

    const ambient = await getPosterAmbient('/poster.jpg');

    // Blue: OKLCH hue around 255–265°.
    expect(ambient!.hue).toBeGreaterThan(240);
    expect(ambient!.hue).toBeLessThan(275);
    expect(ambient!.chroma).toBeGreaterThan(0.05);
  });

  it('does not fetch when the title has no poster', async () => {
    const calls = servePoster(null);

    expect(await getPosterAmbient(null)).toBeNull();
    expect(calls).toHaveLength(0);
  });

  it.each([
    ['a 404', () => servePoster(null, 404)],
    ['an image that cannot be decoded', () => servePoster('not a jpeg')],
    [
      'a network error',
      () => server.use(http.get(POSTER, () => HttpResponse.error())),
    ],
  ])('returns null (no tint) on %s', async (_label, setup) => {
    setup();

    expect(await getPosterAmbient('/poster.jpg')).toBeNull();
    expect(console.error).toHaveBeenCalled();
  });

  it('gives up after the timeout instead of delaying the page', async () => {
    server.use(
      http.get(POSTER, async () => {
        await delay('infinite');
        return new HttpResponse(null);
      })
    );

    const started = Date.now();
    expect(await getPosterAmbient('/poster.jpg', { timeoutMs: 50 })).toBeNull();
    expect(Date.now() - started).toBeLessThan(1000);
  });
});

describe('vibrantColor', () => {
  const repeat = (rgb: number[], times: number) =>
    Array.from({ length: times }, () => rgb).flat();

  it('ignores near-black and near-white pixels entirely', () => {
    expect(
      vibrantColor([...repeat([0, 0, 0], 50), ...repeat([255, 255, 255], 50)])
    ).toEqual({ c: 0, h: 0 });
  });

  it('gives a weak color when two opposite hues compete', () => {
    // Same lightness and chroma, hues 180° apart: they cancel out.
    const rgbOf = (h: number) => {
      const hex = oklchToHex({ l: 0.65, c: 0.1, h });
      return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    };
    const single = vibrantColor(repeat(rgbOf(30), 10));
    const mixed = vibrantColor([
      ...repeat(rgbOf(30), 10),
      ...repeat(rgbOf(210), 10),
    ]);

    expect(single.c).toBeGreaterThan(0.08);
    expect(mixed.c).toBeLessThan(single.c / 5);
  });
});
