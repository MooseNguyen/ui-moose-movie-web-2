import { TEST_SITE_URL } from '../../../tests/utils/mock-env';
import { generateMetadata } from './layout';

vi.mock('next/font/google', () => ({
  Be_Vietnam_Pro: () => ({ variable: '--font-be-vietnam-pro' }),
}));
vi.mock('@/lib/env', () => import('../../../tests/utils/mock-env'));
vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
}));
vi.mock(
  '@/i18n/navigation',
  () => import('../../../tests/utils/mock-navigation')
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
      namespace: 'layout';
    }) => createTranslator({ locale, messages: messages[locale], namespace }),
  };
});

const props = (locale: string) =>
  ({
    params: Promise.resolve({ locale }),
    children: null,
  }) as unknown as LayoutProps<'/[locale]'>;

describe('LocaleLayout generateMetadata', () => {
  it('sets the site URL base and a localized title template', async () => {
    const metadata = await generateMetadata(props('en'));

    expect(metadata.metadataBase).toEqual(new URL(TEST_SITE_URL));
    expect(metadata.title).toEqual({
      default: 'Moose Movie',
      template: '%s | Moose Movie',
    });
    expect(metadata.description).toBe(
      'Browse movies and TV series powered by TMDB.'
    );
  });

  it('localizes the default description', async () => {
    const vi = await generateMetadata(props('vi'));
    const en = await generateMetadata(props('en'));

    expect(vi.description).toEqual(expect.any(String));
    expect(vi.description).not.toBe(en.description);
  });

  it('404s for an unknown locale', async () => {
    await expect(generateMetadata(props('fr'))).rejects.toThrow(
      'NEXT_NOT_FOUND'
    );
  });
});
