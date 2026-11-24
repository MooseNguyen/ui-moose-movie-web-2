import { act, cleanup, render, screen } from '@testing-library/react';
import type { HeroSceneOptions } from './hero-scene';
import type { HeroSceneItem } from './hero-scene-layout';
import { loadHeroScene } from './load-hero-scene';
import { HeroStage } from './HeroStage';

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  api: null as null | FakeApi,
}));

type FakeApi = {
  selected: number;
  handlers: Map<string, Set<() => void>>;
  selectedScrollSnap: () => number;
  scrollTo: ReturnType<typeof vi.fn>;
  on: (event: string, handler: () => void) => void;
  off: (event: string, handler: () => void) => void;
  emit: (event: string) => void;
};

function createApi(selected = 0): FakeApi {
  const api: FakeApi = {
    selected,
    handlers: new Map(),
    selectedScrollSnap: () => api.selected,
    scrollTo: vi.fn(),
    on: (event, handler) => {
      if (!api.handlers.has(event)) api.handlers.set(event, new Set());
      api.handlers.get(event)!.add(handler);
    },
    off: (event, handler) => api.handlers.get(event)?.delete(handler),
    emit: (event) => api.handlers.get(event)?.forEach((h) => h()),
  };
  return api;
}

// The dynamic import() lives in this module, so "three.js is never
// downloaded" is "the loader is never called".
vi.mock('./load-hero-scene', () => ({ loadHeroScene: vi.fn() }));
vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ push: mocks.push }),
}));
vi.mock('@/components/ui/carousel', () => ({
  useCarousel: () => ({ api: mocks.api }),
}));

const mockedLoad = vi.mocked(loadHeroScene);

const items: HeroSceneItem[] = [
  { id: 1, mediaType: 'movie', title: 'One', posterPath: '/one.jpg' },
  { id: 2, mediaType: 'tv', title: 'Two', posterPath: '/two.jpg' },
  { id: 3, mediaType: 'movie', title: 'Three', posterPath: null },
];

type Env = {
  finePointer: boolean;
  reducedMotion: boolean;
  wide: boolean;
  webgl: boolean;
};
const DESKTOP: Env = {
  finePointer: true,
  reducedMotion: false,
  wide: true,
  webgl: true,
};

let idleCallbacks: Array<() => void>;
let reducedMotionListeners: Array<() => void>;
let scene: {
  select: ReturnType<typeof vi.fn>;
  setScrollProgress: ReturnType<typeof vi.fn>;
  dispose: ReturnType<typeof vi.fn>;
};
let createHeroScene: ReturnType<typeof vi.fn>;

function stubEnv(env: Env) {
  const current = { ...env };
  vi.stubGlobal('matchMedia', (query: string) => ({
    get matches() {
      return (
        (query === '(pointer: fine)' && current.finePointer) ||
        (query === '(prefers-reduced-motion: reduce)' &&
          current.reducedMotion) ||
        (query === '(min-width: 1024px)' && current.wide)
      );
    },
    media: query,
    addEventListener: (_: string, listener: () => void) => {
      if (query === '(prefers-reduced-motion: reduce)') {
        reducedMotionListeners.push(listener);
      }
    },
    removeEventListener: (_: string, listener: () => void) => {
      reducedMotionListeners = reducedMotionListeners.filter(
        (l) => l !== listener
      );
    },
  }));
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() =>
    current.webgl ? ({ getExtension: () => null } as never) : null
  );
  return current;
}

beforeEach(() => {
  idleCallbacks = [];
  reducedMotionListeners = [];
  mocks.api = createApi();
  vi.stubGlobal('requestIdleCallback', (callback: () => void) => {
    idleCallbacks.push(callback);
    return idleCallbacks.length;
  });
  vi.stubGlobal('cancelIdleCallback', () => {});
  scene = {
    select: vi.fn(),
    setScrollProgress: vi.fn(),
    dispose: vi.fn(),
  };
  createHeroScene = vi.fn(() => scene);
  mockedLoad.mockResolvedValue({ createHeroScene: createHeroScene as never });
});

afterEach(() => {
  // Unmount before the browser stubs go away (the effect cleanup uses them).
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  mockedLoad.mockReset();
  mocks.push.mockReset();
});

const renderStage = () => render(<HeroStage items={items} />);
const stage = () => screen.queryByTestId('hero-stage');

async function goIdle() {
  await act(async () => {
    idleCallbacks.splice(0).forEach((callback) => callback());
  });
}

async function renderReady() {
  const result = renderStage();
  await goIdle();
  const options = createHeroScene.mock.calls[0][2] as HeroSceneOptions;
  return { ...result, options };
}

