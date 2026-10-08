import { calcAge } from './age';

describe('calcAge', () => {
  it('counts full years up to today for a living person', () => {
    expect(calcAge('1990-10-05', null, new Date('2026-10-04'))).toBe(35);
  });

  it('counts the year on the birthday itself', () => {
    expect(calcAge('1990-10-05', null, new Date('2026-10-05'))).toBe(36);
  });

  it('uses the UTC calendar date of "now"', () => {
    // 23:30 UTC on the day before the birthday is still the day before.
    expect(calcAge('1990-10-05', null, new Date('2026-10-04T23:30:00Z'))).toBe(
      35
    );
  });

  it('measures age at death and ignores "now"', () => {
    expect(calcAge('1950-01-01', '2000-06-01')).toBe(50);
    expect(calcAge('1950-06-02', '2000-06-01', new Date('2026-01-01'))).toBe(
      49
    );
  });

  it('handles a 29 February birthday', () => {
    expect(calcAge('2000-02-29', null, new Date('2025-02-28'))).toBe(24);
    expect(calcAge('2000-02-29', null, new Date('2025-03-01'))).toBe(25);
  });

  it.each([
    ['an empty birthday', '', null],
    ['a malformed birthday', '1990-1-5', null],
    ['an impossible date', '1990-02-30', null],
    ['a malformed deathday', '1990-01-05', 'unknown'],
    ['a deathday before the birthday', '1990-01-05', '1980-01-01'],
  ])('returns null for %s', (_label, birthday, deathday) => {
    expect(calcAge(birthday, deathday, new Date('2026-10-04'))).toBeNull();
  });

  it('returns null for a birthday in the future', () => {
    expect(calcAge('2030-01-01', null, new Date('2026-10-04'))).toBeNull();
  });
});
