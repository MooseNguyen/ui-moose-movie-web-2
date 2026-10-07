// @vitest-environment node
import { tmdbImage } from './images';

describe('tmdbImage', () => {
  it('builds a TMDB image URL for the given size', () => {
    expect(tmdbImage('/a.jpg', 'w342')).toBe(
      'https://image.tmdb.org/t/p/w342/a.jpg'
    );
    expect(tmdbImage('/b.jpg', 'original', 'backdrop')).toBe(
      'https://image.tmdb.org/t/p/original/b.jpg'
    );
  });

  it('falls back to the placeholder for the requested kind, poster by default', () => {
    expect(tmdbImage(null, 'w185', 'profile')).toBe('/placeholder-profile.svg');
    expect(tmdbImage(null, 'w1280', 'backdrop')).toBe(
      '/placeholder-backdrop.svg'
    );
    expect(tmdbImage(null, 'w342')).toBe('/placeholder-poster.svg');
  });
});
