import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { isValidElement, type ReactElement, type ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { LoadMoreGrid } from '@/components/media/LoadMoreGrid';
import { loadMoreSearch } from '@/lib/actions/media';
import { search } from '@/lib/tmdb/api';
import { TmdbError } from '@/lib/tmdb/errors';
import type { GridItem } from '@/lib/tmdb/types';
import { person, tvItem } from '../../../../tests/fixtures/media';
import { TEST_SITE_URL } from '../../../../tests/utils/mock-env';
import { renderServerTree } from '../../../../tests/utils/render-server';
import SearchPage, { generateMetadata } from './page';

vi.mock('@/lib/tmdb/api', () => ({ search: vi.fn() }));
vi.mock('@/lib/actions/media', () => ({ loadMoreSearch: vi.fn() }));
vi.mock('@/lib/env', () => import('../../../../tests/utils/mock-env'));
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
      namespace: 'search';
    }) => createTranslator({ locale, messages: messages[locale], namespace }),
  };
});

const mockedSearch = vi.mocked(search);
const mockedLoadMore = vi.mocked(loadMoreSearch);

const media = (id: number): GridItem => ({
  ...tvItem,
  id,
  title: `Result ${id}`,
});

type Query = Record<string, string | string[]>;

const props = (locale: string, query: Query = {}) =>
  ({
    params: Promise.resolve({ locale }),
    searchParams: Promise.resolve(query),
  }) as unknown as PageProps<'/[locale]/search'>;

const searchHref = (q: string, type: string) =>
  `/en/search?${new URLSearchParams({ q, type })}`;

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

beforeEach(() => {
  mockedSearch.mockReset();
  mockedLoadMore.mockReset();
  vi.mocked(notFound).mockClear();
  mockedSearch.mockResolvedValue({
    items: [media(10), { ...person, id: 11, name: 'Person 11' }],
    page: 1,
    totalPages: 3,
  });
});

