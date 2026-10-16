import { render } from '@testing-library/react';
import { TiltController } from './TiltController';

function mockMatchMedia({
  finePointer,
  reducedMotion,
}: {
  finePointer: boolean;
  reducedMotion: boolean;
}) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query.includes('prefers-reduced-motion')
      ? reducedMotion
      : finePointer,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

function renderCards() {
  const result = render(
    <>
      <TiltController />
      <div data-tilt data-testid="a">
        <span data-testid="a-inner">poster</span>
      </div>
      <div data-tilt data-testid="b" />
      <div data-testid="outside" />
    </>
  );
  for (const id of ['a', 'b']) {
    const card = result.getByTestId(id);
    card.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 200, height: 300 }) as DOMRect;
  }
  return result;
}

// Like the browser, frames run later, not inside requestAnimationFrame().
let frames: FrameRequestCallback[] = [];

function move(target: Element, clientX: number, clientY: number) {
  target.dispatchEvent(
    new MouseEvent('pointermove', { bubbles: true, clientX, clientY })
  );
  const pending = frames;
  frames = [];
  for (const cb of pending) cb(0);
}

beforeEach(() => {
  frames = [];
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    frames.push(cb);
    return frames.length;
  });
  vi.stubGlobal('cancelAnimationFrame', () => {
    frames = [];
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('TiltController', () => {
  it('tilts the card under the pointer through CSS variables', () => {
    mockMatchMedia({ finePointer: true, reducedMotion: false });
    const { getByTestId } = renderCards();
    const card = getByTestId('a');

    // Top-right corner of the card, from a child element (delegation).
    move(getByTestId('a-inner'), 200, 0);

    expect(card).toHaveAttribute('data-tilting');
    expect(card.style.getPropertyValue('--tilt-rx')).toBe('8deg');
    expect(card.style.getPropertyValue('--tilt-ry')).toBe('8deg');
    expect(card.style.getPropertyValue('--tilt-gx')).toBe('100%');
    expect(card.style.getPropertyValue('--tilt-gy')).toBe('0%');
  });

  it('resets a card when the pointer leaves it', () => {
    mockMatchMedia({ finePointer: true, reducedMotion: false });
    const { getByTestId } = renderCards();
    const a = getByTestId('a');

    move(a, 200, 0);
    move(getByTestId('outside'), 10, 10);

    expect(a).not.toHaveAttribute('data-tilting');
    expect(a.style.getPropertyValue('--tilt-rx')).toBe('');
  });

  it('moves the tilt from one card to the next', () => {
    mockMatchMedia({ finePointer: true, reducedMotion: false });
    const { getByTestId } = renderCards();

    move(getByTestId('a'), 200, 0);
    move(getByTestId('b'), 0, 300);

    expect(getByTestId('a')).not.toHaveAttribute('data-tilting');
    expect(getByTestId('b')).toHaveAttribute('data-tilting');
    expect(getByTestId('b').style.getPropertyValue('--tilt-rx')).toBe('-8deg');
  });

  it.each([
    ['touch / coarse pointer', { finePointer: false, reducedMotion: false }],
    ['reduced motion', { finePointer: true, reducedMotion: true }],
  ])('does nothing for %s', (_label, env) => {
    mockMatchMedia(env);
    const { getByTestId } = renderCards();

    move(getByTestId('a'), 200, 0);

    expect(getByTestId('a')).not.toHaveAttribute('data-tilting');
  });

  it('stops listening and resets the card on unmount', () => {
    mockMatchMedia({ finePointer: true, reducedMotion: false });
    const { getByTestId, rerender } = renderCards();
    const a = getByTestId('a');
    move(a, 200, 0);

    rerender(
      <>
        <div data-tilt data-testid="a" />
      </>
    );

    expect(a).not.toHaveAttribute('data-tilting');
    move(getByTestId('a'), 200, 0);
    expect(getByTestId('a')).not.toHaveAttribute('data-tilting');
  });

  it('renders nothing', () => {
    mockMatchMedia({ finePointer: true, reducedMotion: false });
    const { container } = render(<TiltController />);
    expect(container).toBeEmptyDOMElement();
  });
});
