import { useTranslations } from 'next-intl';
import { VideoLiteEmbed } from '@/components/media/VideoLiteEmbed';
import type { Video } from '@/lib/tmdb/types';

export function VideoList({ videos }: { videos: Video[] }) {
  const t = useTranslations('detail');
  if (videos.length === 0) return null;

  return (
    <section aria-labelledby="detail-videos">
      <h2 id="detail-videos" className="mb-4 text-xl font-bold">
        {t('videos')}
      </h2>
      {/* Lite embeds: only a thumbnail until clicked, no YouTube iframe on load. */}
      <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {videos.map((video) => (
          <li key={video.key}>
            <VideoLiteEmbed video={video} />
          </li>
        ))}
      </ul>
    </section>
  );
}
