import { screen, within } from '@testing-library/react';
import { notFound } from 'next/navigation';
import { PersonCredits } from '@/components/person/PersonCredits';
import { getPerson } from '@/lib/tmdb/api';
import { TmdbError } from '@/lib/tmdb/errors';
import { personDetail } from '../../../../../tests/fixtures/media';
import { renderServerTree } from '../../../../../tests/utils/render-server';
import PersonPage, { generateMetadata, generateStaticParams } from './page';

vi.mock('@/lib/tmdb/api', () => ({ getPerson: vi.fn() }));
vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
}));
vi.mock(
  '@/i18n/navigation',
  () => import('../../../../../tests/utils/mock-navigation')
);
// Still renders the real component; the spy only records the props.
vi.mock('@/components/person/PersonCredits', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/components/person/PersonCredits')>();
  return { ...actual, PersonCredits: vi.fn(actual.PersonCredits) };
});
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
      namespace: 'person';
    }) => createTranslator({ locale, messages: messages[locale], namespace }),
  };
});

const mockedGetPerson = vi.mocked(getPerson);

const props = (locale: string, id: string) =>
  ({
    params: Promise.resolve({ locale, id }),
  }) as unknown as PageProps<'/[locale]/person/[id]'>;

const facts = () => {
  const list = document.querySelector('dl') as HTMLElement;
  return within(list)
    .getAllByRole('term')
    .map((term) => [term.textContent, term.nextElementSibling?.textContent]);
};

beforeEach(() => {
  // Only Date is faked, so promises and user events keep working.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-04T12:00:00Z'));
  mockedGetPerson.mockReset();
  mockedGetPerson.mockResolvedValue(personDetail);
  vi.mocked(notFound).mockClear();
  vi.mocked(PersonCredits).mockClear();
});
afterEach(() => vi.useRealTimers());

