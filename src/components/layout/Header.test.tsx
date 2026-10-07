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

  it('exposes accessible controls for menu, language and theme', () => {
    renderWithIntl(<Header />);
    expect(screen.getByRole('button', { name: 'Open menu' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Language' })).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Switch to light theme' })
    ).toBeVisible();
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
