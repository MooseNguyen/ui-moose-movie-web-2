import { act, cleanup, render, screen } from '@testing-library/react';
import type { PosterWallOptions } from './poster-wall-scene';
import type { WallItem } from './poster-wall-utils';
import { loadPosterWallScene } from './load-poster-wall-scene';
import { PosterWallEnhancer } from './PosterWallEnhancer';

const mocks = vi.hoisted(() => ({ push: vi.fn() }));

// The dynamic import() lives in this module, so "three.js is never
// downloaded" is "the loader is never called".
vi.mock('./load-poster-wall-scene', () => ({ loadPosterWallScene: vi.fn() }));
vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ push: mocks.push }),
}));

const mockedLoad = vi.mocked(loadPosterWallScene);

const items: WallItem[] = [
  { id: 1, mediaType: 'movie', title: 'One', posterPath: '/one.jpg' },
  { id: 2, mediaType: 'tv', title: 'Two', posterPath: '/two.jpg' },
];

type Env = { finePointer: boolean; reducedMotion: boolean; webgl: boolean };
const DESKTOP: Env = { finePointer: true, reducedMotion: false, webgl: true };

let observers: Array<{
  callback: IntersectionObserverCallback;
  options?: IntersectionObserverInit;
  disconnected: boolean;
}>;
let idleCallbacks: Array<() => void>;
let wall: {
  setProgress: ReturnType<typeof vi.fn>;
  setBackground: ReturnType<typeof vi.fn>;
  dispose: ReturnType<typeof vi.fn>;
};
let createPosterWall: ReturnType<typeof vi.fn>;

function stubEnv({ finePointer, reducedMotion, webgl }: Env) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches:
      (query === '(pointer: fine)' && finePointer) ||
      (query === '(prefers-reduced-motion: reduce)' && reducedMotion),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() =>
    webgl ? ({ getExtension: () => null } as never) : null
  );
}

beforeEach(() => {
  observers = [];
  idleCallbacks = [];
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      entry: (typeof observers)[number];
      constructor(
        callback: IntersectionObserverCallback,
        options?: IntersectionObserverInit
      ) {
        this.entry = { callback, options, disconnected: false };
        observers.push(this.entry);
      }
      observe() {}
      disconnect() {
        this.entry.disconnected = true;
      }
    }
  );
  vi.stubGlobal('requestIdleCallback', (callback: () => void) => {
    idleCallbacks.push(callback);
    return idleCallbacks.length;
  });
  vi.stubGlobal('cancelIdleCallback', () => {});
  wall = { setProgress: vi.fn(), setBackground: vi.fn(), dispose: vi.fn() };
  createPosterWall = vi.fn(() => wall);
  mockedLoad.mockResolvedValue({
    createPosterWall: createPosterWall as never,
  });
});

afterEach(() => {
  // Unmount before the browser stubs go away (the effect cleanup uses them).
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  mockedLoad.mockReset();
  mocks.push.mockReset();
});

function renderEnhancer() {
  return render(
    <PosterWallEnhancer items={items}>
      <a href="#one">One</a>
    </PosterWallEnhancer>
  );
}

const fallback = () => screen.getByTestId('poster-wall-fallback');

/** Section near the viewport, then the browser goes idle. */
async function approachAndIdle() {
  await act(async () => {
    for (const o of observers) {
      if (!o.disconnected) {
        o.callback(
          [{ isIntersecting: true } as IntersectionObserverEntry],
          {} as IntersectionObserver
        );
      }
    }
    idleCallbacks.splice(0).forEach((callback) => callback());
  });
}

