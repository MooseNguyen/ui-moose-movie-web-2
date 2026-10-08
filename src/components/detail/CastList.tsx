import { useTranslations } from 'next-intl';
import { MediaCarousel } from '@/components/media/MediaCarousel';
import { PersonCard } from '@/components/media/PersonCard';
import type { CastMember } from '@/lib/tmdb/types';

export function CastList({ cast }: { cast: CastMember[] }) {
  const t = useTranslations('detail');
  if (cast.length === 0) return null;

  return (
    // No aria-labelledby: the carousel region inside already carries the name.
    <section>
      <h2 className="mb-4 text-xl font-bold">{t('cast')}</h2>
      <MediaCarousel label={t('cast')}>
        {cast.map((member) => (
          <PersonCard
            key={member.id}
            person={{
              id: member.id,
              mediaType: 'person',
              name: member.name,
              profilePath: member.profilePath,
              knownForDepartment: null,
            }}
            subtitle={member.character}
          />
        ))}
      </MediaCarousel>
    </section>
  );
}
