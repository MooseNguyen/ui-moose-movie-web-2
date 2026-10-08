import {
  MAX_QUERY_LENGTH,
  parseListName,
  parseMediaType,
  parsePositiveId,
  parseSearchQuery,
  parseSearchType,
} from './route-params';

describe('parseMediaType', () => {
  it('accepts movie and tv only', () => {
    expect(parseMediaType('movie')).toBe('movie');
    expect(parseMediaType('tv')).toBe('tv');
    expect(parseMediaType('anime')).toBeNull();
    expect(parseMediaType('Movie')).toBeNull();
    expect(parseMediaType('')).toBeNull();
  });
});

describe('parseListName', () => {
  it('keeps a list valid for the media type', () => {
    expect(parseListName('movie', 'top_rated')).toBe('top_rated');
    expect(parseListName('movie', 'now_playing')).toBe('now_playing');
    expect(parseListName('tv', 'airing_today')).toBe('airing_today');
  });

  it('falls back to popular for lists of the other media type', () => {
    expect(parseListName('tv', 'upcoming')).toBe('popular');
    expect(parseListName('movie', 'on_the_air')).toBe('popular');
  });

  it('falls back to popular for garbage and missing values', () => {
    expect(parseListName('movie', 'nope')).toBe('popular');
    expect(parseListName('movie', '')).toBe('popular');
    expect(parseListName('movie', undefined)).toBe('popular');
    expect(parseListName('movie', 'constructor')).toBe('popular');
  });

  it('uses the first value of a repeated search param', () => {
    expect(parseListName('movie', ['upcoming', 'top_rated'])).toBe('upcoming');
    expect(parseListName('movie', ['nope', 'upcoming'])).toBe('popular');
    expect(parseListName('movie', [])).toBe('popular');
  });
});

describe('parsePositiveId', () => {
  it('accepts digit-only positive integers without leading zero', () => {
    expect(parsePositiveId('550')).toBe(550);
    expect(parsePositiveId('1')).toBe(1);
  });

  it.each(['12abc', '0', '012', '1e3', '-5', '1.5', ' 5', '', '+5', '٣'])(
    'rejects %j',
    (value) => {
      expect(parsePositiveId(value)).toBeNull();
    }
  );

  it('rejects numbers beyond the safe integer range', () => {
    expect(parsePositiveId('9007199254740991')).toBe(9007199254740991);
    expect(parsePositiveId('9007199254740992')).toBeNull();
    expect(parsePositiveId('9'.repeat(400))).toBeNull();
  });
});

describe('parseSearchType', () => {
  it.each(['multi', 'movie', 'tv', 'person'] as const)('keeps %s', (type) => {
    expect(parseSearchType(type)).toBe(type);
  });

  it.each([undefined, '', 'collection', 'Movie', 'constructor'])(
    'falls back to multi for %j',
    (value) => {
      expect(parseSearchType(value)).toBe('multi');
    }
  );

  it('uses the first value of a repeated param', () => {
    expect(parseSearchType(['tv', 'movie'])).toBe('tv');
    expect(parseSearchType(['nope', 'movie'])).toBe('multi');
    expect(parseSearchType([])).toBe('multi');
  });
});

describe('parseSearchQuery', () => {
  it('limits queries to 100 characters', () => {
    expect(MAX_QUERY_LENGTH).toBe(100);
  });

  // Next has already decoded the URL: the parser must keep the exact string.
  it.each(['người nhện', 'a/b', '50%', 'a&b=c', '#1 ?'])(
    'keeps %j unchanged',
    (value) => {
      expect(parseSearchQuery(value)).toBe(value);
    }
  );

  it('trims surrounding whitespace', () => {
    expect(parseSearchQuery('  người nhện \n')).toBe('người nhện');
  });

  it.each([undefined, '', '   ', '\t\n'])('returns null for %j', (value) => {
    expect(parseSearchQuery(value)).toBeNull();
  });

  it('uses the first value of a repeated param', () => {
    expect(parseSearchQuery(['  dune ', 'matrix'])).toBe('dune');
    expect(parseSearchQuery([' ', 'matrix'])).toBeNull();
    expect(parseSearchQuery([])).toBeNull();
  });

  it('cuts long queries to the limit and trims the cut end', () => {
    expect(parseSearchQuery('a'.repeat(150))).toBe('a'.repeat(100));
    expect(parseSearchQuery('a'.repeat(100))).toBe('a'.repeat(100));
    // The cut lands right after a space: no trailing whitespace survives.
    expect(parseSearchQuery('a'.repeat(99) + ' bcd')).toBe('a'.repeat(99));
    expect(parseSearchQuery('  ' + 'b'.repeat(120))).toBe('b'.repeat(100));
  });
});
