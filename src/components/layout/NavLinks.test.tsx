import { screen } from '@testing-library/react';
import { renderWithIntl } from '../../../tests/utils/render';
import { isActivePath, NavLinks } from './NavLinks';

const mockPathname = vi.fn<() => string>();

vi.mock('@/i18n/navigation', () => ({
  usePathname: () => mockPathname(),
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

describe('isActivePath', () => {
  it('matches the root only exactly', () => {
    expect(isActivePath('/', '/')).toBe(true);
    expect(isActivePath('/movie', '/')).toBe(false);
  });

  it('matches the href itself and nested routes', () => {
    expect(isActivePath('/movie', '/movie')).toBe(true);
    expect(isActivePath('/movie/123', '/movie')).toBe(true);
  });

  it('does not match a sibling that only shares a prefix', () => {
    expect(isActivePath('/movies-extra', '/movie')).toBe(false);
    expect(isActivePath('/tv/1', '/movie')).toBe(false);
  });

  // next-intl's usePathname() returns the pathname WITHOUT the locale prefix,
  // so a locale-prefixed path is never expected here.
  it('does not treat a locale-prefixed path as active', () => {
    expect(isActivePath('/en/movie', '/movie')).toBe(false);
  });
});

describe('NavLinks', () => {
  it('renders every nav item and marks only the active one', () => {
    mockPathname.mockReturnValue('/movie/123');
    renderWithIntl(<NavLinks />);

    const labels = ['Home', 'Movies', 'TV Series', 'Discover', 'Favorites'];
    for (const label of labels) {
      expect(screen.getByRole('link', { name: label })).toBeInTheDocument();
    }

    expect(screen.getByRole('link', { name: 'Movies' })).toHaveAttribute(
      'aria-current',
      'page'
    );
    expect(screen.getByRole('link', { name: 'Home' })).not.toHaveAttribute(
      'aria-current'
    );
    expect(
      screen.getAllByRole('link').filter((a) => a.hasAttribute('aria-current'))
    ).toHaveLength(1);
  });

  it('renders localized labels', () => {
    mockPathname.mockReturnValue('/');
    renderWithIntl(<NavLinks />, 'vi');
    expect(screen.getByRole('link', { name: 'Trang chủ' })).toHaveAttribute(
      'aria-current',
      'page'
    );
  });
});
