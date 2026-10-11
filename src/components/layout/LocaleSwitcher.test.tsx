import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithIntl } from '../../../tests/utils/render';
import { LocaleSwitcher } from './LocaleSwitcher';

const replace = vi.fn();
const linkProps = vi.fn();

// Stand-in for next-intl's Link: prefixes the target locale like the real one
// (localePrefix "always") and records the props it was given.
vi.mock('@/i18n/navigation', () => ({
  usePathname: () => '/movie/123',
  useRouter: () => ({ replace }),
  Link: ({
    href,
    locale,
    prefetch,
    replace: replaceProp,
    children,
    ...props
  }: React.ComponentProps<'a'> & {
    href: string;
    locale: string;
    prefetch?: boolean;
    replace?: boolean;
  }) => {
    linkProps({ href, locale, prefetch, replace: replaceProp });
    return (
      <a href={`/${locale}${href}`} {...props}>
        {children}
      </a>
    );
  },
}));

const link = (name: RegExp | string) => screen.getByRole('link', { name });

describe('LocaleSwitcher', () => {
  beforeEach(() => {
    replace.mockClear();
    linkProps.mockClear();
    window.history.pushState({}, '', '/vi/movie/123');
  });

  it('links a vi page to the same path in English', () => {
    renderWithIntl(<LocaleSwitcher />, 'vi');

    const a = link('Chuyển ngôn ngữ sang English');
    expect(a).toHaveAttribute('href', '/en/movie/123');
    expect(a).toHaveAttribute('hreflang', 'en');
    expect(screen.getByText('English')).toHaveAttribute('lang', 'en');
    expect(linkProps).toHaveBeenCalledWith(
      expect.objectContaining({ locale: 'en', prefetch: false })
    );
  });

  it('links an en page to the same path in Vietnamese', () => {
    renderWithIntl(<LocaleSwitcher />, 'en');

    const a = link('Switch language to Tiếng Việt');
    expect(a).toHaveAttribute('href', '/vi/movie/123');
    expect(a).toHaveAttribute('hreflang', 'vi');
    expect(screen.getByText('Tiếng Việt')).toHaveAttribute('lang', 'vi');
  });

  it('keeps the current query string when clicked', async () => {
    window.history.pushState({}, '', '/vi/movie/123?page=2&sort=title.asc');
    const user = userEvent.setup();
    renderWithIntl(<LocaleSwitcher />, 'vi');

    await user.click(link(/English/));

    expect(replace).toHaveBeenCalledWith('/movie/123?page=2&sort=title.asc', {
      locale: 'en',
    });
  });

  it('leaves a click without a query to the link itself', () => {
    renderWithIntl(<LocaleSwitcher />, 'vi');

    const notPrevented = fireEvent.click(link(/English/));

    expect(notPrevented).toBe(true);
    expect(replace).not.toHaveBeenCalled();
  });

  it('does not hijack modified clicks (new tab / window)', () => {
    window.history.pushState({}, '', '/vi/movie/123?page=2');
    renderWithIntl(<LocaleSwitcher />, 'vi');

    const notPrevented = fireEvent.click(link(/English/), { ctrlKey: true });

    expect(notPrevented).toBe(true);
    expect(replace).not.toHaveBeenCalled();
  });
});
