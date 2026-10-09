import { useTranslations } from 'next-intl';
import type { MediaType, MovieList, TvList } from '@/lib/tmdb/constants';
import { MOVIE_LISTS, TV_LISTS } from '@/lib/tmdb/constants';
import { LinkTabs } from './LinkTabs';

type Props = { mediaType: MediaType; active: MovieList | TvList };

/** `popular` is the default list: its URL is the canonical one, without `?list`. */
export function listHref(mediaType: MediaType, list: MovieList | TvList) {
  return list === 'popular' ? `/${mediaType}` : `/${mediaType}?list=${list}`;
}

/** List switcher for the movie / tv list pages. */
export function ListTabs({ mediaType, active }: Props) {
  const t = useTranslations('list');
  const lists = mediaType === 'movie' ? MOVIE_LISTS : TV_LISTS;

  return (
    <LinkTabs
      label={t('tabsLabel')}
      items={lists.map((list) => ({
        key: list,
        href: listHref(mediaType, list),
        label: t(`tabs.${list}`),
        active: list === active,
      }))}
    />
  );
}
