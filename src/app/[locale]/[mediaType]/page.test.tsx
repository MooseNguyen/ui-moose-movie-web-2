import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { isValidElement, type ReactElement, type ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { LoadMoreGrid } from '@/components/media/LoadMoreGrid';
import { loadMoreList } from '@/lib/actions/media';
import { getList } from '@/lib/tmdb/api';
import { TmdbError } from '@/lib/tmdb/errors';
import type { MediaItem } from '@/lib/tmdb/types';
import { tvItem } from '../../../../tests/fixtures/media';
import { renderServerTree } from '../../../../tests/utils/render-server';
import ListPage, { generateMetadata } from './page';

vi.mock('@/lib/tmdb/api', () => ({ getList: vi.fn() }));
vi.mock('@/lib/actions/media', () => ({ loadMoreList: vi.fn() }));
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
      namespace: 'list';
    }) => createTranslator({ locale, messages: messages[locale], namespace }),
  };
});

const mockedGetList = vi.mocked(getList);
const mockedLoadMore = vi.mocked(loadMoreList);

const item = (id: number, mediaType: 'movie' | 'tv'): MediaItem => ({
  ...tvItem,
  id,
  mediaType,
  title: `${mediaType} ${id}`,
});

const props = (locale: string, mediaType: string, list?: string | string[]) =>
  ({
    params: Promise.resolve({ locale, mediaType }),
    searchParams: Promise.resolve(list === undefined ? {} : { list }),
  }) as unknown as PageProps<'/[locale]/[mediaType]'>;

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
  mockedGetList.mockReset();
  mockedLoadMore.mockReset();
  vi.mocked(notFound).mockClear();
  mockedGetList.mockImplementation(async (mediaType) => ({
    items: [item(10, mediaType), item(11, mediaType)],
    page: 1,
    totalPages: 3,
  }));
});

describe('ListPage', () => {
  it('renders the heading, tabs and first page of the grid', async () => {
    await renderServerTree(await ListPage(props('en', 'movie', 'top_rated')));

    expect(
      screen.getByRole('heading', { level: 1, name: 'Movies' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Top Rated', current: 'page' })
    ).toHaveAttribute('href', '/en/movie?list=top_rated');
    expect(mockedGetList).toHaveBeenCalledWith('movie', 'top_rated', 1, 'en');
    expect(screen.getByRole('link', { name: /movie 10/ })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Load more' })
    ).toBeInTheDocument();
  });

  it('renders the tv heading and lists in Vietnamese', async () => {
    await renderServerTree(
      await ListPage(props('vi', 'tv', 'airing_today')),
      'vi'
    );

    expect(
      screen.getByRole('heading', { level: 1, name: 'Phim bộ' })
    ).toBeInTheDocument();
    expect(mockedGetList).toHaveBeenCalledWith('tv', 'airing_today', 1, 'vi');
    expect(
      screen.getByRole('link', { name: 'Phát sóng hôm nay', current: 'page' })
    ).toBeInTheDocument();
  });

  it.each([
    ['an unknown list', 'nope'],
    ['a list of the other media type', 'on_the_air'],
    ['no list', undefined],
  ])('falls back to popular for %s', async (_label, list) => {
    await renderServerTree(await ListPage(props('en', 'movie', list)));

    expect(mockedGetList).toHaveBeenCalledWith('movie', 'popular', 1, 'en');
    expect(
      screen.getByRole('link', { name: 'Popular', current: 'page' })
    ).toBeInTheDocument();
    expect(screen.getAllByRole('link', { current: 'page' })).toHaveLength(1);
  });

  it('uses the first value of a repeated list param', async () => {
    await renderServerTree(
      await ListPage(props('en', 'movie', ['upcoming', 'top_rated']))
    );
    expect(mockedGetList).toHaveBeenCalledWith('movie', 'upcoming', 1, 'en');
  });

  it('shows an inline message and a retry link when the data call fails', async () => {
    mockedGetList.mockRejectedValue(
      new TmdbError('server', '/movie/upcoming', 503)
    );

    // Resolves instead of rejecting: nothing is thrown to fail a render.
    await renderServerTree(await ListPage(props('en', 'movie', 'upcoming')));

    expect(screen.getByRole('status')).toHaveTextContent(
      'Could not load Upcoming Movies right now. Please try again.'
    );
    expect(screen.getByRole('link', { name: 'Try again' })).toHaveAttribute(
      'href',
      '/en/movie?list=upcoming'
    );
    expect(
      screen.getByRole('heading', { level: 1, name: 'Movies' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Upcoming', current: 'page' })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Load more' })
    ).not.toBeInTheDocument();
  });

  it('shows the same inline message for unexpected errors and logs them', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockedGetList.mockRejectedValue(new TypeError('boom'));

    await renderServerTree(await ListPage(props('en', 'tv')));

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('shows the message without a load more button when the list is empty', async () => {
    mockedGetList.mockResolvedValue({ items: [], page: 1, totalPages: 0 });

    await renderServerTree(await ListPage(props('en', 'movie')));

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Load more' })
    ).not.toBeInTheDocument();
  });

  it('404s for an invalid media type before fetching', async () => {
    await expect(ListPage(props('en', 'anime'))).rejects.toThrow(
      'NEXT_NOT_FOUND'
    );
    expect(notFound).toHaveBeenCalled();
    expect(mockedGetList).not.toHaveBeenCalled();
  });

  it('404s for an unknown locale', async () => {
    await expect(ListPage(props('fr', 'movie'))).rejects.toThrow(
      'NEXT_NOT_FOUND'
    );
  });

  it('binds load more to the media type, list and locale', async () => {
    mockedLoadMore.mockResolvedValue({
      ok: true,
      data: { items: [item(20, 'movie')], page: 2, totalPages: 3 },
    });
    await renderServerTree(
      await ListPage(props('vi', 'movie', 'upcoming')),
      'vi'
    );

    await userEvent.click(screen.getByRole('button', { name: 'Tải thêm' }));

    expect(mockedLoadMore).toHaveBeenCalledWith(
      { mediaType: 'movie', list: 'upcoming', locale: 'vi' },
      2
    );
    expect(await screen.findByRole('link', { name: /movie 20/ })).toBeVisible();
  });

  it('keys the grid by list so switching tabs remounts it at page 1', async () => {
    const popular = findByType(
      await ListPage(props('en', 'movie', 'popular')),
      LoadMoreGrid
    );
    const topRated = findByType(
      await ListPage(props('en', 'movie', 'top_rated')),
      LoadMoreGrid
    );

    expect(popular?.key).toBe('popular');
    expect(topRated?.key).toBe('top_rated');
  });
});

describe('generateMetadata', () => {
  it('has a translated title per media type and list', async () => {
    expect(await generateMetadata(props('en', 'movie', 'top_rated'))).toEqual({
      title: 'Top Rated Movies',
      description: expect.stringContaining('Top Rated Movies'),
    });
    expect(await generateMetadata(props('vi', 'tv', 'on_the_air'))).toEqual({
      title: 'Phim bộ đang phát sóng',
      description: expect.stringContaining('Phim bộ đang phát sóng'),
    });
  });

  it('falls back to the default list and 404s for bad segments', async () => {
    expect(await generateMetadata(props('en', 'tv', 'bogus'))).toMatchObject({
      title: 'Popular TV Series',
    });
    await expect(generateMetadata(props('en', 'anime'))).rejects.toThrow(
      'NEXT_NOT_FOUND'
    );
  });
});
