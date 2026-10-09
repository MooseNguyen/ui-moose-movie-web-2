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
      expect(document.querySelector('img')).toHaveAttribute('loading', 'lazy');
      unmount();
      renderWithIntl(<GridItemCard item={item} priority />);
      expect(document.querySelector('img')).not.toHaveAttribute(
        'loading',
        'lazy'
      );
    }
  );
});
