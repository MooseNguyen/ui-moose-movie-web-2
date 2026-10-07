import { render, screen } from '@testing-library/react';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { renderWithIntl } from '../../../tests/utils/render';
import { stubLocalStorage } from '../../../tests/utils/memory-storage';
import { THEME_SCRIPT } from './theme-script';
import { ThemeScript } from './ThemeScript';

let insertedHtml: (() => React.ReactNode) | undefined;

vi.mock('next/navigation', () => ({
  useServerInsertedHTML: (cb: () => React.ReactNode) => {
    insertedHtml = cb;
  },
}));

const root = () => document.documentElement;

describe('ThemeScript', () => {
  let storage: ReturnType<typeof stubLocalStorage>;

  beforeEach(() => {
    storage = stubLocalStorage();
    root().className = '';
    root().style.colorScheme = '';
    insertedHtml = undefined;
  });
  afterEach(() => vi.unstubAllGlobals());

  it('renders nothing on the client', () => {
    const { container } = render(<ThemeScript />);
    expect(container).toBeEmptyDOMElement();
  });

  it('registers the inline script for server-inserted HTML', () => {
    render(<ThemeScript />);
    const { container } = render(<>{insertedHtml?.()}</>);
    expect(container.querySelector('script')?.innerHTML).toBe(THEME_SCRIPT);
  });

  it.each([
    ['light', 'light'],
    ['bogus', 'dark'],
    [null, 'dark'],
  ])('re-applies stored %s as %s on a fresh <html>', (stored, expected) => {
    if (stored) storage.setItem('theme', stored);
    render(<ThemeScript />);
    expect([...root().classList]).toEqual([expected]);
    expect(root().style.colorScheme).toBe(expected);
  });

  it('keeps a mounted ThemeToggle in sync with the restored theme', () => {
    storage.setItem('theme', 'light');
    renderWithIntl(
      <>
        <ThemeToggle />
        <ThemeScript />
      </>
    );
    expect(
      screen.getByRole('button', { name: 'Switch to dark theme' })
    ).toBeInTheDocument();
  });
});
