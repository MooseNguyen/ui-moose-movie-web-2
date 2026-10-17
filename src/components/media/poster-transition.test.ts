import { CARD_NAV_TRANSITION, posterTransitionName } from './poster-transition';

describe('posterTransitionName', () => {
  it('is unique per media type and id', () => {
    expect(posterTransitionName('movie', 550)).toBe('poster-movie-550');
    expect(posterTransitionName('tv', 550)).toBe('poster-tv-550');
  });
});

describe('CARD_NAV_TRANSITION', () => {
  it('is a plain transition type name', () => {
    expect(CARD_NAV_TRANSITION).toMatch(/^[a-z-]+$/);
  });
});
