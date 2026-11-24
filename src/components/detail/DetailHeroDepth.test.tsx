import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { DetailHeroDepth } from './DetailHeroDepth';

let frames: Array<() => void>;

function stubEnv({
  hover = true,
  reducedMotion = false,
}: { hover?: boolean; reducedMotion?: boolean } = {}) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches:
      (query === '(hover: hover) and (pointer: fine)' && hover) ||
      (query === '(prefers-reduced-motion: reduce)' && reducedMotion),
  }));
}

beforeEach(() => {
  frames = [];
  vi.stubGlobal('requestAnimationFrame', (callback: () => void) => {
    frames.push(callback);
    return frames.length;
  });
  vi.stubGlobal('cancelAnimationFrame', () => {});
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/** Runs queued animation frames until none is left (or a cap). */
function flushFrames(max = 200) {
  for (let i = 0; i < max && frames.length > 0; i++) frames.shift()!();
}

function renderHero() {
  render(
    <DetailHeroDepth className="hero">
      <p>Content</p>
    </DetailHeroDepth>
  );
  const root = screen.getByText('Content').parentElement!;
  root.getBoundingClientRect = () =>
    ({ left: 0, top: 0, width: 400, height: 200 }) as DOMRect;
  return root;
}

const vars = (root: HTMLElement) => ({
  x: root.style.getPropertyValue('--depth-x'),
  y: root.style.getPropertyValue('--depth-y'),
  scroll: root.style.getPropertyValue('--depth-scroll'),
});

it('renders its children in a plain wrapper', () => {
  stubEnv();
  const root = renderHero();
  expect(root).toHaveClass('hero');
});

it('eases the layers towards the pointer and back when it leaves', () => {
  stubEnv();
  const root = renderHero();
  expect(root).toHaveAttribute('data-depth-active');

  fireEvent.pointerMove(root, { clientX: 400, clientY: 0 });
  frames.shift()!();
  // Part of the way after one frame...
  expect(Number(vars(root).x)).toBeGreaterThan(0);
  expect(Number(vars(root).x)).toBeLessThan(1);
  flushFrames();
  // ...all the way once settled, and the loop stops.
  expect(vars(root)).toMatchObject({ x: '1.0000', y: '-1.0000' });
  expect(frames).toHaveLength(0);

  fireEvent.pointerLeave(root);
  flushFrames();
  expect(vars(root)).toMatchObject({ x: '0.0000', y: '0.0000' });
});

it('follows the scroll position in pixels', () => {
  stubEnv();
  const root = renderHero();
  flushFrames();
  expect(vars(root).scroll).toBe('0');

  root.getBoundingClientRect = () =>
    ({ left: 0, top: -150, width: 400, height: 200 }) as DOMRect;
  fireEvent.scroll(window);
  flushFrames();
  expect(vars(root).scroll).toBe('150');
});

it.each([
  ['touch devices', { hover: false }],
  ['reduced motion', { reducedMotion: true }],
])('stays flat on %s', (_, env) => {
  stubEnv(env);
  const root = renderHero();
  fireEvent.pointerMove(root, { clientX: 400, clientY: 0 });
  fireEvent.scroll(window);
  flushFrames();
  expect(root).not.toHaveAttribute('data-depth-active');
  expect(vars(root)).toEqual({ x: '', y: '', scroll: '' });
});

it('cleans up on unmount', () => {
  stubEnv();
  const root = renderHero();
  flushFrames();
  cleanup();
  expect(root).not.toHaveAttribute('data-depth-active');
  expect(vars(root)).toEqual({ x: '', y: '', scroll: '' });
});
