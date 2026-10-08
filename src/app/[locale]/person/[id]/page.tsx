import type { Metadata } from 'next';
import Image from 'next/image';
import { hasLocale, useFormatter, useTranslations } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Fragment, cache, type ReactNode } from 'react';
import { calcAge } from '@/components/person/age';
import { PersonBio } from '@/components/person/PersonBio';
import {
  PersonCredits,
  type CreditItem,
} from '@/components/person/PersonCredits';
import { routing } from '@/i18n/routing';
import { tmdbImage } from '@/lib/images';
import { parsePositiveId } from '@/lib/route-params';
import { getPerson } from '@/lib/tmdb/api';
import { TmdbError } from '@/lib/tmdb/errors';
import type { PersonDetail } from '@/lib/tmdb/types';
import { truncate } from '@/lib/utils';

type PersonPageProps = PageProps<'/[locale]/person/[id]'>;

const META_DESCRIPTION_LENGTH = 160;

// TMDB returns `known_for_department` in English whatever the language.
const DEPARTMENT_KEYS = {
  Acting: 'acting',
  Directing: 'directing',
  Writing: 'writing',
  Production: 'production',
  Sound: 'sound',
  Art: 'art',
  Camera: 'camera',
  Editing: 'editing',
  'Costume & Make-Up': 'costumeMakeUp',
  Crew: 'crew',
  'Visual Effects': 'visualEffects',
  Lighting: 'lighting',
  Creator: 'creator',
} as const;

// Request-scoped memo: generateMetadata and the page share one TMDB call.
const getPersonCached = cache(getPerson);

// No loading.tsx at or above this segment: existence is resolved (and
// notFound() thrown) before anything streams, so an unknown person is a real
// HTTP 404 instead of a streamed soft 404 with status 200.
async function loadPerson({ params }: PersonPageProps) {
  const { locale, id: rawId } = await params;
  const id = parsePositiveId(rawId);
  if (!hasLocale(routing.locales, locale) || id === null) notFound();
  try {
    return { locale, person: await getPersonCached(id, locale) };
  } catch (error) {
    if (error instanceof TmdbError && error.kind === 'not_found') notFound();
    // Anything else is a real failure for error.tsx (never cache it as a 404).
    throw error;
  }
}

// Nothing is prerendered at build time; people render on first request and
// are then cached like the person fetch (REVALIDATE.detail).
export function generateStaticParams() {
  return [];
}

export async function generateMetadata(
  props: PersonPageProps
): Promise<Metadata> {
  const { locale, person } = await loadPerson(props);
  const t = await getTranslations({ locale, namespace: 'person' });
  const title = person.name;
  const description = person.biography.trim()
    ? truncate(person.biography, META_DESCRIPTION_LENGTH)
    : t('metaDescription', { name: title });

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      // No width/height: TMDB profiles are usually, not always, 2:3.
      ...(person.profilePath && {
        images: [{ url: tmdbImage(person.profilePath, 'w780', 'profile') }],
      }),
    },
  };
}

export default async function PersonPage(props: PersonPageProps) {
  const { locale, person } = await loadPerson(props);
  const t = await getTranslations({ locale, namespace: 'person' });

  // Only what the cards read crosses to the client (see CreditItem).
  const credits: CreditItem[] = person.credits.map((item) => ({
    id: item.id,
    mediaType: item.mediaType,
    title: item.title,
    posterPath: item.posterPath,
    year: item.year,
    voteAverage: item.voteAverage,
    voteCount: item.voteCount,
  }));

  return (
    <div className="mx-auto max-w-7xl space-y-12 px-4 pt-24 pb-10">
      {/* pt-24: clears the fixed 4rem header. */}
      <PersonProfile person={person} />
      <section>
        <h2 className="mb-4 text-xl font-bold">{t('filmography')}</h2>
        <PersonCredits credits={credits} />
      </section>
    </div>
  );
}

// Hooks cannot run in an async component, so the markup lives in a sync one.
function PersonProfile({ person }: { person: PersonDetail }) {
  const t = useTranslations('person');
  const format = useFormatter();

  // TMDB dates are calendar dates ("YYYY-MM-DD", parsed as UTC midnight):
  // format them in UTC so a negative offset does not show the previous day.
  const formatDate = (value: string | null) => {
    const date = value ? new Date(value) : null;
    return date && !Number.isNaN(date.getTime())
      ? format.dateTime(date, { dateStyle: 'long', timeZone: 'UTC' })
      : null;
  };
  const born = formatDate(person.birthday);
  const died = formatDate(person.deathday);
  const age = person.birthday
    ? calcAge(person.birthday, person.deathday)
    : null;

  const facts: [string, ReactNode][] = [];
  if (person.knownForDepartment) {
    const key =
      DEPARTMENT_KEYS[
        person.knownForDepartment as keyof typeof DEPARTMENT_KEYS
      ];
    facts.push([
      t('knownFor'),
      key ? (
        t(`departments.${key}`)
      ) : (
        // Unknown department: keep TMDB's English label, marked as such.
        <span lang="en">{person.knownForDepartment}</span>
      ),
    ]);
  }
  if (born) {
    facts.push([
      t('born'),
      age !== null && !died ? t('dateWithAge', { date: born, age }) : born,
    ]);
  }
  if (died) {
    facts.push([
      t('died'),
      age !== null ? t('dateWithAgeAtDeath', { date: died, age }) : died,
    ]);
  }
  if (person.placeOfBirth) facts.push([t('placeOfBirth'), person.placeOfBirth]);

  return (
    <div className="grid gap-8 md:grid-cols-[16rem_minmax(0,1fr)] lg:grid-cols-[18rem_minmax(0,1fr)]">
      <div className="bg-muted relative aspect-[2/3] w-44 overflow-hidden rounded-lg shadow-lg sm:w-56 md:w-full">
        <Image
          src={tmdbImage(person.profilePath, 'w780', 'profile')}
          alt=""
          fill
          sizes="(min-width: 1024px) 18rem, (min-width: 768px) 16rem, (min-width: 640px) 14rem, 11rem"
          priority
          unoptimized={!person.profilePath}
          className="object-cover"
        />
      </div>

      <div className="flex min-w-0 flex-col gap-6">
        <h1 className="text-3xl font-bold md:text-4xl">{person.name}</h1>

        {facts.length > 0 && (
          <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-6 gap-y-2 text-sm">
            {facts.map(([label, value]) => (
              <Fragment key={label}>
                <dt className="text-muted-foreground">{label}</dt>
                <dd>{value}</dd>
              </Fragment>
            ))}
          </dl>
        )}

        <section>
          <h2 className="mb-3 text-xl font-bold">{t('biography')}</h2>
          <PersonBio
            text={person.biography}
            isFallback={person.biographyIsFallback}
          />
        </section>
      </div>
    </div>
  );
}
