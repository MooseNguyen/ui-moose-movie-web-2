import * as THREE from 'three';
import type { WallItem } from './poster-wall-utils';
import { createPosterWall } from './poster-wall-scene';

// jsdom has no WebGL: swap the renderer and the texture loader for
// instrumented fakes and keep the rest of three.js real (geometries,
// materials, textures, raycasting), so disposal and picking are tested on the
// real objects.
const fakes = vi.hoisted(() => ({
  renderers: [] as Array<{
    domElement: HTMLCanvasElement;
    clearColors: string[];
    setAnimationLoop: ReturnType<typeof vi.fn>;
    dispose: ReturnType<typeof vi.fn>;
    forceContextLoss: ReturnType<typeof vi.fn>;
  }>,
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
    setPixelRatio = vi.fn();
    setSize = vi.fn();
    // Copies the colour, like the real renderer does.
    clearColors: string[] = [];
    setClearColor = vi.fn((color: { getHexString: () => string }) =>
      this.clearColors.push(color.getHexString())
    );
    setAnimationLoop = vi.fn();
    render = vi.fn();
    dispose = vi.fn();
    forceContextLoss = vi.fn();
    constructor() {
      fakes.renderers.push(this);
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

const items: WallItem[] = [
  { id: 1, mediaType: 'movie', title: 'One', posterPath: '/one.jpg' },
  { id: 2, mediaType: 'tv', title: 'Two', posterPath: '/two.jpg' },
  { id: 3, mediaType: 'movie', title: 'Three', posterPath: '/three.jpg' },
];

function setup(
  wallItems = items,
  background = 'rgb(10, 10, 10)',
  reducedMotion = false
) {
  const container = document.createElement('div');
  document.body.append(container);
  const onSelect = vi.fn();
  const onError = vi.fn();
  const wall = createPosterWall(container, wallItems, {
    onSelect,
    onError,
    reducedMotion,
    background,
  });
  const renderer = fakes.renderers.at(-1)!;
  return { container, wall, renderer, onSelect, onError };
}

const intersect = (isIntersecting: boolean) =>
  observerCallbacks.forEach((callback) =>
    callback(
      [{ isIntersecting } as IntersectionObserverEntry],
      {} as IntersectionObserver
    )
  );

describe('createPosterWall', () => {
  it('appends a decorative canvas that does not block page scrolling', () => {
    const { container, renderer } = setup();
    const canvas = renderer.domElement;

    expect(container).toContainElement(canvas);
    expect(canvas).toHaveAttribute('aria-hidden', 'true');
    const wheel = new WheelEvent('wheel', { cancelable: true, bubbles: true });
    canvas.dispatchEvent(wheel);
    expect(wheel.defaultPrevented).toBe(false);
  });

  it('runs the loop only while the stage is on screen', () => {
    const { renderer } = setup();

    intersect(true);
    expect(renderer.setAnimationLoop).toHaveBeenLastCalledWith(
      expect.any(Function)
    );
    intersect(false);
    expect(renderer.setAnimationLoop).toHaveBeenLastCalledWith(null);
  });

  it('loads w342 posters cross-origin as sRGB textures', () => {
    setup();

    expect(fakes.loads.map((load) => load.url)).toEqual([
      'https://image.tmdb.org/t/p/w342/one.jpg',
      'https://image.tmdb.org/t/p/w342/two.jpg',
      'https://image.tmdb.org/t/p/w342/three.jpg',
    ]);
    expect(fakes.loads.every((l) => l.crossOrigin === 'anonymous')).toBe(true);
    const texture = new THREE.Texture();
    fakes.loads[0].onLoad(texture);
    expect(texture.colorSpace).toBe(THREE.SRGBColorSpace);
  });

  it('retries a failed poster once with a cache-separated URL', () => {
    const { renderer } = setup();
    const canvas = renderer.domElement;
    expect(canvas).toHaveAttribute('data-textures-total', '3');
    expect(canvas).toHaveAttribute('data-textures-loaded', '0');

    // e.g. a cached no-cors copy without Access-Control-Allow-Origin.
    fakes.loads[0].onError(new Event('error'));

    expect(fakes.loads).toHaveLength(4);
    expect(fakes.loads[3].url).toBe(
      'https://image.tmdb.org/t/p/w342/one.jpg?cors=1'
    );
    expect(fakes.loads[3].crossOrigin).toBe('anonymous');
    const texture = new THREE.Texture();
    fakes.loads[3].onLoad(texture);
    expect(texture.colorSpace).toBe(THREE.SRGBColorSpace);
    expect(canvas).toHaveAttribute('data-textures-loaded', '1');
  });

  it('keeps the placeholder and logs once when the retry fails too', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { renderer, onError } = setup();

    expect(() => {
      fakes.loads[0].onError(new Event('error'));
      fakes.loads[1].onError(new Event('error'));
      fakes.loads[3].onError(new Event('error'));
      fakes.loads[4].onError(new Event('error'));
    }).not.toThrow();

    // Exactly one retry per poster.
    expect(fakes.loads).toHaveLength(5);
    expect(error).toHaveBeenCalledTimes(1);
    expect(error.mock.calls[0][0]).toBe('[poster-wall]');
    expect(renderer.domElement).toHaveAttribute('data-textures-loaded', '0');
    // A missing poster is not a scene failure.
    expect(onError).not.toHaveBeenCalled();
  });

  it('does not retry after dispose', () => {
    const { wall } = setup();
    wall.dispose();
    fakes.loads[0].onError(new Event('error'));
    expect(fakes.loads).toHaveLength(3);
  });

  it('releases every geometry, material, texture and the renderer on dispose', () => {
    const geometryDispose = vi.spyOn(THREE.BufferGeometry.prototype, 'dispose');
    const materialDispose = vi.spyOn(THREE.Material.prototype, 'dispose');
    const textureDispose = vi.spyOn(THREE.Texture.prototype, 'dispose');
    const { wall, renderer, container } = setup();
    const loaded = [new THREE.Texture(), new THREE.Texture()];
    fakes.loads[0].onLoad(loaded[0]);
    fakes.loads[1].onLoad(loaded[1]);
    fakes.loads[2].onError(new Error('404'));
    intersect(true);

    wall.dispose();

    // One shared poster plane + the glow plane.
    expect(geometryDispose).toHaveBeenCalledTimes(2);
    // One material per poster + the glow.
    expect(materialDispose).toHaveBeenCalledTimes(items.length + 1);
    expect(textureDispose).toHaveBeenCalledTimes(2);
    expect(renderer.setAnimationLoop).toHaveBeenLastCalledWith(null);
    expect(renderer.dispose).toHaveBeenCalledTimes(1);
    expect(renderer.forceContextLoss).toHaveBeenCalledTimes(1);
    expect(container).not.toContainElement(renderer.domElement);
  });

  it('disposes a texture that finishes loading after dispose', () => {
    const { wall } = setup();
    wall.dispose();
    const late = new THREE.Texture();
    const lateDispose = vi.spyOn(late, 'dispose');

    fakes.loads[0].onLoad(late);

    expect(lateDispose).toHaveBeenCalledTimes(1);
  });

  it('is safe to dispose twice', () => {
    const { wall, renderer } = setup();
    wall.dispose();
    wall.dispose();
    expect(renderer.dispose).toHaveBeenCalledTimes(1);
  });

  it('selects the poster under the pointer and shows a pointer cursor', () => {
    const { renderer, onSelect } = setup([items[1]]);
    const canvas = renderer.domElement;
    canvas.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 200, height: 100 }) as DOMRect;
    const at = (x: number, y: number) => ({ clientX: x, clientY: y });

    canvas.dispatchEvent(new MouseEvent('pointermove', at(100, 50)));
    expect(canvas.style.cursor).toBe('pointer');
    canvas.dispatchEvent(new MouseEvent('click', at(100, 50)));
    expect(onSelect).toHaveBeenCalledWith(items[1]);

    // The corner is empty space.
    canvas.dispatchEvent(new MouseEvent('pointermove', at(1, 1)));
    expect(canvas.style.cursor).toBe('');
    canvas.dispatchEvent(new MouseEvent('click', at(1, 1)));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('clears with the page background and follows theme changes in place', () => {
    const { wall, renderer } = setup(items, 'rgb(10, 10, 10)');
    expect(renderer.clearColors.at(-1)).toBe('0a0a0a');

    wall.setBackground('rgb(255, 255, 255)');

    expect(renderer.clearColors.at(-1)).toBe('ffffff');
    // Same renderer and canvas: the scene was not re-created.
    expect(fakes.renderers).toHaveLength(1);
  });

  it('keeps the previous background for a colour it cannot read', () => {
    const { wall, renderer } = setup(items, 'rgb(255, 255, 255)');
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    wall.setBackground('not a colour');
    expect(renderer.clearColors.at(-1)).toBe('ffffff');
  });

  it('re-picks the hovered poster when scrolling moves the camera', () => {
    // Reduced motion: no idle drift, so the geometry below is exact.
    const { renderer, wall } = setup([items[0]], 'rgb(10, 10, 10)', true);
    const canvas = renderer.domElement;
    canvas.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 200, height: 100 }) as DOMRect;
    intersect(true);
    const tick = renderer.setAnimationLoop.mock.lastCall![0] as (
      t: number
    ) => void;
    let now = performance.now();
    const run = (frames: number) => {
      for (let i = 0; i < frames; i++) tick((now += 100));
    };

    // NDC x = 0.18: beside the single card from the starting camera...
    canvas.dispatchEvent(
      new MouseEvent('pointermove', { clientX: 118, clientY: 50 })
    );
    run(20);
    expect(canvas.style.cursor).toBe('');

    // ...but on it once the camera has pushed in, without any pointer move.
    wall.setProgress(1);
    run(30);
    expect(canvas.style.cursor).toBe('pointer');
  });

  it('reports a lost WebGL context', () => {
    const { renderer, onError } = setup();
    renderer.domElement.dispatchEvent(new Event('webglcontextlost'));
    expect(onError).toHaveBeenCalledWith(expect.any(Error));
  });

  it('does not report the context loss it causes itself on dispose', () => {
    const { wall, renderer, onError } = setup();
    renderer.forceContextLoss.mockImplementation(() =>
      renderer.domElement.dispatchEvent(new Event('webglcontextlost'))
    );
    wall.dispose();
    expect(onError).not.toHaveBeenCalled();
  });

  it('accepts scroll progress before and after dispose', () => {
    const { wall } = setup();
    expect(() => {
      wall.setProgress(0.5);
      wall.dispose();
      wall.setProgress(1);
    }).not.toThrow();
  });
});
