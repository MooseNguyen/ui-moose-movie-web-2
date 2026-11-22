import { screen } from '@testing-library/react';
import { renderWithIntl } from '../../../tests/utils/render';
import { person, tvItem } from '../../../tests/fixtures/media';
import { GridItemCard } from './GridItemCard';

vi.mock(
  '@/i18n/navigation',
  () => import('../../../tests/utils/mock-navigation')
);

describe('GridItemCard', () => {
  it('renders a favorite button for media items, outside the link', () => {
    renderWithIntl(<GridItemCard item={tvItem} />);
    const button = screen.getByRole('button', {
      name: 'Favorite: Game of Thrones',
    });
    expect(screen.getByRole('link')).not.toContainElement(button);
  });

  it('renders no favorite button for people', () => {
    renderWithIntl(<GridItemCard item={person} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it.each([tvItem, person])(
    'forwards priority to the card image ($mediaType)',
    (item) => {
      const { unmount } = renderWithIntl(<GridItemCard item={item} />);
      const lazy = document.querySelector('img');
      expect(lazy).toHaveAttribute('loading', 'lazy');
      expect(lazy).not.toHaveAttribute('fetchpriority');
      unmount();
      renderWithIntl(<GridItemCard item={item} priority />);
      const eager = document.querySelector('img');
      expect(eager).not.toHaveAttribute('loading', 'lazy');
      expect(eager).toHaveAttribute('fetchpriority', 'high');
    }
  );

  it.each([tvItem, person])(
    'renders the title as h3 by default and as the given level ($mediaType)',
    (item) => {
      const { unmount } = renderWithIntl(<GridItemCard item={item} />);
      expect(screen.getByRole('heading', { level: 3 })).toBeInTheDocument();
      unmount();
      renderWithIntl(<GridItemCard item={item} headingLevel="h2" />);
      expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument();
    }
  );
});
