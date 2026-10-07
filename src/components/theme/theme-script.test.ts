import { stubLocalStorage } from '../../../tests/utils/memory-storage';
import { THEME_SCRIPT } from './theme-script';

let storage: ReturnType<typeof stubLocalStorage>;

function runScript() {
  new Function(THEME_SCRIPT)();
}

describe('THEME_SCRIPT', () => {
  beforeEach(() => {
    storage = stubLocalStorage();
    document.documentElement.className = '';
    document.documentElement.style.colorScheme = '';
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it.each([
    [null, 'dark'],
    ['light', 'light'],
    ['dark', 'dark'],
    ['purple', 'dark'],
  ])('stored %s -> %s', (stored, expected) => {
    if (stored) localStorage.setItem('theme', stored);
    runScript();
    const root = document.documentElement;
    expect([...root.classList]).toEqual([expected]);
    expect(root.style.colorScheme).toBe(expected);
  });

  it('falls back to dark when localStorage throws', () => {
    vi.spyOn(storage, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(runScript).not.toThrow();
    expect([...document.documentElement.classList]).toEqual(['dark']);
  });

  it('replaces a previous theme class instead of stacking', () => {
    document.documentElement.className = 'dark light';
    localStorage.setItem('theme', 'light');
    runScript();
    expect([...document.documentElement.classList]).toEqual(['light']);
  });
});
