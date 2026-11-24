import { act, cleanup, render, screen } from '@testing-library/react';
import type { MediaItem } from '@/lib/tmdb/types';
import { tvItem } from '../../../tests/fixtures/media';
import { HomeHero } from './HomeHero';
import { loadHero3D, type LoadedHero3D } from './load-hero-3d';

// The dynamic imports live in this module, so "three.js is never downloaded"
// is "the loader is never called".
vi.mock('./load-hero-3d', () => ({ loadHero3D: vi.fn() }));
vi.mock('@/components/media/HeroSlider', () => ({
  HeroSlider: () => <div data-testid="slideshow" />,
}));

const mockedLoad = vi.mocked(loadHero3D);
const items: MediaItem[] = [tvItem, { ...tvItem, id: 2, title: 'Second' }];

type Env = { finePointer: boolean; reducedMotion: boolean; webgl: boolean };
const DESKTOP: Env = { finePointer: true, reducedMotion: false, webgl: true };

let idleCallbacks: Array<() => void>;
let motionListeners: Array<() => void>;
let env: Env;
// Records each render of the fake 3D hero (a mock call, not a global write).
const hero3dRender = vi.fn<(props: { onFail: () => void }) => void>();
let hero3dThrows: boolean;

function FakeHero3D(props: { onFail: () => void }) {
  hero3dRender(props);
  if (hero3dThrows) throw new Error('render failed');
  return <div data-testid="hero-3d" />;
}

beforeEach(() => {
  idleCallbacks = [];
  motionListeners = [];
  hero3dRender.mockReset();
  hero3dThrows = false;
  env = { ...DESKTOP };
  vi.stubGlobal('matchMedia', (query: string) => ({
    get matches() {
      return (
        (query === '(pointer: fine)' && env.finePointer) ||
        (query === '(prefers-reduced-motion: reduce)' && env.reducedMotion)
      );
    },
    addEventListener: (_: string, listener: () => void) =>
      motionListeners.push(listener),
    removeEventListener: () => {},
  }));
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() =>
    env.webgl ? ({ getExtension: () => null } as never) : null
  );
  vi.spyOn(document, 'readyState', 'get').mockReturnValue('complete');
  vi.stubGlobal('requestIdleCallback', (callback: () => void) => {
    idleCallbacks.push(callback);
    return idleCallbacks.length;
  });
  vi.stubGlobal('cancelIdleCallback', () => {});
  mockedLoad.mockResolvedValue({
    Hero3D: FakeHero3D,
    createHeroScene: vi.fn(),
  } as unknown as LoadedHero3D);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  mockedLoad.mockReset();
});

async function runIdle() {
  await act(async () => {
    idleCallbacks.splice(0).forEach((callback) => callback());
  });
}

it('starts as the slideshow and swaps in the 3D hero once idle', async () => {
  render(<HomeHero items={items} />);
  expect(screen.getByTestId('slideshow')).toBeInTheDocument();
  expect(mockedLoad).not.toHaveBeenCalled();

  await runIdle();

  expect(mockedLoad).toHaveBeenCalledOnce();
  expect(screen.getByTestId('hero-3d')).toBeInTheDocument();
  expect(screen.queryByTestId('slideshow')).not.toBeInTheDocument();
});

it.each([
  ['a touch device', { ...DESKTOP, finePointer: false }],
  ['reduced motion', { ...DESKTOP, reducedMotion: true }],
  ['no WebGL2', { ...DESKTOP, webgl: false }],
])('keeps the slideshow and never loads three.js on %s', async (_, value) => {
  env = value;
  render(<HomeHero items={items} />);
  await runIdle();
  expect(mockedLoad).not.toHaveBeenCalled();
  expect(screen.getByTestId('slideshow')).toBeInTheDocument();
});

it('does not load anything without trending titles', async () => {
  render(<HomeHero items={[]} />);
  await runIdle();
  expect(mockedLoad).not.toHaveBeenCalled();
});

it('falls back to the slideshow when the 3D hero fails', async () => {
  render(<HomeHero items={items} />);
  await runIdle();
  act(() => hero3dRender.mock.lastCall![0].onFail());
  expect(screen.getByTestId('slideshow')).toBeInTheDocument();
  expect(screen.queryByTestId('hero-3d')).not.toBeInTheDocument();
});

it('falls back to the slideshow when the 3D hero crashes while rendering', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  hero3dThrows = true;
  render(<HomeHero items={items} />);
  await runIdle();
  expect(screen.getByTestId('slideshow')).toBeInTheDocument();
});

it('keeps the slideshow and logs when the chunk cannot be loaded', async () => {
  const error = vi.spyOn(console, 'error').mockImplementation(() => {});
  mockedLoad.mockRejectedValue(new Error('chunk failed'));
  render(<HomeHero items={items} />);
  await runIdle();
  expect(screen.getByTestId('slideshow')).toBeInTheDocument();
  expect(error).toHaveBeenCalledWith(
    '[hero-3d]',
    expect.any(String),
    expect.any(Error)
  );
});

it('drops the 3D hero when reduced motion is turned on', async () => {
  render(<HomeHero items={items} />);
  await runIdle();
  expect(screen.getByTestId('hero-3d')).toBeInTheDocument();

  env.reducedMotion = true;
  act(() => motionListeners.forEach((listener) => listener()));

  expect(screen.getByTestId('slideshow')).toBeInTheDocument();
});

it('ignores a chunk that arrives after unmount', async () => {
  let resolve: (value: LoadedHero3D) => void = () => {};
  mockedLoad.mockReturnValue(new Promise((r) => (resolve = r)));
  const { unmount } = render(<HomeHero items={items} />);
  await runIdle();
  unmount();
  await act(async () =>
    resolve({ Hero3D: FakeHero3D } as unknown as LoadedHero3D)
  );
  expect(hero3dRender).not.toHaveBeenCalled();
});
