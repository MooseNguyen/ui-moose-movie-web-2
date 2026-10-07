import { screen } from '@testing-library/react';
import { renderWithIntl } from '../../../tests/utils/render';
import { PersonCard } from './PersonCard';
import { GridItemCard } from './GridItemCard';
import { person, tvItem } from './fixtures';

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

describe('PersonCard', () => {
  it('links to the person page with a profile placeholder', () => {
    renderWithIntl(<PersonCard person={person} />);
    expect(screen.getByRole('link')).toHaveAttribute('href', '/en/person/287');
    expect(screen.getByRole('img', { name: 'Brad Pitt' })).toHaveAttribute(
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
