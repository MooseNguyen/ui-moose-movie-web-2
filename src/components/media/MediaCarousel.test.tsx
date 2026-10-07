import { screen } from '@testing-library/react';
import { renderWithIntl } from '../../../tests/utils/render';
import { MediaCarousel } from './MediaCarousel';

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

describe('MediaCarousel', () => {
  it('renders each child in its own slide inside a labelled region', () => {
    renderWithIntl(
      <MediaCarousel label="Trending">
        <p>One</p>
        <p>Two</p>
      </MediaCarousel>
    );
    expect(
      screen.getByRole('region', { name: 'Trending' })
    ).toBeInTheDocument();
    expect(screen.getAllByRole('group')).toHaveLength(2);
    expect(screen.getByText('Two')).toBeInTheDocument();
  });

  it('has translated previous/next buttons', () => {
    renderWithIntl(
      <MediaCarousel label="Thịnh hành">
        <p>One</p>
      </MediaCarousel>,
      'vi'
    );
    expect(
      screen.getByRole('button', { name: 'Cuộn về trước' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Cuộn tiếp' })
    ).toBeInTheDocument();
  });
});
