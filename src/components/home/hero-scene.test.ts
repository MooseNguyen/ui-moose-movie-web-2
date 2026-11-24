import * as THREE from 'three';
import type { HeroSceneItem } from './hero-3d-utils';
import { createHeroScene } from './hero-scene';

// jsdom has no WebGL: swap the renderer and the texture loader for
// instrumented fakes and keep the rest of three.js real (geometries,
// materials, textures, raycasting), so disposal and picking are tested on the
// real objects.
const fakes = vi.hoisted(() => ({
  renderers: [] as Array<{
    domElement: HTMLCanvasElement;
    setAnimationLoop: ReturnType<typeof vi.fn>;
    setPixelRatio: ReturnType<typeof vi.fn>;
    render: ReturnType<typeof vi.fn>;
    dispose: ReturnType<typeof vi.fn>;
    forceContextLoss: ReturnType<typeof vi.fn>;
  }>,
  rendererOptions: [] as unknown[],
  loads: [] as Array<{
    url: string;
    crossOrigin: string;
    onLoad: (texture: unknown) => void;
    onError: (error: unknown) => void;
  }>,
}));

vi.mock('three', async (importOriginal) => {
  const actual = await importOriginal<typeof import('three')>();
  class FakeRenderer {
    domElement = document.createElement('canvas');
    capabilities = { getMaxAnisotropy: () => 4 };
    setPixelRatio = vi.fn();
    setSize = vi.fn();
    setClearColor = vi.fn();
    setAnimationLoop = vi.fn();
    render = vi.fn();
    dispose = vi.fn();
    forceContextLoss = vi.fn();
    constructor(options: unknown) {
      fakes.renderers.push(this);
      fakes.rendererOptions.push(options);
    }
  }
  class FakeTextureLoader {
    crossOrigin = 'anonymous';
    setCrossOrigin(value: string) {
      this.crossOrigin = value;
      return this;
    }
    load(
      url: string,
      onLoad: (texture: unknown) => void,
      _onProgress: unknown,
      onError: (error: unknown) => void
    ) {
      fakes.loads.push({ url, crossOrigin: this.crossOrigin, onLoad, onError });
      return new actual.Texture();
    }
  }
  return {
    ...actual,
    WebGLRenderer: FakeRenderer,
    TextureLoader: FakeTextureLoader,
  };
});

let observerCallbacks: IntersectionObserverCallback[] = [];

beforeEach(() => {
  fakes.renderers.length = 0;
  fakes.rendererOptions.length = 0;
  fakes.loads.length = 0;
  observerCallbacks = [];
  // No 2D canvas either (as in jsdom without a canvas package, but silent):
  // the scene skips its rounded-corner and glow maps.
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(callback: IntersectionObserverCallback) {
        observerCallbacks.push(callback);
      }
      observe() {}
      disconnect() {}
    }
  );
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    }
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

const items: HeroSceneItem[] = [
  { id: 1, posterPath: '/one.jpg' },
  { id: 2, posterPath: '/two.jpg' },
  { id: 3, posterPath: null },
];

function setup(sceneItems = items) {
  const region = document.createElement('div');
  const container = document.createElement('div');
  region.append(container);
  document.body.append(region);
  const onPick = vi.fn();
  const onReady = vi.fn();
  const onError = vi.fn();
  const scene = createHeroScene(container, sceneItems, {
    initialIndex: 0,
    pointerTarget: region,
    onPick,
    onReady,
    onError,
  });
  const renderer = fakes.renderers.at(-1)!;
  return { region, container, scene, renderer, onPick, onReady, onError };
}

const intersect = (isIntersecting: boolean) =>
  observerCallbacks.forEach((callback) =>
    callback(
      [{ isIntersecting } as IntersectionObserverEntry],
      {} as IntersectionObserver
    )
  );

/** Starts the loop and returns a function that renders `frames` frames. */
function runner(renderer: (typeof fakes.renderers)[number]) {
  intersect(true);
  const tick = renderer.setAnimationLoop.mock.lastCall![0] as (
    t: number
  ) => void;
  let now = performance.now();
  return (frames: number) => {
    for (let i = 0; i < frames; i++) tick((now += 100));
  };
}

