import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  DEFAULT_DISCOVER,
  DISCOVER_SORTS,
  parseDiscoverParams,
  serializeDiscoverParams,
  toTmdbDiscoverQuery,
  type DiscoverParams,
} from './params';

describe('discover params', () => {
  describe('DISCOVER_SORTS', () => {
    it('exports correct sort options', () => {
      expect(DISCOVER_SORTS).toEqual([
        'popularity.desc',
        'vote_average.desc',
        'release_date.desc',
        'title.asc',
      ]);
    });
  });

  describe('DEFAULT_DISCOVER', () => {
    it('has correct defaults', () => {
      expect(DEFAULT_DISCOVER).toEqual({
        type: 'movie',
        genres: [],
        year: null,
        sort: 'popularity.desc',
      });
    });
  });

  describe('parseDiscoverParams', () => {
    it('falls back per field on invalid input', () => {
      expect(
        parseDiscoverParams(
          { type: 'anime', year: '1800', sort: 'x', genres: '28,abc,-1,28' },
          new Date('2026-10-04')
        )
      ).toEqual({
        type: 'movie',
        genres: [28],
        year: null,
        sort: 'popularity.desc',
      });
    });

    it('parses valid params', () => {
      expect(
        parseDiscoverParams(
          {
            type: 'tv',
            genres: '16,35',
            year: '2024',
            sort: 'vote_average.desc',
          },
          new Date('2026-10-04')
        )
      ).toEqual({
        type: 'tv',
        genres: [16, 35],
        year: 2024,
        sort: 'vote_average.desc',
      });
    });

    it('handles array query params and uses first value', () => {
      expect(
        parseDiscoverParams(
          {
            type: ['tv', 'movie'],
            sort: ['vote_average.desc', 'popularity.desc'],
          },
          new Date('2026-10-04')
        )
      ).toEqual({
        type: 'tv',
        genres: [],
        year: null,
        sort: 'vote_average.desc',
      });
    });

    it('deduplicates and sorts genres', () => {
      expect(
        parseDiscoverParams(
          { genres: '28,35,28,16,35' },
          new Date('2026-10-04')
        )
      ).toEqual({
        type: 'movie',
        genres: [16, 28, 35],
        year: null,
        sort: 'popularity.desc',
      });
    });

    it('handles empty genres string', () => {
      expect(
        parseDiscoverParams({ genres: '' }, new Date('2026-10-04'))
      ).toEqual({
        type: 'movie',
        genres: [],
        year: null,
        sort: 'popularity.desc',
      });
    });

    it('validates year within 1950 to current year', () => {
      const now = new Date('2026-10-04');
      expect(parseDiscoverParams({ year: '1950' }, now)).toEqual({
        type: 'movie',
        genres: [],
        year: 1950,
        sort: 'popularity.desc',
      });

      expect(parseDiscoverParams({ year: '2026' }, now)).toEqual({
        type: 'movie',
        genres: [],
        year: 2026,
        sort: 'popularity.desc',
      });

      // Current year is valid
      expect(parseDiscoverParams({ year: '2026' }, now)).toEqual({
        type: 'movie',
        genres: [],
        year: 2026,
        sort: 'popularity.desc',
      });

      // Next year is invalid
      expect(parseDiscoverParams({ year: '2027' }, now)).toEqual({
        type: 'movie',
        genres: [],
        year: null,
        sort: 'popularity.desc',
      });
    });

    it('rejects non-integer year', () => {
      expect(
        parseDiscoverParams({ year: '2024.5' }, new Date('2026-10-04'))
      ).toEqual({
        type: 'movie',
        genres: [],
        year: null,
        sort: 'popularity.desc',
      });
    });

    it('rejects negative genre IDs', () => {
      expect(
        parseDiscoverParams({ genres: '-1,28,35' }, new Date('2026-10-04'))
      ).toEqual({
        type: 'movie',
        genres: [28, 35],
        year: null,
        sort: 'popularity.desc',
      });
    });

    it('uses injected now parameter', () => {
      const now = new Date('2020-01-01');
      expect(parseDiscoverParams({ year: '2020' }, now)).toEqual({
        type: 'movie',
        genres: [],
        year: 2020,
        sort: 'popularity.desc',
      });

      expect(parseDiscoverParams({ year: '2021' }, now)).toEqual({
        type: 'movie',
        genres: [],
        year: null,
        sort: 'popularity.desc',
      });
    });
  });

  describe('serializeDiscoverParams', () => {
    it('serializes defaults to empty string', () => {
      expect(serializeDiscoverParams(DEFAULT_DISCOVER)).toBe('');
    });

    it('serializes non-default params', () => {
      const params: DiscoverParams = {
        type: 'tv',
        genres: [16, 35],
        year: 2024,
        sort: 'vote_average.desc',
      };
      const serialized = serializeDiscoverParams(params);
      expect(serialized).toBe(
        'type=tv&genres=16%2C35&year=2024&sort=vote_average.desc'
      );
    });

    it('joins genres with commas', () => {
      const params: DiscoverParams = {
        type: 'movie',
        genres: [28, 35],
        year: null,
        sort: 'popularity.desc',
      };
      const serialized = serializeDiscoverParams(params);
      expect(serialized).toContain('genres=28%2C35');
    });

    it('omits default fields', () => {
      const params: DiscoverParams = {
        type: 'tv',
        genres: [],
        year: null,
        sort: 'popularity.desc',
      };
      const serialized = serializeDiscoverParams(params);
      expect(serialized).toBe('type=tv');
    });
  });

  describe('round-trip: serialize → deserialize', () => {
    it('round-trips complex params', () => {
      const p: DiscoverParams = {
        type: 'tv',
        genres: [16, 35],
        year: 2024,
        sort: 'vote_average.desc',
      };
      const serialized = serializeDiscoverParams(p);
      const deserialized = parseDiscoverParams(
        Object.fromEntries(new URLSearchParams(serialized)),
        new Date('2026-10-04')
      );
      expect(deserialized).toEqual(p);
    });

    it('round-trips default params', () => {
      const p = DEFAULT_DISCOVER;
      const serialized = serializeDiscoverParams(p);
      const deserialized = parseDiscoverParams(
        Object.fromEntries(new URLSearchParams(serialized)),
        new Date('2026-10-04')
      );
      expect(deserialized).toEqual(p);
    });
  });

  describe('toTmdbDiscoverQuery', () => {
    it('maps movie params to TMDB query', () => {
      const params: DiscoverParams = {
        type: 'movie',
        genres: [28],
        year: 2024,
        sort: 'popularity.desc',
      };
      const query = toTmdbDiscoverQuery(params);
      expect(query.primary_release_year).toBe(2024);
      expect(query.with_genres).toBe('28');
      expect(query.sort_by).toBe('popularity.desc');
    });

    it('maps tv params to TMDB query', () => {
      const params: DiscoverParams = {
        type: 'tv',
        genres: [16, 35],
        year: 2024,
        sort: 'release_date.desc',
      };
      const query = toTmdbDiscoverQuery(params);
      expect(query.first_air_date_year).toBe(2024);
      expect(query.with_genres).toBe('16,35');
      expect(query.sort_by).toBe('first_air_date.desc');
    });

    it('maps movie release_date.desc to primary_release_date.desc', () => {
      const params: DiscoverParams = {
        type: 'movie',
        genres: [],
        year: null,
        sort: 'release_date.desc',
      };
      const query = toTmdbDiscoverQuery(params);
      expect(query.sort_by).toBe('primary_release_date.desc');
    });

    it('maps tv release_date.desc to first_air_date.desc', () => {
      const params: DiscoverParams = {
        type: 'tv',
        genres: [],
        year: null,
        sort: 'release_date.desc',
      };
      const query = toTmdbDiscoverQuery(params);
      expect(query.sort_by).toBe('first_air_date.desc');
    });

    it('maps movie title.asc to title.asc', () => {
      const params: DiscoverParams = {
        type: 'movie',
        genres: [],
        year: null,
        sort: 'title.asc',
      };
      const query = toTmdbDiscoverQuery(params);
      expect(query.sort_by).toBe('title.asc');
    });

    it('maps tv title.asc to name.asc', () => {
      const params: DiscoverParams = {
        type: 'tv',
        genres: [],
        year: null,
        sort: 'title.asc',
      };
      const query = toTmdbDiscoverQuery(params);
      expect(query.sort_by).toBe('name.asc');
    });

    it('adds vote_count.gte for vote_average.desc sort', () => {
      const params: DiscoverParams = {
        type: 'movie',
        genres: [],
        year: null,
        sort: 'vote_average.desc',
      };
      const query = toTmdbDiscoverQuery(params);
      expect(query['vote_count.gte']).toBe(200);
    });

    it('does not add vote_count.gte for popularity sort', () => {
      const params: DiscoverParams = {
        type: 'movie',
        genres: [],
        year: null,
        sort: 'popularity.desc',
      };
      const query = toTmdbDiscoverQuery(params);
      expect(query['vote_count.gte']).toBeUndefined();
    });

    it('omits year field when null', () => {
      const params: DiscoverParams = {
        type: 'movie',
        genres: [],
        year: null,
        sort: 'popularity.desc',
      };
      const query = toTmdbDiscoverQuery(params);
      expect(query.primary_release_year).toBeUndefined();
    });

    it('omits with_genres when genres is empty', () => {
      const params: DiscoverParams = {
        type: 'movie',
        genres: [],
        year: null,
        sort: 'popularity.desc',
      };
      const query = toTmdbDiscoverQuery(params);
      expect(query.with_genres).toBeUndefined();
    });

    it('handles multiple genres in TMDB query', () => {
      const params: DiscoverParams = {
        type: 'movie',
        genres: [28, 35, 53],
        year: null,
        sort: 'popularity.desc',
      };
      const query = toTmdbDiscoverQuery(params);
      expect(query.with_genres).toBe('28,35,53');
    });
  });

  describe('params.ts source code validation', () => {
    it('does not contain non-type imports from @/lib/tmdb', () => {
      const sourceFile = resolve(__dirname, './params.ts');
      const source = readFileSync(sourceFile, 'utf-8');

      // Look for import lines that reference lib/tmdb but are not "import type"
      const nonTypeImportPattern =
        /^(?!import\s+type\s+).+from\s+['"]@\/lib\/tmdb/m;
      const hasNonTypeImport = nonTypeImportPattern.test(source);

      expect(hasNonTypeImport).toBe(false);
    });
  });
});
