import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  isValidElement,
  Suspense,
  type ReactElement,
  type ReactNode,
} from 'react';
import { notFound } from 'next/navigation';
import { LoadMoreGrid } from '@/components/media/LoadMoreGrid';
import { DiscoverFilters } from '@/features/discover/DiscoverFilters';
import { loadMoreDiscover } from '@/lib/actions/media';
import { discover, getGenres } from '@/lib/tmdb/api';
import { TmdbError } from '@/lib/tmdb/errors';
import type { MediaItem } from '@/lib/tmdb/types';
import { tvItem } from '../../../../tests/fixtures/media';
import { renderServerTree } from '../../../../tests/utils/render-server';
import DiscoverPage, { generateMetadata } from './page';

vi.mock('@/lib/tmdb/api', () => ({ discover: vi.fn(), getGenres: vi.fn() }));
vi.mock('@/lib/actions/media', () => ({ loadMoreDiscover: vi.fn() }));
vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
}));
vi.mock(
  '@/i18n/navigation',
  () => import('../../../../tests/utils/mock-navigation')
);
vi.mock('next-intl/server', async () => {
  const { createTranslator } = await import('next-intl');
  const messages = {
    en: (await import('@/messages/en.json')).default,
    vi: (await import('@/messages/vi.json')).default,
  };
  return {
    getTranslations: async ({
      locale,
      namespace,
    }: {
      locale: 'en' | 'vi';
      namespace: 'discover';
    }) => createTranslator({ locale, messages: messages[locale], namespace }),
  };
});

const mockedDiscover = vi.mocked(discover);
const mockedGetGenres = vi.mocked(getGenres);
const mockedLoadMore = vi.mocked(loadMoreDiscover);

const item = (id: number): MediaItem => ({
  ...tvItem,
  id,
  mediaType: 'movie',
  title: `Title ${id}`,
});

type Query = Record<string, string | string[]>;

const props = (locale: string, query: Query = {}) =>
  ({
    params: Promise.resolve({ locale }),
    searchParams: Promise.resolve(query),
  }) as unknown as PageProps<'/[locale]/discover'>;

function findByType(node: ReactNode, type: unknown): ReactElement | null {
  if (!isValidElement(node)) return null;
  if (node.type === type) return node;
  const children = (node.props as { children?: ReactNode }).children;
  for (const child of [children].flat() as ReactNode[]) {
    const found = findByType(child, type);
    if (found) return found;
  }
  return null;
}

/** Resolves the async results component rendered inside the Suspense. */
async function resultsOf(suspense: ReactElement): Promise<ReactNode> {
  const child = (suspense.props as { children: ReactElement }).children;
  const render = child.type as (p: unknown) => Promise<ReactNode>;
  return render(child.props);
}

beforeEach(() => {
  mockedDiscover.mockReset();
  mockedGetGenres.mockReset();
  mockedLoadMore.mockReset();
  vi.mocked(notFound).mockClear();
  mockedGetGenres.mockResolvedValue([
    { id: 12, name: 'Adventure' },
    { id: 28, name: 'Action' },
  ]);
  mockedDiscover.mockResolvedValue({
    items: [item(10), item(11)],
    page: 1,
    totalPages: 3,
  });
});