describe('PersonPage', () => {
  it('renders the profile, facts, biography and filmography', async () => {
    await renderServerTree(await PersonPage(props('en', '287')));

    expect(mockedGetPerson).toHaveBeenCalledWith(287, 'en');
    expect(
      screen.getByRole('heading', { level: 1, name: 'Brad Pitt' })
    ).toBeInTheDocument();
    expect(facts()).toEqual([
      ['Known for', 'Acting'],
      ['Born', 'December 18, 1963 (age 62)'],
      ['Place of birth', 'Shawnee, Oklahoma, USA'],
    ]);
    expect(
      screen.getByRole('heading', { level: 2, name: 'Biography' })
    ).toBeInTheDocument();
    expect(screen.getByText(/American actor/)).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: 'Filmography' })
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Fight Club/ })).toHaveAttribute(
      'href',
      '/en/movie/550'
    );
    expect(document.querySelector('main')).toBeNull();
  });

  it('passes only slim credit items to the client component', async () => {
    await renderServerTree(await PersonPage(props('en', '287')));

    const { credits } = vi.mocked(PersonCredits).mock.calls[0][0];
    expect(credits[0]).toEqual({
      id: 550,
      mediaType: 'movie',
      title: 'Fight Club',
      posterPath: '/poster.jpg',
      year: 2011,
      voteAverage: 7.3456,
      voteCount: 1200,
    });
  });

  it('translates the department and formats dates for Vietnamese', async () => {
    await renderServerTree(await PersonPage(props('vi', '287')), 'vi');

    expect(mockedGetPerson).toHaveBeenCalledWith(287, 'vi');
    expect(facts()).toEqual([
      ['Nghề nghiệp', 'Diễn xuất'],
      ['Ngày sinh', '18 tháng 12, 1963 (62 tuổi)'],
      ['Nơi sinh', 'Shawnee, Oklahoma, USA'],
    ]);
  });

  it('shows an unknown department as English text', async () => {
    mockedGetPerson.mockResolvedValue({
      ...personDetail,
      knownForDepartment: 'Gaffer',
    });
    await renderServerTree(await PersonPage(props('vi', '287')), 'vi');

    expect(screen.getByText('Gaffer')).toHaveAttribute('lang', 'en');
  });

  it('shows the death date with the age at death', async () => {
    mockedGetPerson.mockResolvedValue({
      ...personDetail,
      birthday: '1950-01-01',
      deathday: '2000-06-01',
    });
    await renderServerTree(await PersonPage(props('en', '287')));

    expect(facts()).toEqual([
      ['Known for', 'Acting'],
      ['Born', 'January 1, 1950'],
      ['Died', 'June 1, 2000 (aged 50)'],
      ['Place of birth', 'Shawnee, Oklahoma, USA'],
    ]);
  });

  it('omits the age when the birthday is unknown', async () => {
    mockedGetPerson.mockResolvedValue({
      ...personDetail,
      knownForDepartment: null,
      birthday: null,
      deathday: '2000-06-01',
      placeOfBirth: null,
    });
    await renderServerTree(await PersonPage(props('en', '287')));

    expect(facts()).toEqual([['Died', 'June 1, 2000']]);
    expect(screen.queryByText(/age/)).not.toBeInTheDocument();
  });

  it.each([
    ['a non-numeric id', 'abc'],
    ['a zero id', '0'],
    ['a leading-zero id', '0287'],
  ])('404s for %s before fetching', async (_label, id) => {
    await expect(PersonPage(props('en', id))).rejects.toThrow('NEXT_NOT_FOUND');
    expect(notFound).toHaveBeenCalled();
    expect(mockedGetPerson).not.toHaveBeenCalled();
  });

  it('404s for an unknown locale', async () => {
    await expect(PersonPage(props('fr', '287'))).rejects.toThrow(
      'NEXT_NOT_FOUND'
    );
    expect(mockedGetPerson).not.toHaveBeenCalled();
  });

  it('404s when TMDB does not know the id', async () => {
    mockedGetPerson.mockRejectedValue(
      new TmdbError('not_found', '/person/999999999', 404)
    );
    await expect(PersonPage(props('en', '999999999'))).rejects.toThrow(
      'NEXT_NOT_FOUND'
    );
    expect(notFound).toHaveBeenCalled();
  });

  it('re-throws other errors for the error boundary', async () => {
    const error = new TmdbError('server', '/person/287', 503);
    mockedGetPerson.mockRejectedValue(error);

    await expect(PersonPage(props('en', '287'))).rejects.toBe(error);
    expect(notFound).not.toHaveBeenCalled();
  });
});

describe('generateStaticParams', () => {
  it('prerenders nothing at build time', async () => {
    expect(await generateStaticParams()).toEqual([]);
  });
});

describe('generateMetadata', () => {
  it('uses the name, biography and profile image', async () => {
    expect(await generateMetadata(props('en', '287'))).toEqual({
      title: 'Brad Pitt',
      description: personDetail.biography,
      openGraph: {
        title: 'Brad Pitt',
        description: personDetail.biography,
        images: [{ url: 'https://image.tmdb.org/t/p/w780/brad.jpg' }],
      },
    });
  });

  it('trims a long biography to about 160 characters', async () => {
    mockedGetPerson.mockResolvedValue({
      ...personDetail,
      biography: 'word '.repeat(100),
    });
    const { description } = await generateMetadata(props('en', '287'));

    expect(description!.length).toBeLessThanOrEqual(160);
    expect(description).toMatch(/…$/);
  });

  it('falls back to a generic description and omits images', async () => {
    mockedGetPerson.mockResolvedValue({
      ...personDetail,
      biography: '',
      profilePath: null,
    });
    const metadata = await generateMetadata(props('en', '287'));

    expect(metadata.description).toBe(
      'Biography and filmography of Brad Pitt.'
    );
    expect(metadata.openGraph).not.toHaveProperty('images');
  });

  it('404s for invalid params and unknown ids', async () => {
    await expect(generateMetadata(props('en', 'abc'))).rejects.toThrow(
      'NEXT_NOT_FOUND'
    );
    mockedGetPerson.mockRejectedValue(
      new TmdbError('not_found', '/person/1', 404)
    );
    await expect(generateMetadata(props('en', '1'))).rejects.toThrow(
      'NEXT_NOT_FOUND'
    );
  });
});
