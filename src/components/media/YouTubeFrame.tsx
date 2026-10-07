import type { Ref } from 'react';

type YouTubeFrameProps = {
  videoKey: string;
  title: string;
  ref?: Ref<HTMLIFrameElement>;
};

// Privacy-enhanced domain: no tracking cookies until the user plays. Only ever
// mounted on demand (open dialog / click), never during the initial render.
export function YouTubeFrame({ videoKey, title, ref }: YouTubeFrameProps) {
  return (
    <iframe
      ref={ref}
      src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoKey)}?autoplay=1`}
      title={title}
      allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
      allowFullScreen
      referrerPolicy="strict-origin-when-cross-origin"
      className="size-full border-0"
    />
  );
}
