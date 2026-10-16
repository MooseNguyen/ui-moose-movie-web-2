import { TILT_MAX_DEG, tiltFromPointer } from './tilt';

const rect = { left: 100, top: 200, width: 200, height: 300 };

describe('tiltFromPointer', () => {
  it('is flat with the glare centred when the pointer is in the middle', () => {
    expect(tiltFromPointer(rect, 200, 350)).toEqual({
      rx: 0,
      ry: 0,
      gx: 50,
      gy: 50,
    });
  });

  it('tilts the side under the pointer away, up to the max angle', () => {
    // Top-right corner: right side back (rotateY +), top back (rotateX +).
    expect(tiltFromPointer(rect, 300, 200)).toEqual({
      rx: TILT_MAX_DEG,
      ry: TILT_MAX_DEG,
      gx: 100,
      gy: 0,
    });
    // Bottom-left corner: the opposite.
    expect(tiltFromPointer(rect, 100, 500)).toEqual({
      rx: -TILT_MAX_DEG,
      ry: -TILT_MAX_DEG,
      gx: 0,
      gy: 100,
    });
  });

  it('clamps a pointer outside the card to its edges', () => {
    expect(tiltFromPointer(rect, 0, 900)).toEqual(
      tiltFromPointer(rect, 100, 500)
    );
  });

  it('honours a custom max angle', () => {
    expect(tiltFromPointer(rect, 300, 350, 4)).toMatchObject({ ry: 4, rx: 0 });
  });

  it('stays flat for a zero-size card instead of dividing by zero', () => {
    expect(
      tiltFromPointer({ left: 0, top: 0, width: 0, height: 0 }, 10, 10)
    ).toEqual({ rx: 0, ry: 0, gx: 50, gy: 50 });
  });
});
