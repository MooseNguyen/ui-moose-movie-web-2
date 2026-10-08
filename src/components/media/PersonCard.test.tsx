import { screen } from '@testing-library/react';
import { renderWithIntl } from '../../../tests/utils/render';
import { PersonCard } from './PersonCard';
import { GridItemCard } from './GridItemCard';
import { person, tvItem } from '../../../tests/fixtures/media';

vi.mock(
  '@/i18n/navigation',
  () => import('../../../tests/utils/mock-navigation')
);

describe('PersonCard', () => {
  it('links to the person page with a profile placeholder', () => {
    renderWithIntl(<PersonCard person={person} />);
    expect(screen.getByRole('link')).toHaveAttribute('href', '/en/person/287');
    expect(document.querySelector('img')).toHaveAttribute(
      'src',
      '/placeholder-profile.svg'
    );
    expect(screen.getByText('Acting')).toBeInTheDocument();
  });

  it('omits the department when missing', () => {
    renderWithIntl(
      <PersonCard person={{ ...person, knownForDepartment: null }} />
    );
    expect(screen.queryByText('null')).not.toBeInTheDocument();
  });

  it('shows the subtitle instead of the department when given', () => {
    renderWithIntl(<PersonCard person={person} subtitle="Tyler Durden" />);
    expect(screen.getByText('Tyler Durden')).toBeInTheDocument();
    expect(screen.queryByText('Acting')).not.toBeInTheDocument();
  });
});

describe('GridItemCard', () => {
  it('renders a PersonCard for people', () => {
    renderWithIntl(<GridItemCard item={person} />);
    expect(screen.getByRole('link')).toHaveAttribute('href', '/en/person/287');
  });

  it('renders a MediaCard for media', () => {
    renderWithIntl(<GridItemCard item={tvItem} />);
    expect(screen.getByRole('link')).toHaveAttribute('href', '/en/tv/1399');
  });
});
