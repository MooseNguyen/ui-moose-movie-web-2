import { useTranslations } from 'next-intl';
import type { MediaType, MovieList, TvList } from '@/lib/tmdb/constants';
import { MOVIE_LISTS, TV_LISTS } from '@/lib/tmdb/constants';
import { LinkTabs } from './LinkTabs';

type Props = { mediaType: MediaType; active: MovieList | TvList };

/** List switcher for the movie / tv list pages. */
export function ListTabs({ mediaType, active }: Props) {
  const t = useTranslations('list');
  const lists = mediaType === 'movie' ? MOVIE_LISTS : TV_LISTS;

  return (
    <LinkTabs
      label={t('tabsLabel')}
      items={lists.map((list) => ({
        key: list,
        // `popular` is the default list: link its canonical URL, without `?list`.
        href:
          list === 'popular' ? `/${mediaType}` : `/${mediaType}?list=${list}`,
        label: t(`tabs.${list}`),
        active: list === active,
      }))}
    />
  );
}
