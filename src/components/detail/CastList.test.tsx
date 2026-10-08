import { screen, within } from '@testing-library/react';
import { movieDetail } from '../../../tests/fixtures/media';
import { renderWithIntl } from '../../../tests/utils/render';
import { CastList } from './CastList';
import { VideoList } from './VideoList';

vi.mock(
  '@/i18n/navigation',
  () => import('../../../tests/utils/mock-navigation')
);

beforeAll(() => {
  // Embla needs these browser APIs, which jsdom does not implement.
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
  }));
  class Stub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  vi.stubGlobal('ResizeObserver', Stub);
  vi.stubGlobal('IntersectionObserver', Stub);
});

describe('CastList', () => {
  it('renders a titled carousel of cast cards linking to each person', () => {
    renderWithIntl(<CastList cast={movieDetail.cast} />);

    expect(
      screen.getByRole('heading', { level: 2, name: 'Cast' })
    ).toBeInTheDocument();
    const carousel = screen.getByRole('region', { name: 'Cast' });
    const brad = within(carousel).getByRole('link', { name: /Brad Pitt/ });
    expect(brad).toHaveAttribute('href', '/en/person/287');
    expect(within(brad).getByText('Tyler Durden')).toBeInTheDocument();
    expect(
      within(carousel).getByRole('link', { name: /Edward Norton/ })
    ).toHaveAttribute('href', '/en/person/819');
  });

  it('renders nothing without cast', () => {
    const { container } = renderWithIntl(<CastList cast={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('VideoList', () => {
  it('renders a titled list of lite embeds without any iframe', () => {
    renderWithIntl(<VideoList videos={movieDetail.videos} />);

    expect(
      screen.getByRole('heading', { level: 2, name: 'Videos' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Play: Official Trailer' })
    ).toBeInTheDocument();
    expect(document.querySelector('iframe')).toBeNull();
  });

  it('renders nothing without videos', () => {
    const { container } = renderWithIntl(<VideoList videos={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
