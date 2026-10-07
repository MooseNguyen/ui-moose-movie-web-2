// @vitest-environment node
import tmdbImageLoader, { TMDB_WIDTHS } from './tmdb-image-loader';

const tmdb = (size: string) => `https://image.tmdb.org/t/p/${size}/abc.jpg`;

describe('tmdbImageLoader', () => {
  it('uses the exact TMDB width when one matches', () => {
    expect(tmdbImageLoader({ src: tmdb('w342'), width: 780 })).toBe(
      tmdb('w780')
    );
    expect(tmdbImageLoader({ src: tmdb('w1280'), width: 92 })).toBe(
      tmdb('w92')
    );
  });

  it('rounds up to the smallest TMDB width that covers the request', () => {
    expect(tmdbImageLoader({ src: tmdb('w342'), width: 343 })).toBe(
      tmdb('w500')
    );
    expect(tmdbImageLoader({ src: tmdb('w342'), width: 1 })).toBe(tmdb('w92'));
    expect(tmdbImageLoader({ src: tmdb('original'), width: 1000 })).toBe(
      tmdb('w1280')
    );
  });

  it('falls back to original above the largest TMDB width', () => {
    expect(
      tmdbImageLoader({ src: tmdb('w1280'), width: TMDB_WIDTHS.at(-1)! + 1 })
    ).toBe(tmdb('original'));
    expect(tmdbImageLoader({ src: tmdb('w342'), width: 3840 })).toBe(
      tmdb('original')
    );
  });

  it('ignores quality, which TMDB does not support', () => {
    expect(
      tmdbImageLoader({ src: tmdb('w342'), width: 500, quality: 40 })
    ).toBe(tmdb('w500'));
  });

  it('returns local paths unchanged', () => {
    expect(
      tmdbImageLoader({ src: '/placeholder-poster.svg', width: 500 })
    ).toBe('/placeholder-poster.svg');
    expect(tmdbImageLoader({ src: '/logo.png', width: 92 })).toBe('/logo.png');
  });

  it('returns other hosts unchanged', () => {
    const src = 'https://i.ytimg.com/vi/abc/hqdefault.jpg';
    expect(tmdbImageLoader({ src, width: 780 })).toBe(src);
  });

  it('returns a TMDB URL without a size segment unchanged', () => {
    const src = 'https://image.tmdb.org/t/p/';
    expect(tmdbImageLoader({ src, width: 780 })).toBe(src);
  });
});
