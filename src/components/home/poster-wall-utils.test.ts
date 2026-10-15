import { scrollProgress, shouldEnhance, wallLayout } from './poster-wall-utils';

describe('shouldEnhance', () => {
  it.each([
    [{ finePointer: true, reducedMotion: false, webgl: true }, true],
    [{ finePointer: false, reducedMotion: false, webgl: true }, false],
    [{ finePointer: true, reducedMotion: true, webgl: true }, false],
    [{ finePointer: true, reducedMotion: false, webgl: false }, false],
    [{ finePointer: false, reducedMotion: true, webgl: false }, false],
  ])('%o → %s', (env, expected) => {
    expect(shouldEnhance(env)).toBe(expected);
  });
});

describe('scrollProgress', () => {
  const vh = 800;
  // The sticky track is 2 viewports tall: one viewport of scrolling while the
  // stage is pinned.
  const track = (top: number) => ({ top, height: 1600 });

  it('is 0 before the track reaches the top of the viewport', () => {
    expect(scrollProgress(track(300), vh)).toBe(0);
    expect(scrollProgress(track(0), vh)).toBe(0);
  });

  it('grows linearly while the stage is pinned', () => {
    expect(scrollProgress(track(-200), vh)).toBeCloseTo(0.25);
    expect(scrollProgress(track(-400), vh)).toBeCloseTo(0.5);
  });

  it('is 1 once the track has scrolled past', () => {
    expect(scrollProgress(track(-800), vh)).toBe(1);
    expect(scrollProgress(track(-5000), vh)).toBe(1);
  });

  it('jumps from 0 to 1 when the track is not taller than the viewport', () => {
    expect(scrollProgress({ top: 10, height: 600 }, vh)).toBe(0);
    expect(scrollProgress({ top: -1, height: 600 }, vh)).toBe(1);
  });
});

describe('wallLayout', () => {
  const radius = 9;

  it('returns one slot per item', () => {
    expect(wallLayout(0)).toEqual([]);
    expect(wallLayout(30)).toHaveLength(30);
    expect(wallLayout(7)).toHaveLength(7);
  });

  it('places every card on the cylinder, facing the centre', () => {
    for (const slot of wallLayout(30, { radius })) {
      expect(Math.hypot(slot.x, slot.z)).toBeCloseTo(radius);
      // The plane's normal (sin r, 0, cos r) points at the axis.
      expect(Math.sin(slot.rotationY)).toBeCloseTo(-slot.x / radius);
      expect(Math.cos(slot.rotationY)).toBeCloseTo(-slot.z / radius);
    }
  });

  it('spaces columns by the card width plus a fixed gap, odd rows offset by half a column', () => {
    const slots = wallLayout(30, {
      radius,
      rows: 3,
      cardWidth: 1.6,
      columnGap: 0.3,
    });
    const angle = (i: number) => Math.atan2(slots[i].x, -slots[i].z);
    // 3 rows × 10 columns, row-major. Adjacent cards are 1.9 apart along the
    // wall (a 0.3 gap), not spread over a fixed arc.
    const step = 1.9 / radius;
    expect(angle(1) - angle(0)).toBeCloseTo(step);
    expect(angle(10) - angle(0)).toBeCloseTo(step / 2);
    expect(angle(20) - angle(0)).toBeCloseTo(0);
    // The whole pattern stays centred.
    expect(angle(0) + angle(19)).toBeCloseTo(0);
  });

  it('uses tight defaults: ~19% column gap and a small row gap', () => {
    const slots = wallLayout(30);
    const angle = (i: number) => Math.atan2(slots[i].x, -slots[i].z);
    expect(angle(1) - angle(0)).toBeCloseTo((1.6 + 0.3) / 9);
    expect(slots[0].y - slots[10].y).toBeCloseTo(2.4 + 0.15);
  });

  it('stacks the rows symmetrically around y = 0', () => {
    const slots = wallLayout(30, { rows: 3, cardHeight: 2.4, rowGap: 0.2 });
    expect(slots[0].y).toBeCloseTo(2.6);
    expect(slots[10].y).toBeCloseTo(0);
    expect(slots[20].y).toBeCloseTo(-2.6);
  });

  it('centres a single card in front of the camera', () => {
    const [slot] = wallLayout(1, { radius });
    expect(slot.x).toBeCloseTo(0);
    expect(slot.y).toBeCloseTo(0);
    expect(slot.z).toBeCloseTo(-radius);
  });
});
