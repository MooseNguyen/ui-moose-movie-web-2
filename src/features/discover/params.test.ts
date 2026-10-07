import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  parseDiscoverParams,
  serializeDiscoverParams,
  toTmdbDiscoverQuery,
  type DiscoverParams,
  type DiscoverSort,
} from './params';

describe('discover params', () => {
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

    it('handles array-valued genres and uses first value', () => {
      expect(
        parseDiscoverParams(
          {
            genres: ['28,35', '16,18'],
          },
          new Date('2026-10-04')
        )
      ).toEqual({
        type: 'movie',
        genres: [28, 35],
        year: null,
        sort: 'popularity.desc',
      });
    });

    it('handles array-valued year and uses first value', () => {
      expect(
        parseDiscoverParams(
          {
            year: ['2024', '2020'],
          },
          new Date('2026-10-04')
        )
      ).toEqual({
        type: 'movie',
        genres: [],
        year: 2024,
        sort: 'popularity.desc',
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

    it('rejects non-numeric genre tokens', () => {
      expect(
        parseDiscoverParams({ genres: '28abc,35' }, new Date('2026-10-04'))
      ).toEqual({
        type: 'movie',
        genres: [35],
        year: null,
        sort: 'popularity.desc',
      });
    });

    it('rejects decimal genre tokens', () => {
      expect(
        parseDiscoverParams({ genres: '28.5,35' }, new Date('2026-10-04'))
      ).toEqual({
        type: 'movie',
        genres: [35],
        year: null,
        sort: 'popularity.desc',
      });
    });

    it('rejects scientific notation genre tokens', () => {
      expect(
        parseDiscoverParams({ genres: '1e3,35' }, new Date('2026-10-04'))
      ).toEqual({
        type: 'movie',
        genres: [35],
        year: null,
        sort: 'popularity.desc',
      });
    });

    it('rejects genre tokens with whitespace', () => {
      expect(
        parseDiscoverParams({ genres: ' 28,35' }, new Date('2026-10-04'))
      ).toEqual({
        type: 'movie',
        genres: [35],
        year: null,
        sort: 'popularity.desc',
      });
    });

    it('rejects genre tokens that exceed safe integer', () => {
      expect(
        parseDiscoverParams(
          { genres: '99999999999999999999,35' },
          new Date('2026-10-04')
        )
      ).toEqual({
        type: 'movie',
        genres: [35],
        year: null,
        sort: 'popularity.desc',
      });
    });

    it('accepts genre tokens with leading zeros', () => {
      expect(
        parseDiscoverParams({ genres: '028,035' }, new Date('2026-10-04'))
      ).toEqual({
        type: 'movie',
        genres: [28, 35],
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
      expect(
        serializeDiscoverParams({
          type: 'movie',
          genres: [],
          year: null,
          sort: 'popularity.desc',
        })
      ).toBe('');
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

  describe('round-trip stability', () => {
    it('serializes and deserializes complex params', () => {
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

    it('serializes and deserializes default params', () => {
      const p: DiscoverParams = {
        type: 'movie',
        genres: [],
        year: null,
        sort: 'popularity.desc',
      };
      const serialized = serializeDiscoverParams(p);
      const deserialized = parseDiscoverParams(
        Object.fromEntries(new URLSearchParams(serialized)),
        new Date('2026-10-04')
      );
      expect(deserialized).toEqual(p);
    });

    it('handles messy input with leading zeros and duplicates', () => {
      // Input: genres with leading zeros, duplicates, and type override
      const messyInput =
        'genres=35,028,16,35&type=tv&sort=vote_average.desc&year=2024';
      const parsed = parseDiscoverParams(
        Object.fromEntries(new URLSearchParams(messyInput)),
        new Date('2026-10-04')
      );
      // Genres should be deduplicated and sorted
      expect(parsed).toEqual({
        type: 'tv',
        genres: [16, 28, 35],
        year: 2024,
        sort: 'vote_average.desc',
      });
      // Round-trip back
      const reserialized = serializeDiscoverParams(parsed);
      const reparsed = parseDiscoverParams(
        Object.fromEntries(new URLSearchParams(reserialized)),
        new Date('2026-10-04')
      );
      expect(reparsed).toEqual(parsed);
    });
  });

  describe('toTmdbDiscoverQuery', () => {
    const baseMovieParams: DiscoverParams = {
      type: 'movie',
      genres: [],
      year: null,
      sort: 'popularity.desc',
    };

    const baseTvParams: DiscoverParams = {
      type: 'tv',
      genres: [],
      year: null,
      sort: 'popularity.desc',
    };

    it.each([
      {
        name: 'popularity.desc',
        sort: 'popularity.desc',
        expected: 'popularity.desc',
      },
      {
        name: 'vote_average.desc',
        sort: 'vote_average.desc',
        expected: 'vote_average.desc',
      },
      {
        name: 'release_date.desc to primary_release_date.desc',
        sort: 'release_date.desc',
        expected: 'primary_release_date.desc',
      },
      {
        name: 'title.asc',
        sort: 'title.asc',
        expected: 'title.asc',
      },
    ])('maps movie $name', ({ sort, expected }) => {
      const params: DiscoverParams = {
        ...baseMovieParams,
        sort: sort as DiscoverSort,
      };
      const query = toTmdbDiscoverQuery(params);
      expect(query.sort_by).toBe(expected);
    });

    it.each([
      {
        name: 'popularity.desc',
        sort: 'popularity.desc',
        expected: 'popularity.desc',
      },
      {
        name: 'vote_average.desc',
        sort: 'vote_average.desc',
        expected: 'vote_average.desc',
      },
      {
        name: 'release_date.desc to first_air_date.desc',
        sort: 'release_date.desc',
        expected: 'first_air_date.desc',
      },
      {
        name: 'title.asc to name.asc',
        sort: 'title.asc',
        expected: 'name.asc',
      },
    ])('maps tv $name', ({ sort, expected }) => {
      const params: DiscoverParams = {
        ...baseTvParams,
        sort: sort as DiscoverSort,
      };
      const query = toTmdbDiscoverQuery(params);
      expect(query.sort_by).toBe(expected);
    });

    it('adds vote_count.gte for vote_average.desc on movie', () => {
      const params: DiscoverParams = {
        ...baseMovieParams,
        sort: 'vote_average.desc',
      };
      const query = toTmdbDiscoverQuery(params);
      expect(query['vote_count.gte']).toBe(200);
    });

    it('adds vote_count.gte for vote_average.desc on tv', () => {
      const params: DiscoverParams = {
        ...baseTvParams,
        sort: 'vote_average.desc',
      };
      const query = toTmdbDiscoverQuery(params);
      expect(query['vote_count.gte']).toBe(200);
    });

    it('does not add vote_count.gte for other sorts', () => {
      const params: DiscoverParams = {
        ...baseMovieParams,
        sort: 'popularity.desc',
      };
      const query = toTmdbDiscoverQuery(params);
      expect(query['vote_count.gte']).toBeUndefined();
    });

    it('maps year to primary_release_year for movie', () => {
      const params: DiscoverParams = { ...baseMovieParams, year: 2024 };
      const query = toTmdbDiscoverQuery(params);
      expect(query.primary_release_year).toBe(2024);
    });

    it('maps year to first_air_date_year for tv', () => {
      const params: DiscoverParams = { ...baseTvParams, year: 2024 };
      const query = toTmdbDiscoverQuery(params);
      expect(query.first_air_date_year).toBe(2024);
    });

    it('omits year when null', () => {
      const params: DiscoverParams = {
        ...baseMovieParams,
        year: null,
      };
      const query = toTmdbDiscoverQuery(params);
      expect(query.primary_release_year).toBeUndefined();
    });

    it('maps genres to with_genres', () => {
      const params: DiscoverParams = {
        ...baseMovieParams,
        genres: [28, 35, 53],
      };
      const query = toTmdbDiscoverQuery(params);
      expect(query.with_genres).toBe('28,35,53');
    });

    it('omits with_genres when empty', () => {
      const params: DiscoverParams = { ...baseMovieParams, genres: [] };
      const query = toTmdbDiscoverQuery(params);
      expect(query.with_genres).toBeUndefined();
    });

    it('combines all params for complex query', () => {
      const params: DiscoverParams = {
        type: 'tv',
        genres: [16, 35],
        year: 2024,
        sort: 'release_date.desc',
      };
      const query = toTmdbDiscoverQuery(params);
      expect(query.sort_by).toBe('first_air_date.desc');
      expect(query.first_air_date_year).toBe(2024);
      expect(query.with_genres).toBe('16,35');
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
