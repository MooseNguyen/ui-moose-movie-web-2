import { oklchToHex, rgbToOklch } from './oklch';

describe('rgbToOklch', () => {
  it.each([
    // Reference values from the OKLab definition (Björn Ottosson).
    ['white', [255, 255, 255], { l: 1, c: 0 }],
    ['black', [0, 0, 0], { l: 0, c: 0 }],
    ['red', [255, 0, 0], { l: 0.628, c: 0.258, h: 29.2 }],
    ['green', [0, 255, 0], { l: 0.866, c: 0.295, h: 142.5 }],
    ['blue', [0, 0, 255], { l: 0.452, c: 0.313, h: 264.1 }],
  ] as const)('converts %s', (_name, [r, g, b], expected) => {
    const { l, c, h } = rgbToOklch(r, g, b);

    expect(l).toBeCloseTo(expected.l, 2);
    expect(c).toBeCloseTo(expected.c, 2);
    if ('h' in expected) expect(h).toBeCloseTo(expected.h, 0);
  });

  it('reports hue 0 for greys, where hue is undefined', () => {
    expect(rgbToOklch(128, 128, 128).h).toBe(0);
  });
});

describe('oklchToHex', () => {
  it.each([
    [{ l: 1, c: 0, h: 0 }, '#ffffff'],
    [{ l: 0, c: 0, h: 0 }, '#000000'],
    [{ l: 0.628, c: 0.258, h: 29.2 }, '#ff0000'],
  ])('converts %o', (color, hex) => {
    expect(oklchToHex(color)).toBe(hex);
  });

  it('round-trips an sRGB color', () => {
    expect(oklchToHex(rgbToOklch(0x1f, 0x8c, 0xf7))).toBe('#1f8cf7');
  });

  it('clips colors outside sRGB instead of producing invalid hex', () => {
    expect(oklchToHex({ l: 0.9, c: 0.4, h: 150 })).toMatch(/^#[0-9a-f]{6}$/);
  });
});
