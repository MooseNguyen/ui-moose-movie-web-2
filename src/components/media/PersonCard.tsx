import Image from 'next/image';
import { Link } from '@/i18n/navigation';
import { tmdbImage } from '@/lib/images';
import type { PersonSummary } from '@/lib/tmdb/types';

const PROFILE_SIZES =
  '(min-width: 1280px) 16vw, (min-width: 1024px) 20vw, (min-width: 768px) 25vw, (min-width: 640px) 33vw, 50vw';

type PersonCardProps = {
  person: PersonSummary;
  /** Second line under the name (e.g. a cast character); defaults to the department. */
  subtitle?: string;
  /**
   * Title element. h3 under a section h2 (rows, filmography); h2 when the
   * grid sits directly under the page h1, so no heading level is skipped.
   */
  headingLevel?: 'h2' | 'h3';
};

export function PersonCard({
  person,
  subtitle = person.knownForDepartment ?? undefined,
  headingLevel: Heading = 'h3',
}: PersonCardProps) {
  return (
    <Link
      href={`/person/${person.id}`}
      className="group focus-visible:ring-ring block rounded-lg outline-none focus-visible:ring-2"
    >
      <div className="bg-muted relative aspect-[2/3] overflow-hidden rounded-lg">
        <Image
          src={tmdbImage(person.profilePath, 'w185', 'profile')}
          alt=""
          fill
          sizes={PROFILE_SIZES}
          unoptimized={!person.profilePath}
          className="object-cover transition-transform duration-300 group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
        />
      </div>
      <Heading className="mt-2 line-clamp-2 text-sm font-medium">
        {person.name}
      </Heading>
      {subtitle && (
        <p className="text-muted-foreground mt-0.5 line-clamp-2 text-xs">
          {subtitle}
        </p>
      )}
    </Link>
  );
}