describe('SearchPage', () => {
  it.each([
    ['no q', {}],
    ['a whitespace-only q', { q: '   ' }],
  ])(
    'prompts for a keyword without calling TMDB for %s',
    async (_label, query) => {
      await renderServerTree(await SearchPage(props('en', query)));

      expect(
        screen.getByRole('heading', { level: 1, name: 'Search' })
      ).toBeInTheDocument();
      expect(screen.getByRole('searchbox')).toHaveValue('');
      expect(
        screen.getByText(
          'Enter a keyword to search for movies, TV series and people.'
        )
      ).toBeInTheDocument();
      expect(mockedSearch).not.toHaveBeenCalled();
      expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    }
  );

  it('renders tabs that keep the query, and the first page of results', async () => {
    await renderServerTree(
      await SearchPage(props('en', { q: 'dune', type: 'movie' }))
    );

    expect(mockedSearch).toHaveBeenCalledWith('movie', 'dune', 1, 'en');
    const nav = screen.getByRole('navigation', {
      name: 'Choose a result type',
    });
    const links = within(nav).getAllByRole('link');
    expect(links.map((l) => l.textContent)).toEqual([
      'All',
      'Movies',
      'TV Series',
      'People',
    ]);
    expect(links.map((l) => l.getAttribute('href'))).toEqual([
      '/en/search?q=dune&type=multi',
      '/en/search?q=dune&type=movie',
      '/en/search?q=dune&type=tv',
      '/en/search?q=dune&type=person',
    ]);
    expect(within(nav).getAllByRole('link', { current: 'page' })).toEqual([
      links[1],
    ]);
    expect(screen.getByRole('link', { name: /Result 10/ })).toBeVisible();
    expect(screen.getByRole('link', { name: /Person 11/ })).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Load more' })
    ).toBeInTheDocument();
  });

  // Review Focus #2: Next hands the page the decoded string; it must reach
  // TMDB, the input and the tab links unchanged (links re-encoded once).
  it.each(['người nhện', 'a/b', '50%'])(
    'keeps the exact query %j everywhere',
    async (q) => {
      await renderServerTree(await SearchPage(props('en', { q, type: 'tv' })));

      expect(mockedSearch).toHaveBeenCalledWith('tv', q, 1, 'en');
      expect(screen.getByRole('searchbox')).toHaveValue(q);
      expect(
        screen.getByRole('link', { name: 'TV Series', current: 'page' })
      ).toHaveAttribute('href', searchHref(q, 'tv'));
    }
  );

  it('encodes special characters in the tab links', async () => {
    await renderServerTree(
      await SearchPage(props('en', { q: '50% a/b', type: 'tv' }))
    );
    expect(screen.getByRole('link', { name: 'All' })).toHaveAttribute(
      'href',
      '/en/search?q=50%25+a%2Fb&type=multi'
    );
  });

  it.each([
    ['an unknown type', { q: 'dune', type: 'collection' }],
    ['no type', { q: 'dune' }],
    ['a repeated invalid type', { q: 'dune', type: ['nope', 'tv'] }],
  ])('falls back to multi for %s', async (_label, query) => {
    await renderServerTree(await SearchPage(props('en', query)));

    expect(mockedSearch).toHaveBeenCalledWith('multi', 'dune', 1, 'en');
    expect(
      screen.getByRole('link', { name: 'All', current: 'page' })
    ).toBeInTheDocument();
  });

  it('trims the query and cuts it to the shared limit', async () => {
    await renderServerTree(
      await SearchPage(props('en', { q: `  ${'a'.repeat(150)}` }))
    );
    expect(mockedSearch).toHaveBeenCalledWith(
      'multi',
      'a'.repeat(100),
      1,
      'en'
    );
  });

  it('shows the keyword in the empty message (no grid, tabs kept)', async () => {
    mockedSearch.mockResolvedValue({ items: [], page: 1, totalPages: 0 });

    await renderServerTree(
      await SearchPage(props('en', { q: 'người nhện', type: 'person' }))
    );

    expect(screen.getByRole('status')).toHaveTextContent(
      'No results for “người nhện”.'
    );
    expect(
      screen.getByRole('link', { name: 'People', current: 'page' })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Load more' })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Try again' })
    ).not.toBeInTheDocument();
  });

  it('shows an inline error and a retry link that keeps the query', async () => {
    mockedSearch.mockRejectedValue(new TmdbError('server', '/search/tv', 503));

    await renderServerTree(
      await SearchPage(props('en', { q: 'a/b', type: 'tv' }))
    );

    expect(screen.getByRole('status')).toHaveTextContent(
      'Could not load search results right now. Please try again.'
    );
    expect(screen.getByRole('link', { name: 'Try again' })).toHaveAttribute(
      'href',
      '/en/search?q=a%2Fb&type=tv'
    );
    expect(screen.getByRole('searchbox')).toHaveValue('a/b');
    expect(
      screen.queryByRole('button', { name: 'Load more' })
    ).not.toBeInTheDocument();
  });

  it('logs unexpected (non-TMDB) errors and shows the same message', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockedSearch.mockRejectedValue(new TypeError('boom'));

    await renderServerTree(await SearchPage(props('en', { q: 'dune' })));

    expect(screen.getByRole('status')).toHaveTextContent(
      'Could not load search results'
    );
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('binds load more to the parsed type, query and locale', async () => {
    mockedLoadMore.mockResolvedValue({
      ok: true,
      data: { items: [media(20)], page: 2, totalPages: 3 },
    });
    await renderServerTree(
      await SearchPage(props('vi', { q: ' người nhện ', type: 'movie' })),
      'vi'
    );

    await userEvent.click(screen.getByRole('button', { name: 'Tải thêm' }));

    expect(mockedLoadMore).toHaveBeenCalledWith(
      { type: 'movie', q: 'người nhện', locale: 'vi' },
      2
    );
    expect(
      await screen.findByRole('link', { name: /Result 20/ })
    ).toBeVisible();
  });

  it('keys the grid by type and query so a new search remounts it', async () => {
    const grid = findByType(
      await SearchPage(props('en', { q: 'dune', type: 'tv' })),
      LoadMoreGrid
    );
    expect(grid?.key).toBe('tv:dune');
  });

  it('404s for an unknown locale', async () => {
    await expect(SearchPage(props('fr', { q: 'dune' }))).rejects.toThrow(
      'NEXT_NOT_FOUND'
    );
    expect(mockedSearch).not.toHaveBeenCalled();
  });
});

describe('generateMetadata', () => {
  it('is never indexed', async () => {
    expect(await generateMetadata(props('en'))).toMatchObject({
      title: 'Search',
      robots: { index: false, follow: true },
    });
  });

  it('puts the keyword in the title', async () => {
    expect(
      await generateMetadata(props('en', { q: ' dune ', type: 'tv' }))
    ).toMatchObject({
      title: 'Search results for “dune”',
      robots: { index: false, follow: true },
    });
    expect(
      await generateMetadata(props('vi', { q: 'người nhện' }))
    ).toMatchObject({ title: 'Kết quả tìm kiếm cho “người nhện”' });
  });

  it('keeps the keyword and a non-default type in the canonical', async () => {
    const { alternates } = await generateMetadata(
      props('en', { q: 'a/b', type: 'tv' })
    );
    expect(alternates?.canonical).toBe(
      `${TEST_SITE_URL}/en/search?q=a%2Fb&type=tv`
    );
    expect((await generateMetadata(props('en'))).alternates?.canonical).toBe(
      `${TEST_SITE_URL}/en/search`
    );
  });
});