describe('PosterWallEnhancer', () => {
  it.each([
    ['a coarse pointer', { ...DESKTOP, finePointer: false }],
    ['reduced motion', { ...DESKTOP, reducedMotion: true }],
  ])('never loads the 3D scene with %s', async (_, env) => {
    stubEnv(env);
    renderEnhancer();
    await approachAndIdle();

    expect(mockedLoad).not.toHaveBeenCalled();
    expect(fallback()).toHaveAttribute('data-scene', 'off');
    expect(screen.getByRole('link', { name: 'One' })).toBeInTheDocument();
  });

  it('collapses the track and never loads the scene without WebGL2', async () => {
    stubEnv({ ...DESKTOP, webgl: false });
    renderEnhancer();
    await approachAndIdle();

    expect(mockedLoad).not.toHaveBeenCalled();
    expect(fallback()).toHaveAttribute('data-scene', 'unsupported');
    expect(screen.getByTestId('poster-wall-track')).toHaveAttribute(
      'data-collapsed',
      'true'
    );
    expect(screen.queryByTestId('poster-wall-canvas')).not.toBeInTheDocument();
  });

  it('probes WebGL only once near the viewport and idle', async () => {
    stubEnv(DESKTOP);
    renderEnhancer();
    expect(HTMLCanvasElement.prototype.getContext).not.toHaveBeenCalled();

    await approachAndIdle();

    expect(HTMLCanvasElement.prototype.getContext).toHaveBeenCalledWith(
      'webgl2'
    );
  });

  it('keeps the carousel readable when keyboard focus reveals it', async () => {
    stubEnv(DESKTOP);
    renderEnhancer();
    await approachAndIdle();

    // Opaque surface over the canvas, shown on focus-within.
    expect(fallback()).toHaveClass(
      'immersive:bg-background',
      'immersive:opacity-0',
      'immersive:focus-within:opacity-100'
    );
  });

  it('neither observes nor probes WebGL on touch devices', async () => {
    stubEnv({ ...DESKTOP, finePointer: false });
    renderEnhancer();
    await approachAndIdle();
    expect(observers).toHaveLength(0);
    expect(HTMLCanvasElement.prototype.getContext).not.toHaveBeenCalled();
  });

  it('waits until the section is near the viewport and the browser is idle', async () => {
    stubEnv(DESKTOP);
    renderEnhancer();

    expect(observers).toHaveLength(1);
    expect(observers[0].options?.rootMargin).toBe('50% 0px');
    expect(idleCallbacks).toHaveLength(0);
    expect(mockedLoad).not.toHaveBeenCalled();

    await approachAndIdle();

    expect(mockedLoad).toHaveBeenCalledTimes(1);
    expect(createPosterWall).toHaveBeenCalledWith(
      screen.getByTestId('poster-wall-canvas'),
      items,
      expect.objectContaining({ reducedMotion: false })
    );
    expect(fallback()).toHaveAttribute('data-scene', 'ready');
    // Still in the accessibility tree and focusable.
    expect(screen.getByRole('link', { name: 'One' })).toBeInTheDocument();
    expect(screen.getByTestId('poster-wall-canvas')).toHaveAttribute(
      'aria-hidden',
      'true'
    );
  });

  it('waits for the page load (the LCP hero image) before going idle', async () => {
    stubEnv(DESKTOP);
    const readyState = vi
      .spyOn(document, 'readyState', 'get')
      .mockReturnValue('interactive');
    renderEnhancer();

    await approachAndIdle();
    expect(idleCallbacks).toHaveLength(0);
    expect(mockedLoad).not.toHaveBeenCalled();

    readyState.mockReturnValue('complete');
    await act(async () => {
      window.dispatchEvent(new Event('load'));
      idleCallbacks.splice(0).forEach((callback) => callback());
    });
    expect(mockedLoad).toHaveBeenCalledTimes(1);
  });

  it('does not wait for a load event after unmount', async () => {
    stubEnv(DESKTOP);
    vi.spyOn(document, 'readyState', 'get').mockReturnValue('interactive');
    const { unmount } = renderEnhancer();
    await approachAndIdle();

    unmount();
    window.dispatchEvent(new Event('load'));

    expect(idleCallbacks).toHaveLength(0);
  });

  it('gives the scene the page background and follows theme changes', async () => {
    stubEnv(DESKTOP);
    document.body.style.backgroundColor = 'rgb(10, 10, 10)';
    renderEnhancer();
    await approachAndIdle();

    expect(createPosterWall).toHaveBeenCalledWith(
      expect.anything(),
      items,
      expect.objectContaining({ background: 'rgb(10, 10, 10)' })
    );

    // What useTheme does on toggle: swap the class on <html>.
    document.body.style.backgroundColor = 'rgb(255, 255, 255)';
    await act(async () => {
      document.documentElement.classList.add('light');
      // MutationObserver callbacks run as microtasks.
      await Promise.resolve();
    });
    expect(wall.setBackground).toHaveBeenLastCalledWith('rgb(255, 255, 255)');
    expect(createPosterWall).toHaveBeenCalledTimes(1);

    document.documentElement.classList.remove('light');
    document.body.style.backgroundColor = '';
  });

  it('stops following the theme after unmount', async () => {
    stubEnv(DESKTOP);
    const { unmount } = renderEnhancer();
    await approachAndIdle();
    unmount();

    await act(async () => {
      document.documentElement.classList.add('light');
      await Promise.resolve();
    });
    expect(wall.setBackground).not.toHaveBeenCalled();
    document.documentElement.classList.remove('light');
  });

  it('opens the detail page of the selected poster', async () => {
    stubEnv(DESKTOP);
    renderEnhancer();
    await approachAndIdle();

    const { onSelect } = createPosterWall.mock.calls[0][2] as PosterWallOptions;
    onSelect(items[1]);

    expect(mocks.push).toHaveBeenCalledWith('/tv/2');
  });

  it('feeds the scroll progress through the track to the scene', async () => {
    stubEnv(DESKTOP);
    renderEnhancer();
    await approachAndIdle();
    const track = screen.getByTestId('poster-wall-track');
    track.getBoundingClientRect = () =>
      ({ top: -384, height: 1536 }) as DOMRect;
    vi.stubGlobal('innerHeight', 768);

    await act(async () => {
      window.dispatchEvent(new Event('scroll'));
    });

    expect(wall.setProgress).toHaveBeenLastCalledWith(0.5);

    // A taller window changes the progress without any scrolling.
    vi.stubGlobal('innerHeight', 1152);
    await act(async () => {
      window.dispatchEvent(new Event('resize'));
    });
    expect(wall.setProgress).toHaveBeenLastCalledWith(1);
  });

  it('disposes the scene on unmount', async () => {
    stubEnv(DESKTOP);
    const { unmount } = renderEnhancer();
    await approachAndIdle();

    unmount();

    expect(wall.dispose).toHaveBeenCalledTimes(1);
  });

  it('does not create the scene when unmounted while the chunk downloads', async () => {
    stubEnv(DESKTOP);
    let resolve!: (module: { createPosterWall: never }) => void;
    mockedLoad.mockReturnValue(new Promise((r) => (resolve = r)));
    const { unmount } = renderEnhancer();
    await approachAndIdle();

    unmount();
    await act(async () =>
      resolve({ createPosterWall: createPosterWall as never })
    );

    expect(createPosterWall).not.toHaveBeenCalled();
  });

  it('falls back to the grid and logs once when the scene cannot start', async () => {
    stubEnv(DESKTOP);
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const failure = new Error('WebGL2 not available');
    createPosterWall.mockImplementation(() => {
      throw failure;
    });
    renderEnhancer();
    await approachAndIdle();

    expect(fallback()).toHaveAttribute('data-scene', 'failed');
    expect(screen.queryByTestId('poster-wall-canvas')).not.toBeInTheDocument();
    // No empty sticky stage is left behind.
    expect(screen.getByTestId('poster-wall-track')).toHaveAttribute(
      'data-collapsed',
      'true'
    );
    expect(fallback()).not.toHaveClass('immersive:-mt-[calc(100vh-4rem)]');
    expect(error).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledWith(
      '[poster-wall]',
      'The 3D wall failed, showing the carousel instead:',
      failure
    );
  });

  it('falls back when the chunk cannot be downloaded', async () => {
    stubEnv(DESKTOP);
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockedLoad.mockRejectedValue(new Error('ChunkLoadError'));
    renderEnhancer();
    await approachAndIdle();

    expect(fallback()).toHaveAttribute('data-scene', 'failed');
    expect(error).toHaveBeenCalledTimes(1);
  });

  it('removes the scene and shows the grid when WebGL fails later', async () => {
    stubEnv(DESKTOP);
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    renderEnhancer();
    await approachAndIdle();
    const { onError } = createPosterWall.mock.calls[0][2] as PosterWallOptions;

    await act(async () => {
      onError?.(new Error('WebGL context lost'));
      onError?.(new Error('WebGL context lost'));
    });

    expect(wall.dispose).toHaveBeenCalledTimes(1);
    expect(fallback()).toHaveAttribute('data-scene', 'failed');
    expect(screen.queryByTestId('poster-wall-canvas')).not.toBeInTheDocument();
    expect(error).toHaveBeenCalledTimes(1);
  });
});
