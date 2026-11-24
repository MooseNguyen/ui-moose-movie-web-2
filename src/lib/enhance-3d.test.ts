import {
  afterLoadWhenIdle,
  hasWebGL2,
  prefersMotionOnFinePointer,
  shouldEnhance,
} from './enhance-3d';

function stubMedia({
  finePointer,
  reducedMotion,
}: {
  finePointer: boolean;
  reducedMotion: boolean;
}) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches:
      (query === '(pointer: fine)' && finePointer) ||
      (query === '(prefers-reduced-motion: reduce)' && reducedMotion),
  }));
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('shouldEnhance', () => {
  it('needs a fine pointer, motion and WebGL2', () => {
    const desktop = { finePointer: true, reducedMotion: false, webgl: true };
    expect(shouldEnhance(desktop)).toBe(true);
    expect(shouldEnhance({ ...desktop, finePointer: false })).toBe(false);
    expect(shouldEnhance({ ...desktop, reducedMotion: true })).toBe(false);
    expect(shouldEnhance({ ...desktop, webgl: false })).toBe(false);
  });
});

describe('prefersMotionOnFinePointer', () => {
  it('is true only for a fine pointer without reduced motion', () => {
    stubMedia({ finePointer: true, reducedMotion: false });
    expect(prefersMotionOnFinePointer()).toBe(true);
    stubMedia({ finePointer: false, reducedMotion: false });
    expect(prefersMotionOnFinePointer()).toBe(false);
    stubMedia({ finePointer: true, reducedMotion: true });
    expect(prefersMotionOnFinePointer()).toBe(false);
  });
});

describe('hasWebGL2', () => {
  it('releases the probe context right away', () => {
    const loseContext = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      getExtension: () => ({ loseContext }),
    } as never);
    expect(hasWebGL2()).toBe(true);
    expect(loseContext).toHaveBeenCalledOnce();
  });

  it('is false without a context or when the probe throws', () => {
    const getContext = vi
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockReturnValue(null);
    expect(hasWebGL2()).toBe(false);
    getContext.mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(hasWebGL2()).toBe(false);
  });
});

describe('afterLoadWhenIdle', () => {
  it('waits for the load event, then for idle time', () => {
    vi.spyOn(document, 'readyState', 'get').mockReturnValue('loading');
    const idle: Array<() => void> = [];
    vi.stubGlobal('requestIdleCallback', (cb: () => void) => idle.push(cb));
    vi.stubGlobal('cancelIdleCallback', () => {});
    const callback = vi.fn();

    afterLoadWhenIdle(callback);
    expect(idle).toHaveLength(0);
    window.dispatchEvent(new Event('load'));
    expect(idle).toHaveLength(1);
    expect(callback).not.toHaveBeenCalled();
    idle[0]();
    expect(callback).toHaveBeenCalledOnce();
  });

  it('cancels before the page has loaded', () => {
    vi.spyOn(document, 'readyState', 'get').mockReturnValue('loading');
    const request = vi.fn();
    vi.stubGlobal('requestIdleCallback', request);
    const cancel = afterLoadWhenIdle(vi.fn());
    cancel();
    window.dispatchEvent(new Event('load'));
    expect(request).not.toHaveBeenCalled();
  });

  it('falls back to a timeout without requestIdleCallback', () => {
    vi.useFakeTimers();
    vi.spyOn(document, 'readyState', 'get').mockReturnValue('complete');
    vi.stubGlobal('requestIdleCallback', undefined);
    const callback = vi.fn();
    const cancel = afterLoadWhenIdle(callback);
    vi.advanceTimersByTime(200);
    expect(callback).toHaveBeenCalledOnce();

    const cancelled = vi.fn();
    afterLoadWhenIdle(cancelled)();
    vi.advanceTimersByTime(200);
    expect(cancelled).not.toHaveBeenCalled();
    cancel();
  });
});
