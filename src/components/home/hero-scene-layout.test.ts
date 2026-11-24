import {
  edgeFade,
  heroScrollProgress,
  loopOffset,
  nearestFocus,
} from './hero-scene-layout';

describe('loopOffset', () => {
  it('keeps offsets inside half the list as they are', () => {
    expect(loopOffset(0, 20)).toBe(0);
    expect(loopOffset(3, 20)).toBe(3);
    expect(loopOffset(-3, 20)).toBe(-3);
  });

  it('wraps across the loop seam', () => {
    // The last poster sits just left of the first one.
    expect(loopOffset(19, 20)).toBe(-1);
    expect(loopOffset(-19, 20)).toBe(1);
    expect(loopOffset(4.5, 5)).toBeCloseTo(-0.5);
  });

  it('is 0 for an empty list', () => {
    expect(loopOffset(3, 0)).toBe(0);
  });
});

describe('nearestFocus', () => {
  it('keeps a target that is already the short way', () => {
    expect(nearestFocus(2, 3, 20)).toBe(3);
  });

  it('turns the short way across the loop seam', () => {
    // From the last poster of 20 to the first: one step forward, not 19 back.
    expect(nearestFocus(19, 0, 20)).toBe(20);
    expect(nearestFocus(0, 19, 20)).toBe(-1);
  });

  it('works after many laps', () => {
    expect(nearestFocus(101.2, 1, 20)).toBe(101);
  });
});

describe('edgeFade', () => {
  it('is fully opaque near the focus and transparent past the visible range', () => {
    expect(edgeFade(0, 20, 3.6)).toBe(1);
    expect(edgeFade(2, 20, 3.6)).toBeGreaterThan(0.9);
    expect(edgeFade(3.6, 20, 3.6)).toBe(0);
    expect(edgeFade(-5, 20, 3.6)).toBe(0);
  });

  it('fades out before the loop seam of a short list', () => {
    expect(edgeFade(2.5, 5, 3.6)).toBe(0);
    expect(edgeFade(2, 5, 3.6)).toBeGreaterThan(0);
    expect(edgeFade(2, 5, 3.6)).toBeLessThan(0.5);
  });
});

describe('heroScrollProgress', () => {
  it('is 0 while the hero top is at or below the viewport top', () => {
    expect(heroScrollProgress({ top: 0, height: 600 })).toBe(0);
    expect(heroScrollProgress({ top: 100, height: 600 })).toBe(0);
  });

  it('grows with the scrolled distance and stops at 1', () => {
    expect(heroScrollProgress({ top: -300, height: 600 })).toBeCloseTo(0.5);
    expect(heroScrollProgress({ top: -900, height: 600 })).toBe(1);
  });

  it('is 0 for an element without height', () => {
    expect(heroScrollProgress({ top: -10, height: 0 })).toBe(0);
  });
});