describe('createHeroScene', () => {
  it('appends a transparent, decorative canvas that does not block scrolling', () => {
    const { container, renderer } = setup();
    const canvas = renderer.domElement;

    expect(container).toContainElement(canvas);
    expect(canvas).toHaveAttribute('aria-hidden', 'true');
    expect(fakes.rendererOptions[0]).toMatchObject({ alpha: true });
    const wheel = new WheelEvent('wheel', { cancelable: true, bubbles: true });
    canvas.dispatchEvent(wheel);
    expect(wheel.defaultPrevented).toBe(false);
  });

  it('caps the pixel ratio', () => {
    vi.stubGlobal('devicePixelRatio', 3);
    const { renderer } = setup();
    expect(renderer.setPixelRatio).toHaveBeenCalledWith(1.75);
  });

  it('runs the loop only while on screen and the tab is visible', () => {
    const { renderer } = setup();

    intersect(true);
    expect(renderer.setAnimationLoop).toHaveBeenLastCalledWith(
      expect.any(Function)
    );
    intersect(false);
    expect(renderer.setAnimationLoop).toHaveBeenLastCalledWith(null);

    intersect(true);
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    document.dispatchEvent(new Event('visibilitychange'));
    expect(renderer.setAnimationLoop).toHaveBeenLastCalledWith(null);
  });

  it('loads w342 posters cross-origin from a separate cache key as sRGB textures', () => {
    setup();

    // The poster-less item keeps its placeholder and is never requested.
    expect(fakes.loads.map((load) => load.url)).toEqual([
      'https://image.tmdb.org/t/p/w342/one.jpg?cors=1',
      'https://image.tmdb.org/t/p/w342/two.jpg?cors=1',
    ]);
    expect(fakes.loads.every((l) => l.crossOrigin === 'anonymous')).toBe(true);
    const texture = new THREE.Texture();
    fakes.loads[0].onLoad(texture);
    expect(texture.colorSpace).toBe(THREE.SRGBColorSpace);
  });

  it('is ready once every poster has loaded or failed', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { renderer, onReady } = setup();
    const canvas = renderer.domElement;
    expect(canvas).toHaveAttribute('data-textures-total', '3');

    fakes.loads[0].onLoad(new THREE.Texture());
    expect(onReady).not.toHaveBeenCalled();
    fakes.loads[1].onError(new Event('error'));
    // Retried once first.
    expect(fakes.loads).toHaveLength(3);
    fakes.loads[2].onError(new Event('error'));

    expect(onReady).toHaveBeenCalledOnce();
    expect(canvas).toHaveAttribute('data-textures-loaded', '1');
  });

  it('logs failed posters once with a prefix and does not fail the scene', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { onError } = setup();
    fakes.loads[0].onError(new Event('error'));
    fakes.loads[1].onError(new Event('error'));
    fakes.loads[2].onError(new Event('error'));
    fakes.loads[3].onError(new Event('error'));

    expect(fakes.loads).toHaveLength(4);
    expect(error).toHaveBeenCalledOnce();
    expect(error.mock.calls[0][0]).toBe('[hero-3d]');
    expect(onError).not.toHaveBeenCalled();
  });

  it('releases every GPU resource and the context on dispose', () => {
    const geometryDispose = vi.spyOn(THREE.BufferGeometry.prototype, 'dispose');
    const materialDispose = vi.spyOn(THREE.Material.prototype, 'dispose');
    const textureDispose = vi.spyOn(THREE.Texture.prototype, 'dispose');
    const { scene, renderer, container } = setup();
    fakes.loads[0].onLoad(new THREE.Texture());
    fakes.loads[1].onLoad(new THREE.Texture());
    intersect(true);

    scene.dispose();

    // Card plane, glow plane, particles.
    expect(geometryDispose).toHaveBeenCalledTimes(3);
    // One material per card, the glow and the particles.
    expect(materialDispose).toHaveBeenCalledTimes(items.length + 2);
    // The two posters (jsdom has no 2D canvas, so no alpha/glow maps).
    expect(textureDispose).toHaveBeenCalledTimes(2);
    expect(renderer.setAnimationLoop).toHaveBeenLastCalledWith(null);
    expect(renderer.dispose).toHaveBeenCalledOnce();
    expect(renderer.forceContextLoss).toHaveBeenCalledOnce();
    expect(container).not.toContainElement(renderer.domElement);
  });

  it('disposes a texture that arrives after dispose and never retries', () => {
    const { scene } = setup();
    scene.dispose();
    const late = new THREE.Texture();
    const lateDispose = vi.spyOn(late, 'dispose');
    fakes.loads[0].onLoad(late);
    fakes.loads[1].onError(new Event('error'));

    expect(lateDispose).toHaveBeenCalledOnce();
    expect(fakes.loads).toHaveLength(2);
  });

  it('is safe to use after dispose and to dispose twice', () => {
    const { scene, renderer } = setup();
    scene.dispose();
    expect(() => {
      scene.dispose();
      scene.select(2);
      scene.setScrollProgress(0.5);
    }).not.toThrow();
    expect(renderer.dispose).toHaveBeenCalledOnce();
  });

  it('picks the front card under the pointer and shows a pointer cursor', () => {
    const { renderer, onPick } = setup();
    const canvas = renderer.domElement;
    canvas.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 200, height: 200 }) as DOMRect;
    runner(renderer)(30);

    canvas.dispatchEvent(
      new MouseEvent('pointermove', { clientX: 100, clientY: 100 })
    );
    expect(canvas.style.cursor).toBe('pointer');
    canvas.dispatchEvent(
      new MouseEvent('click', { clientX: 100, clientY: 100 })
    );
    expect(onPick).toHaveBeenCalledWith(0);

    // A corner is empty space.
    canvas.dispatchEvent(
      new MouseEvent('pointermove', { clientX: 1, clientY: 1 })
    );
    expect(canvas.style.cursor).toBe('');
    canvas.dispatchEvent(new MouseEvent('click', { clientX: 1, clientY: 1 }));
    expect(onPick).toHaveBeenCalledOnce();
  });

  it('turns the selected card to the front', () => {
    const { scene, renderer, onPick } = setup();
    const canvas = renderer.domElement;
    canvas.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 200, height: 200 }) as DOMRect;
    const run = runner(renderer);

    scene.select(2);
    run(40);
    canvas.dispatchEvent(
      new MouseEvent('click', { clientX: 100, clientY: 100 })
    );
    expect(onPick).toHaveBeenLastCalledWith(2);
  });

  it('reports a lost WebGL context, but not the one it causes on dispose', () => {
    const first = setup();
    first.renderer.domElement.dispatchEvent(new Event('webglcontextlost'));
    expect(first.onError).toHaveBeenCalledWith(expect.any(Error));

    const second = setup();
    second.renderer.forceContextLoss.mockImplementation(() =>
      second.renderer.domElement.dispatchEvent(new Event('webglcontextlost'))
    );
    second.scene.dispose();
    expect(second.onError).not.toHaveBeenCalled();
  });

  it('renders an empty scene without posters', () => {
    const { renderer, onReady } = setup([]);
    expect(onReady).toHaveBeenCalledOnce();
    expect(() => runner(renderer)(2)).not.toThrow();
  });
});
