import * as THREE from 'three';
import type { HeroSceneItem } from './hero-scene-layout';
import { createHeroScene } from './hero-scene';

// jsdom has no WebGL: swap the renderer and the texture loader for
// instrumented fakes and keep the rest of three.js real (geometries,
// materials, textures, raycasting), so disposal and picking are tested on the
// real objects.
const fakes = vi.hoisted(() => ({
  renderers: [] as Array<{
    domElement: HTMLCanvasElement;
    setPixelRatio: ReturnType<typeof vi.fn>;
    setClearColor: ReturnType<typeof vi.fn>;
    setAnimationLoop: ReturnType<typeof vi.fn>;
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
    capabilities = { getMaxAnisotropy: () => 16 };
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
});

const items: HeroSceneItem[] = [
  { id: 1, mediaType: 'movie', title: 'One', posterPath: '/one.jpg' },
  { id: 2, mediaType: 'tv', title: 'Two', posterPath: '/two.jpg' },
  { id: 3, mediaType: 'movie', title: 'Three', posterPath: '/three.jpg' },
  { id: 4, mediaType: 'movie', title: 'Four', posterPath: null },
  { id: 5, mediaType: 'tv', title: 'Five', posterPath: '/five.jpg' },
];

function setup(initialIndex = 0) {
  const container = document.createElement('div');
  document.body.append(container);
  const onPick = vi.fn();
  const onError = vi.fn();
  const scene = createHeroScene(container, items, {
    initialIndex,
    onPick,
    onError,
  });
  const renderer = fakes.renderers.at(-1)!;
  return { container, scene, renderer, onPick, onError };
}

const intersect = (isIntersecting: boolean) =>
  observerCallbacks.forEach((callback) =>
    callback(
      [{ isIntersecting } as IntersectionObserverEntry],
      {} as IntersectionObserver
    )
  );

// One simulated clock for every frame of a test, so time never goes back.
let now = 0;
beforeEach(() => {
  now = performance.now();
});

/** Runs the animation loop for a few (simulated) seconds. */
function runFrames(renderer: (typeof fakes.renderers)[number], frames = 60) {
  const tick = renderer.setAnimationLoop.mock.lastCall![0] as (
    t: number
  ) => void;
  for (let i = 0; i < frames; i++) tick((now += 50));
}

describe('createHeroScene', () => {
  it('appends a transparent, decorative canvas with a capped pixel ratio', () => {
    vi.stubGlobal('devicePixelRatio', 3);
    const { container, renderer } = setup();
    const canvas = renderer.domElement;

    expect(container).toContainElement(canvas);
    expect(canvas).toHaveAttribute('aria-hidden', 'true');
    expect(fakes.rendererOptions[0]).toMatchObject({
      alpha: true,
      antialias: false,
    });
    expect(renderer.setPixelRatio).toHaveBeenCalledWith(1.5);
    expect(renderer.setClearColor).toHaveBeenCalledWith(0x000000, 0);
    // Page scrolling keeps working over it.
    const wheel = new WheelEvent('wheel', { cancelable: true, bubbles: true });
    canvas.dispatchEvent(wheel);
    expect(wheel.defaultPrevented).toBe(false);
  });

  it('runs the loop only while on screen and the tab is visible', () => {
    const { renderer } = setup();
    expect(renderer.setAnimationLoop).not.toHaveBeenCalled();

    intersect(true);
    expect(renderer.setAnimationLoop).toHaveBeenLastCalledWith(
      expect.any(Function)
    );

    const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    document.dispatchEvent(new Event('visibilitychange'));
    expect(renderer.setAnimationLoop).toHaveBeenLastCalledWith(null);

    hidden.mockReturnValue(false);
    document.dispatchEvent(new Event('visibilitychange'));
    expect(renderer.setAnimationLoop).toHaveBeenLastCalledWith(
      expect.any(Function)
    );

    intersect(false);
    expect(renderer.setAnimationLoop).toHaveBeenLastCalledWith(null);
  });

  it('loads w342 posters cross-origin from a separate cache key, nearest to the selection first', () => {
    const { renderer } = setup(4);

    expect(fakes.loads.map((load) => load.url)).toEqual([
      // A cache key of their own: never the no-cors copy an <img> cached.
      'https://image.tmdb.org/t/p/w342/five.jpg?cors=1',
      'https://image.tmdb.org/t/p/w342/one.jpg?cors=1',
      'https://image.tmdb.org/t/p/w342/two.jpg?cors=1',
      'https://image.tmdb.org/t/p/w342/three.jpg?cors=1',
    ]);
    expect(fakes.loads.every((l) => l.crossOrigin === 'anonymous')).toBe(true);
    // The title without a poster is not requested at all.
    expect(renderer.domElement).toHaveAttribute('data-textures-total', '4');

    const texture = new THREE.Texture();
    fakes.loads[0].onLoad(texture);
    expect(texture.colorSpace).toBe(THREE.SRGBColorSpace);
    expect(texture.anisotropy).toBe(4);
    expect(renderer.domElement).toHaveAttribute('data-textures-loaded', '1');
  });

  it('retries a failed poster once, then logs once and keeps a placeholder', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { onError } = setup();

    fakes.loads[0].onError(new Event('error'));
    expect(fakes.loads).toHaveLength(5);
    expect(fakes.loads[4].url).toBe(fakes.loads[0].url);

    fakes.loads[4].onError(new Event('error'));
    fakes.loads[1].onError(new Event('error'));
    fakes.loads[5].onError(new Event('error'));

    // Exactly one retry per poster, one log per scene.
    expect(fakes.loads).toHaveLength(6);
    expect(error).toHaveBeenCalledTimes(1);
    expect(error.mock.calls[0][0]).toBe('[home]');
    // A missing poster is not a scene failure.
    expect(onError).not.toHaveBeenCalled();
  });

  it('follows the selection and ignores out-of-range indexes', () => {
    const { scene, renderer } = setup();
    const canvas = renderer.domElement;
    expect(canvas).toHaveAttribute('data-selected', '0');

    scene.select(3);
    expect(canvas).toHaveAttribute('data-selected', '3');
    scene.select(99);
    scene.select(-1);
    expect(canvas).toHaveAttribute('data-selected', '3');
  });

  it('reports a click on a visible poster and shows a pointer cursor', () => {
    const { renderer, onPick } = setup(1);
    const canvas = renderer.domElement;
    canvas.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 200, height: 100 }) as DOMRect;
    fakes.loads.forEach((load) => load.onLoad(new THREE.Texture()));
    intersect(true);
    runFrames(renderer);

    // The selected poster faces the camera in the middle of the canvas.
    canvas.dispatchEvent(
      new MouseEvent('pointermove', { clientX: 100, clientY: 50 })
    );
    runFrames(renderer, 2);
    expect(canvas.style.cursor).toBe('pointer');
    canvas.dispatchEvent(
      new MouseEvent('click', { clientX: 100, clientY: 50 })
    );
    expect(onPick).toHaveBeenCalledWith(1);

    // The top corner is empty space.
    canvas.dispatchEvent(new MouseEvent('click', { clientX: 1, clientY: 1 }));
    expect(onPick).toHaveBeenCalledTimes(1);
    canvas.dispatchEvent(new MouseEvent('pointerleave'));
    expect(canvas.style.cursor).toBe('');
  });

  it('ignores clicks on posters that have not faded in yet', () => {
    const { renderer, onPick } = setup();
    const canvas = renderer.domElement;
    canvas.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 200, height: 100 }) as DOMRect;

    canvas.dispatchEvent(
      new MouseEvent('click', { clientX: 100, clientY: 50 })
    );
    expect(onPick).not.toHaveBeenCalled();
  });

  it('releases every geometry, material, texture and the renderer on dispose', () => {
    const geometryDispose = vi.spyOn(THREE.BufferGeometry.prototype, 'dispose');
    const materialDispose = vi.spyOn(THREE.Material.prototype, 'dispose');
    const textureDispose = vi.spyOn(THREE.Texture.prototype, 'dispose');
    const removeListener = vi.spyOn(window, 'removeEventListener');
    const { scene, renderer, container } = setup();
    fakes.loads[0].onLoad(new THREE.Texture());
    fakes.loads[1].onLoad(new THREE.Texture());
    intersect(true);

    scene.dispose();

    // The shared poster geometry + the glow plane.
    expect(geometryDispose).toHaveBeenCalledTimes(2);
    // One material per poster, per drift copy, + the glow.
    expect(materialDispose).toHaveBeenCalledTimes(items.length + 14 + 1);
    expect(textureDispose).toHaveBeenCalledTimes(2);
    expect(removeListener).toHaveBeenCalledWith(
      'pointermove',
      expect.any(Function)
    );
    expect(renderer.setAnimationLoop).toHaveBeenLastCalledWith(null);
    expect(renderer.dispose).toHaveBeenCalledTimes(1);
    expect(renderer.forceContextLoss).toHaveBeenCalledTimes(1);
    expect(container).not.toContainElement(renderer.domElement);
  });

  it('disposes a texture that arrives after dispose and does not retry', () => {
    const { scene } = setup();
    scene.dispose();
    const late = new THREE.Texture();
    const lateDispose = vi.spyOn(late, 'dispose');

    fakes.loads[0].onLoad(late);
    fakes.loads[1].onError(new Event('error'));

    expect(lateDispose).toHaveBeenCalledTimes(1);
    expect(fakes.loads).toHaveLength(4);
  });

  it('is safe to dispose twice and to call after dispose', () => {
    const { scene, renderer } = setup();
    scene.dispose();
    expect(() => {
      scene.dispose();
      scene.select(2);
      scene.setScrollProgress(0.5);
    }).not.toThrow();
    expect(renderer.dispose).toHaveBeenCalledTimes(1);
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

  it('keeps rendering while scrolled and parallaxed', () => {
    const { scene, renderer } = setup();
    intersect(true);
    scene.setScrollProgress(2);
    window.dispatchEvent(
      new PointerEvent('pointermove', { clientX: 10, clientY: 10 })
    );
    expect(() => runFrames(renderer)).not.toThrow();
    expect(renderer.render).toHaveBeenCalled();
  });
});
