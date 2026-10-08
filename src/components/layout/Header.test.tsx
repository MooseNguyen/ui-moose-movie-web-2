import { act, screen } from '@testing-library/react';
import { renderWithIntl } from '../../../tests/utils/render';
import { Header } from './Header';

const mockPathname = vi.fn<() => string>();

vi.mock('@/i18n/navigation', () => ({
  usePathname: () => mockPathname(),
  useRouter: () => ({ replace: vi.fn() }),
  Link: ({
    href,
    children,
    ...props
  }: React.ComponentProps<'a'> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

describe('Header', () => {
  beforeEach(() => {
    mockPathname.mockReturnValue('/tv/42');
    window.scrollY = 0;
  });

  it('shows the nav links and marks the active route with aria-current', () => {
    renderWithIntl(<Header />);

    const nav = screen.getByRole('navigation', { name: 'Main navigation' });
    expect(nav).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'TV Series' })).toHaveAttribute(
      'aria-current',
      'page'
    );
    expect(screen.getByRole('link', { name: 'Movies' })).not.toHaveAttribute(
      'aria-current'
    );
  });

  it('exposes accessible controls for menu, search, language and theme', () => {
    renderWithIntl(<Header />);
    expect(screen.getByRole('button', { name: 'Open menu' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Search' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Language' })).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Switch to light theme' })
    ).toBeVisible();
  });

  it('keeps the brand name as the home link name when it is visually hidden', () => {
    renderWithIntl(<Header />);

    const home = screen.getByRole('link', { name: 'Moose Movie' });
    expect(home).toHaveAttribute('href', '/');
    // Below 400px only the logo shows; sr-only (not display:none) keeps the
    // text in the accessibility tree, and it never wraps when visible.
    const brand = screen.getByText('Moose Movie');
    expect(brand).toHaveClass('sr-only', 'min-[400px]:not-sr-only');
    expect(brand).toHaveClass('whitespace-nowrap');
    expect(brand).not.toHaveClass('hidden');
  });

  it('becomes solid only after scrolling past 80px', () => {
    const { container } = renderWithIntl(<Header />);
    const header = container.querySelector('header')!;
    expect(header).toHaveAttribute('data-scrolled', 'false');

    act(() => {
      window.scrollY = 81;
      window.dispatchEvent(new Event('scroll'));
    });
    expect(header).toHaveAttribute('data-scrolled', 'true');

    act(() => {
      window.scrollY = 80;
      window.dispatchEvent(new Event('scroll'));
    });
    expect(header).toHaveAttribute('data-scrolled', 'false');
  });
});
