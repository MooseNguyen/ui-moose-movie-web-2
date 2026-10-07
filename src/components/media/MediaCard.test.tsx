import { screen } from '@testing-library/react';
import { renderWithIntl } from '../../../tests/utils/render';
import { MediaCard } from './MediaCard';
import { tvItem } from './fixtures';

// Real next-intl Link needs the Next router; mimic its locale prefixing.
vi.mock('@/i18n/navigation', async () => {
  const { useLocale } = await import('next-intl');
  return {
    Link: ({
      href,
      ...props
    }: React.ComponentProps<'a'> & { href: string }) => (
      <a href={'/' + useLocale() + href} {...props} />
    ),
  };
});

describe('MediaCard', () => {
  it('links to the right media type and shows placeholder when poster missing', () => {
    renderWithIntl(
      <MediaCard item={{ ...tvItem, posterPath: null, year: null }} />
    );
    expect(screen.getByRole('link')).toHaveAttribute(
      'href',
      '/en/tv/' + tvItem.id
    );
    expect(screen.getByRole('img')).toHaveAttribute(
      'src',
      '/placeholder-poster.svg'
    );
    expect(screen.queryByText('null')).not.toBeInTheDocument();
    expect(screen.queryByText('undefined')).not.toBeInTheDocument();
  });

  it('shows the year, and hides it when null', () => {
    const { unmount } = renderWithIntl(<MediaCard item={tvItem} />);
    expect(screen.getByText('2011')).toBeInTheDocument();
    unmount();
    renderWithIntl(<MediaCard item={{ ...tvItem, year: null }} />);
    expect(screen.queryByText('2011')).not.toBeInTheDocument();
  });

  it('formats the rating with one decimal per locale', () => {
    const { unmount } = renderWithIntl(<MediaCard item={tvItem} />, 'en');
    expect(screen.getByText(/7\.3/)).toBeInTheDocument();
    unmount();
    renderWithIntl(<MediaCard item={tvItem} />, 'vi');
    expect(screen.getByText(/7,3/)).toBeInTheDocument();
  });

  it('hides the rating when there are no votes', () => {
    renderWithIntl(
      <MediaCard item={{ ...tvItem, voteCount: 0, voteAverage: 0 }} />
    );
    expect(screen.queryByText(/★/)).not.toBeInTheDocument();
  });

  it('renders the action outside the link', () => {
    renderWithIntl(<MediaCard item={tvItem} action={<button>Fav</button>} />);
    const button = screen.getByRole('button', { name: 'Fav' });
    expect(screen.getByRole('link')).not.toContainElement(button);
  });

  it('is lazy by default and eager when priority is set', () => {
    const { unmount } = renderWithIntl(<MediaCard item={tvItem} />);
    expect(screen.getByRole('img')).toHaveAttribute('loading', 'lazy');
    unmount();
    renderWithIntl(<MediaCard item={tvItem} priority />);
    expect(screen.getByRole('img')).not.toHaveAttribute('loading', 'lazy');
  });
});
