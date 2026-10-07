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
});
