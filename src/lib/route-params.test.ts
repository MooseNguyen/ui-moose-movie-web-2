import { parseListName, parseMediaType, parsePositiveId } from './route-params';

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
