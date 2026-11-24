import {
  heroScrollProgress,
  orbitAngle,
  orbitCenterX,
  orbitSlot,
  rotationToFront,
  wrapIndex,
} from './hero-3d-utils';

const TAU = Math.PI * 2;

describe('wrapIndex', () => {
  it('wraps forwards and backwards', () => {
    expect(wrapIndex(5, 5)).toBe(0);
    expect(wrapIndex(-1, 5)).toBe(4);
    expect(wrapIndex(12, 5)).toBe(2);
    expect(wrapIndex(3, 0)).toBe(0);
  });
});

describe('rotationToFront', () => {
  it('brings the item to angle 0', () => {
    for (let i = 0; i < 5; i++) {
      const rotation = rotationToFront(i, 5, 0);
      const front = (orbitAngle(i, 5) + rotation) % TAU;
      expect(
        Math.abs(front) < 1e-9 || Math.abs(Math.abs(front) - TAU) < 1e-9
      ).toBe(true);
    }
  });

  it('takes the short way across the wrap', () => {
    // From the last item (4 of 5) to the first: one step forward, not four
    // steps back.
    const fromLast = rotationToFront(4, 5, 0);
    const toFirst = rotationToFront(0, 5, fromLast);
    expect(Math.abs(toFirst - fromLast)).toBeCloseTo(TAU / 5);
  });

  it('stays near the current rotation after many turns', () => {
    const current = 10 * TAU + 0.1;
    expect(Math.abs(rotationToFront(0, 5, current) - current)).toBeLessThan(
      Math.PI
    );
  });
});

describe('orbitSlot', () => {
  const orbit = { radiusX: 2, radiusZ: 1, lift: 0.5, yawFactor: 0.5 };

  it('puts angle 0 at the front, facing the camera', () => {
    expect(orbitSlot(0, orbit)).toEqual({
      x: 0,
      y: 0,
      z: 1,
      yaw: 0,
      depth: 0,
    });
  });

  it('puts the back higher and further away', () => {
    const back = orbitSlot(Math.PI, orbit);
    expect(back.z).toBeCloseTo(-1);
    expect(back.y).toBeCloseTo(0.5);
    expect(back.depth).toBeCloseTo(1);
  });

  it('turns side cards slightly towards the centre', () => {
    const right = orbitSlot(Math.PI / 2, orbit);
    expect(right.x).toBeCloseTo(2);
    expect(right.yaw).toBeCloseTo(0.5);
    expect(orbitSlot(-Math.PI / 2, orbit).yaw).toBeCloseTo(-0.5);
  });
});

describe('orbitCenterX', () => {
  it('moves the orbit right on wide stages only', () => {
    const wide = orbitCenterX(16 / 9, 40, 6);
    const square = orbitCenterX(1.1, 40, 6);
    expect(wide).toBeGreaterThan(square);
    expect(square).toBeGreaterThan(0);
    expect(orbitCenterX(0.8, 40, 6)).toBe(0);
  });

  it('places the front card at ~73% of a wide stage', () => {
    const aspect = 2;
    const distance = 6;
    const halfWidth = distance * Math.tan((20 * Math.PI) / 180) * aspect;
    const x = orbitCenterX(aspect, 40, distance);
    expect(0.5 + x / (2 * halfWidth)).toBeCloseTo(0.73);
  });
});

describe('heroScrollProgress', () => {
  it('is 0 at the top and 1 once the hero has left', () => {
    expect(heroScrollProgress({ top: 0, height: 600 })).toBe(0);
    expect(heroScrollProgress({ top: 120, height: 600 })).toBe(0);
    expect(heroScrollProgress({ top: -300, height: 600 })).toBe(0.5);
    expect(heroScrollProgress({ top: -900, height: 600 })).toBe(1);
    expect(heroScrollProgress({ top: -10, height: 0 })).toBe(0);
  });
});
