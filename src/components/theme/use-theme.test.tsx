import { act, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { stubLocalStorage } from '../../../tests/utils/memory-storage';
import { renderWithIntl } from '../../../tests/utils/render';
import { useTheme } from './use-theme';

let storage: ReturnType<typeof stubLocalStorage>;
const root = () => document.documentElement;

describe('useTheme', () => {
  beforeEach(() => {
    storage = stubLocalStorage();
    root().className = 'dark';
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('toggle switches the html class and persists the choice', () => {
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe('dark');

    act(() => result.current.toggle());

    expect(result.current.theme).toBe('light');
    expect([...root().classList]).toEqual(['light']);
    expect(root().style.colorScheme).toBe('light');
    expect(localStorage.getItem('theme')).toBe('light');
  });

  it('setTheme works when localStorage.setItem throws', () => {
    vi.spyOn(storage, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const { result } = renderHook(() => useTheme());
    expect(() => act(() => result.current.setTheme('light'))).not.toThrow();
    expect(result.current.theme).toBe('light');
  });

  it('a storage event updates subscribers; invalid values mean dark', () => {
    const { result } = renderHook(() => useTheme());

    localStorage.setItem('theme', 'light');
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: 'theme' }));
    });
    expect(result.current.theme).toBe('light');

    localStorage.setItem('theme', 'nonsense');
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: 'theme' }));
    });
    expect(result.current.theme).toBe('dark');
  });

  it('survives localStorage.getItem throwing on a storage event', () => {
    const { result } = renderHook(() => useTheme());
    vi.spyOn(storage, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: 'theme' }));
    });
    expect(result.current.theme).toBe('dark');
  });
});

describe('ThemeToggle', () => {
  beforeEach(() => {
    storage = stubLocalStorage();
    root().className = 'dark';
  });
  afterEach(() => vi.unstubAllGlobals());

  it('has a label describing the action and flips it on click', async () => {
    const user = userEvent.setup();
    renderWithIntl(<ThemeToggle />);

    await user.click(
      screen.getByRole('button', { name: 'Switch to light theme' })
    );

    expect([...root().classList]).toEqual(['light']);
    expect(
      screen.getByRole('button', { name: 'Switch to dark theme' })
    ).toBeInTheDocument();
  });
});