describe('DiscoverPage', () => {
  it('renders the heading, the filters and the first page', async () => {
    await renderServerTree(await DiscoverPage(props('en')));

    expect(
      screen.getByRole('heading', { level: 1, name: 'Discover movies' })
    ).toBeInTheDocument();
    expect(mockedGetGenres).toHaveBeenCalledWith('movie', 'en');
    expect(mockedDiscover).toHaveBeenCalledWith(
      { type: 'movie', genres: [], year: null, sort: 'popularity.desc' },
      1,
      'en'
    );
    const filters = screen.getByRole('region', { name: 'Filters' });
    expect(
      within(filters).getByRole('group', { name: 'Genres' })
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Title 10/ })).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Load more' })
    ).toBeInTheDocument();
  });

  it('drops genre ids that are not in the genre list', async () => {
    const query = { type: 'tv', genres: '28,999', year: '2020' };
    const tree = await DiscoverPage(props('en', query));
    await renderServerTree(tree);

    expect(mockedGetGenres).toHaveBeenCalledWith('tv', 'en');
    expect(mockedDiscover).toHaveBeenCalledWith(
      { type: 'tv', genres: [28], year: 2020, sort: 'popularity.desc' },
      1,
      'en'
    );
    expect(findByType(tree, DiscoverFilters)?.props).toMatchObject({
      value: { genres: [28] },
    });
    expect(screen.getByRole('button', { name: 'Action' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
  });

  it('keys the results and binds load more to the cleaned query', async () => {
    mockedLoadMore.mockResolvedValue({
      ok: true,
      data: { items: [item(20)], page: 2, totalPages: 3 },
    });
    const tree = await DiscoverPage(
      props('vi', { type: 'tv', genres: '999,12', sort: 'title.asc' })
    );

    const suspense = findByType(tree, Suspense);
    const expected = 'type=tv&genres=12&sort=title.asc';
    expect(suspense?.key).toBe(expected);
    const grid = findByType(await resultsOf(suspense!), LoadMoreGrid);
    expect(grid?.key).toBe(expected);

    await renderServerTree(tree, 'vi');
    await userEvent.click(screen.getByRole('button', { name: 'Tải thêm' }));

    expect(mockedLoadMore).toHaveBeenCalledWith(
      { query: expected, locale: 'vi' },
      2
    );
    expect(await screen.findByRole('link', { name: /Title 20/ })).toBeVisible();
  });

  // Filters live outside the Suspense boundary: a new query only re-suspends
  // the results, so the pressed chip keeps its focus.
  it('keeps the filters outside the Suspense boundary', async () => {
    const tree = await DiscoverPage(props('en', { genres: '12' }));

    const suspense = findByType(tree, Suspense);
    expect(suspense).not.toBeNull();
    expect(findByType(tree, DiscoverFilters)).not.toBeNull();
    expect(findByType(suspense, DiscoverFilters)).toBeNull();
    expect(
      findByType(
        (suspense!.props as { fallback: ReactNode }).fallback,
        LoadMoreGrid
      )
    ).toBeNull();
  });

  it('still works without genres when they fail to load', async () => {
    mockedGetGenres.mockRejectedValue(
      new TmdbError('server', '/genre/movie/list', 503)
    );

    await renderServerTree(await DiscoverPage(props('en', { genres: '999' })));

    expect(
      screen.queryByRole('group', { name: 'Genres' })
    ).not.toBeInTheDocument();
    expect(
      screen.getByText('Genres could not be loaded right now.')
    ).toBeInTheDocument();
    // Without the list there is nothing to validate against: ids are kept.
    expect(mockedDiscover).toHaveBeenCalledWith(
      { type: 'movie', genres: [999], year: null, sort: 'popularity.desc' },
      1,
      'en'
    );
    expect(screen.getByRole('link', { name: /Title 10/ })).toBeVisible();
  });

  it('shows an inline error with a retry link that keeps the query', async () => {
    mockedDiscover.mockRejectedValue(
      new TmdbError('server', '/discover/tv', 503)
    );

    await renderServerTree(
      await DiscoverPage(props('en', { type: 'tv', genres: '12,28' }))
    );

    expect(screen.getByRole('status')).toHaveTextContent(
      'Could not load titles right now. Please try again.'
    );
    expect(screen.getByRole('link', { name: 'Try again' })).toHaveAttribute(
      'href',
      '/en/discover?type=tv&genres=12%2C28'
    );
    expect(screen.getByRole('region', { name: 'Filters' })).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Load more' })
    ).not.toBeInTheDocument();
  });

  it('logs unexpected (non-TMDB) errors', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockedDiscover.mockRejectedValue(new TypeError('boom'));
    mockedGetGenres.mockRejectedValue(new TypeError('boom'));

    await renderServerTree(await DiscoverPage(props('en')));

    expect(screen.getByRole('status')).toHaveTextContent(
      'Could not load titles'
    );
    expect(spy).toHaveBeenCalledTimes(2);
    spy.mockRestore();
  });

  it('shows an empty message with a link that clears the filters', async () => {
    mockedDiscover.mockResolvedValue({ items: [], page: 1, totalPages: 0 });

    await renderServerTree(
      await DiscoverPage(props('en', { genres: '12', year: '1950' }))
    );

    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('No titles match these filters.');
    expect(
      within(status).getByRole('link', { name: 'Clear filters' })
    ).toHaveAttribute('href', '/en/discover');
    expect(
      screen.queryByRole('button', { name: 'Load more' })
    ).not.toBeInTheDocument();
  });

  it('404s for an unknown locale', async () => {
    await expect(DiscoverPage(props('fr'))).rejects.toThrow('NEXT_NOT_FOUND');
    expect(mockedDiscover).not.toHaveBeenCalled();
  });
});

describe('generateMetadata', () => {
  it('uses a title and description per media type', async () => {
    expect(await generateMetadata(props('en'))).toEqual({
      title: 'Discover movies',
      description:
        'Browse movies by genre, release year and sort order, with data from TMDB.',
    });
    expect(await generateMetadata(props('vi', { type: 'tv' }))).toMatchObject({
      title: 'Khám phá phim bộ',
    });
  });
});
