import { approach, depthFromPointer, scrollDepth } from './detail-depth';

const rect = { left: 100, top: 50, width: 400, height: 200 };

describe('depthFromPointer', () => {
  it('is 0 in the centre and ±1 on the edges', () => {
    expect(depthFromPointer(rect, 300, 150)).toEqual({ x: 0, y: 0 });
    expect(depthFromPointer(rect, 100, 50)).toEqual({ x: -1, y: -1 });
    expect(depthFromPointer(rect, 500, 250)).toEqual({ x: 1, y: 1 });
    expect(depthFromPointer(rect, 400, 100)).toEqual({ x: 0.5, y: -0.5 });
  });

  it('clamps points outside the hero', () => {
    expect(depthFromPointer(rect, -50, 900)).toEqual({ x: -1, y: 1 });
  });

  it('reads a zero-size hero as centred', () => {
    expect(
      depthFromPointer({ left: 0, top: 0, width: 0, height: 0 }, 10, 10)
    ).toEqual({ x: 0, y: 0 });
  });
});

describe('scrollDepth', () => {
  it('counts the pixels scrolled past the top, up to the height', () => {
    expect(scrollDepth({ top: 64, height: 500 })).toBe(0);
    expect(scrollDepth({ top: 0, height: 500 })).toBe(0);
    expect(scrollDepth({ top: -120, height: 500 })).toBe(120);
    expect(scrollDepth({ top: -900, height: 500 })).toBe(500);
  });
});

describe('approach', () => {
  it('moves part of the way and snaps when close', () => {
    expect(approach(0, 1, 0.5)).toBe(0.5);
    expect(approach(0.9995, 1)).toBe(1);
    expect(approach(1, 1)).toBe(1);
  });

  it('settles in a bounded number of frames', () => {
    let value = 0;
    let frames = 0;
    while (value !== -1 && frames < 200) {
      value = approach(value, -1);
      frames++;
    }
    expect(value).toBe(-1);
    expect(frames).toBeLessThan(60);
  });
});
