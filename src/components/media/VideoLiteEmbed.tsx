'use client';

import { Play } from 'lucide-react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import type { Video } from '@/lib/tmdb/types';
import { YouTubeFrame } from './YouTubeFrame';

export function VideoLiteEmbed({ video }: { video: Video }) {
  const t = useTranslations('detail');
  const [active, setActive] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // The button unmounts on click, which would drop focus to <body>. Moving it
  // to the iframe keeps keyboard users inside the player (space/k to pause).
  useEffect(() => {
    if (active) iframeRef.current?.focus();
  }, [active]);

  return (
    <figure className="flex flex-col gap-2">
      <div className="bg-muted relative aspect-video overflow-hidden rounded-lg">
        {active ? (
          <YouTubeFrame
            ref={iframeRef}
            videoKey={video.key}
            title={video.name}
          />
        ) : (
          <button
            type="button"
            aria-label={t('playVideo', { name: video.name })}
            onClick={() => setActive(true)}
            className="group focus-visible:ring-ring absolute inset-0 outline-none focus-visible:ring-2"
          >
            <Image
              src={`https://i.ytimg.com/vi/${encodeURIComponent(video.key)}/hqdefault.jpg`}
              alt=""
              fill
              sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
              loading="lazy"
              unoptimized
              className="object-cover"
            />
            <span className="absolute inset-0 flex items-center justify-center bg-black/20 transition-colors group-hover:bg-black/40">
              <span className="bg-background/80 text-foreground flex size-14 items-center justify-center rounded-full">
                <Play aria-hidden="true" className="size-6 fill-current" />
              </span>
            </span>
          </button>
        )}
      </div>
      <figcaption className="line-clamp-2 text-sm">{video.name}</figcaption>
    </figure>
  );
}
