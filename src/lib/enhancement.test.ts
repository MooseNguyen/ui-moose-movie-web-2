import {
  afterLoadWhenIdle,
  hasWebGL2,
  prefersEnhancement,
  shouldEnhance,
} from './enhancement';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

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
    media: query,
  }));
}

describe('shouldEnhance', () => {
  it.each([
    [{ finePointer: true, reducedMotion: false, webgl: true }, true],
    [{ finePointer: false, reducedMotion: false, webgl: true }, false],
    [{ finePointer: true, reducedMotion: true, webgl: true }, false],
    [{ finePointer: true, reducedMotion: false, webgl: false }, false],
    [{ finePointer: false, reducedMotion: true, webgl: false }, false],
  ])('%o → %s', (env, expected) => {
    expect(shouldEnhance(env)).toBe(expected);
  });
});

describe('prefersEnhancement', () => {
  it.each([
    [{ finePointer: true, reducedMotion: false }, true],
    [{ finePointer: false, reducedMotion: false }, false],
    [{ finePointer: true, reducedMotion: true }, false],
  ])('%o → %s', (env, expected) => {
    stubMedia(env);
    expect(prefersEnhancement()).toBe(expected);
  });
});

describe('hasWebGL2', () => {
  it('releases the probe context right away', () => {
    const loseContext = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      getExtension: () => ({ loseContext }),
    } as never);
    expect(hasWebGL2()).toBe(true);
    expect(HTMLCanvasElement.prototype.getContext).toHaveBeenCalledWith(
      'webgl2'
    );
    expect(loseContext).toHaveBeenCalledTimes(1);
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
  it('waits for idle once the page has loaded', () => {
    const idle: Array<() => void> = [];
    vi.stubGlobal('requestIdleCallback', (cb: () => void) => idle.push(cb));
    vi.stubGlobal('cancelIdleCallback', () => {});
    const callback = vi.fn();

    afterLoadWhenIdle(callback);
    expect(callback).not.toHaveBeenCalled();
    idle.forEach((cb) => cb());
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('waits for the load event first, and can be cancelled before it', () => {
    vi.spyOn(document, 'readyState', 'get').mockReturnValue('interactive');
    const idle: Array<() => void> = [];
    vi.stubGlobal('requestIdleCallback', (cb: () => void) => idle.push(cb));
    vi.stubGlobal('cancelIdleCallback', () => {});
    const callback = vi.fn();

    const cancel = afterLoadWhenIdle(callback);
    expect(idle).toHaveLength(0);
    cancel();
    window.dispatchEvent(new Event('load'));
    expect(idle).toHaveLength(0);

    afterLoadWhenIdle(callback);
    window.dispatchEvent(new Event('load'));
    idle.forEach((cb) => cb());
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('falls back to a short timeout without requestIdleCallback', () => {
    vi.useFakeTimers();
    vi.stubGlobal('requestIdleCallback', undefined);
    const callback = vi.fn();

    const cancel = afterLoadWhenIdle(callback);
    vi.advanceTimersByTime(250);
    expect(callback).toHaveBeenCalledTimes(1);

    const second = vi.fn();
    afterLoadWhenIdle(second)();
    vi.advanceTimersByTime(250);
    expect(second).not.toHaveBeenCalled();
    cancel();
  });
});