describe('HeroStage', () => {
  it.each([
    ['a coarse pointer', { ...DESKTOP, finePointer: false }],
    ['reduced motion', { ...DESKTOP, reducedMotion: true }],
    ['a narrow viewport', { ...DESKTOP, wide: false }],
  ])('renders nothing and never loads three.js with %s', async (_, env) => {
    stubEnv(env);
    renderStage();
    await goIdle();

    expect(idleCallbacks).toHaveLength(0);
    expect(HTMLCanvasElement.prototype.getContext).not.toHaveBeenCalled();
    expect(mockedLoad).not.toHaveBeenCalled();
    expect(stage()).not.toBeInTheDocument();
  });

  it('renders nothing and never loads three.js without WebGL2', async () => {
    stubEnv({ ...DESKTOP, webgl: false });
    renderStage();
    await goIdle();

    expect(HTMLCanvasElement.prototype.getContext).toHaveBeenCalledWith(
      'webgl2'
    );
    expect(mockedLoad).not.toHaveBeenCalled();
    expect(stage()).not.toBeInTheDocument();
  });

  it('waits for the page load and idle before probing and loading', async () => {
    stubEnv(DESKTOP);
    const readyState = vi
      .spyOn(document, 'readyState', 'get')
      .mockReturnValue('interactive');
    renderStage();
    await goIdle();
    expect(stage()).not.toBeInTheDocument();
    expect(HTMLCanvasElement.prototype.getContext).not.toHaveBeenCalled();

    readyState.mockReturnValue('complete');
    await act(async () => {
      window.dispatchEvent(new Event('load'));
    });
    await goIdle();
    expect(mockedLoad).toHaveBeenCalledTimes(1);
  });

  it('fades in a decorative stage once the scene exists', async () => {
    stubEnv(DESKTOP);
    mocks.api = createApi(2);
    await renderReady();

    expect(createHeroScene).toHaveBeenCalledWith(
      screen.getByTestId('hero-stage-canvas'),
      items,
      expect.objectContaining({ initialIndex: 2 })
    );
    expect(stage()).toHaveAttribute('aria-hidden', 'true');
    expect(stage()).toHaveAttribute('data-hero-stage', 'ready');
    expect(stage()).toHaveClass('opacity-100');
  });

  it('turns the ring with the slider selection', async () => {
    stubEnv(DESKTOP);
    await renderReady();

    mocks.api!.selected = 1;
    act(() => mocks.api!.emit('select'));

    expect(scene.select).toHaveBeenLastCalledWith(1);
  });

  it('selects a clicked poster, and opens the one already selected', async () => {
    stubEnv(DESKTOP);
    const { options } = await renderReady();

    options.onPick(1);
    expect(mocks.api!.scrollTo).toHaveBeenCalledWith(1);
    expect(mocks.push).not.toHaveBeenCalled();

    options.onPick(0);
    expect(mocks.push).toHaveBeenCalledWith('/movie/1');
  });

  it('feeds the hero scroll progress to the scene', async () => {
    stubEnv(DESKTOP);
    await renderReady();
    stage()!.getBoundingClientRect = () =>
      ({ top: -300, height: 600 }) as DOMRect;

    await act(async () => {
      window.dispatchEvent(new Event('scroll'));
    });

    expect(scene.setScrollProgress).toHaveBeenLastCalledWith(0.5);
  });

  it('disposes the scene on unmount', async () => {
    stubEnv(DESKTOP);
    const { unmount } = await renderReady();
    unmount();
    expect(scene.dispose).toHaveBeenCalledTimes(1);
  });

  it('does not create the scene when unmounted while the chunk downloads', async () => {
    stubEnv(DESKTOP);
    let resolve!: (module: { createHeroScene: never }) => void;
    mockedLoad.mockReturnValue(new Promise((r) => (resolve = r)));
    const { unmount } = renderStage();
    await goIdle();

    unmount();
    await act(async () =>
      resolve({ createHeroScene: createHeroScene as never })
    );

    expect(createHeroScene).not.toHaveBeenCalled();
  });

  it('removes itself and logs once when the scene cannot start', async () => {
    stubEnv(DESKTOP);
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const failure = new Error('WebGL2 not available');
    createHeroScene.mockImplementation(() => {
      throw failure;
    });
    renderStage();
    await goIdle();

    expect(stage()).not.toBeInTheDocument();
    expect(error).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledWith(
      '[home]',
      'The 3D hero failed, showing the slider only:',
      failure
    );
  });

  it('removes itself when the chunk cannot be downloaded', async () => {
    stubEnv(DESKTOP);
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockedLoad.mockRejectedValue(new Error('ChunkLoadError'));
    renderStage();
    await goIdle();

    expect(stage()).not.toBeInTheDocument();
    expect(error).toHaveBeenCalledTimes(1);
  });

  it('disposes and removes the scene when WebGL fails later', async () => {
    stubEnv(DESKTOP);
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { options } = await renderReady();

    await act(async () => {
      options.onError(new Error('WebGL context lost'));
      options.onError(new Error('WebGL context lost'));
    });

    expect(scene.dispose).toHaveBeenCalledTimes(1);
    expect(stage()).not.toBeInTheDocument();
    expect(error).toHaveBeenCalledTimes(1);
  });

  it('removes the scene when the user turns on reduced motion', async () => {
    const env = stubEnv(DESKTOP);
    await renderReady();

    env.reducedMotion = true;
    await act(async () => {
      reducedMotionListeners.forEach((listener) => listener());
    });

    expect(scene.dispose).toHaveBeenCalledTimes(1);
    expect(stage()).not.toBeInTheDocument();
  });
});
