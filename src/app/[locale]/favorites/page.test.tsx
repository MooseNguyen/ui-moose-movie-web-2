import { screen } from '@testing-library/react';
import { notFound } from 'next/navigation';
import { useFavorites } from '@/features/favorites/store';
import { stubLocalStorage } from '../../../../tests/utils/memory-storage';
import { renderServerTree } from '../../../../tests/utils/render-server';
import FavoritesPage, { generateMetadata } from './page';

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
      namespace: 'favorites';
    }) => createTranslator({ locale, messages: messages[locale], namespace }),
  };
});

const props = (locale: string) =>
  ({
    params: Promise.resolve({ locale }),
  }) as unknown as PageProps<'/[locale]/favorites'>;

const initial = useFavorites.getInitialState();
beforeEach(() => {
  stubLocalStorage();
  useFavorites.setState(initial, true);
  vi.mocked(notFound).mockClear();
});
afterEach(() => vi.unstubAllGlobals());

describe('FavoritesPage', () => {
  it('renders a focusable heading and the loading view before hydration', async () => {
    await renderServerTree(await FavoritesPage(props('en')));

    const heading = screen.getByRole('heading', {
      level: 1,
      name: 'Your favorites',
    });
    expect(heading).toHaveAttribute('tabindex', '-1');
    expect(heading.id).not.toBe('');
    expect(screen.getByRole('status')).toHaveTextContent('Loading favorites…');
  });

  it('calls notFound for an unknown locale', async () => {
    await expect(FavoritesPage(props('fr'))).rejects.toThrow('NEXT_NOT_FOUND');
    expect(notFound).toHaveBeenCalled();
  });
});

describe('generateMetadata', () => {
  it('is never indexed but lets crawlers follow links', async () => {
    expect(await generateMetadata(props('en'))).toEqual({
      title: 'Favorites',
      robots: { index: false, follow: true },
    });
    expect(await generateMetadata(props('vi'))).toMatchObject({
      title: 'Yêu thích',
    });
  });
});
