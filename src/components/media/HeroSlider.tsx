'use client';

import Autoplay from 'embla-carousel-autoplay';
import { Info, Pause, Play } from 'lucide-react';
import Image from 'next/image';
import { useFormatter, useTranslations } from 'next-intl';
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type FocusEvent,
} from 'react';
import { Button } from '@/components/ui/button';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from '@/components/ui/carousel';
import { FavoriteButton } from '@/features/favorites/FavoriteButton';
import { Link } from '@/i18n/navigation';
import { tmdbImage } from '@/lib/images';
import type { MediaItem } from '@/lib/tmdb/types';
import { cn } from '@/lib/utils';
import { TrailerButton } from './TrailerButton';

const AUTOPLAY_DELAY = 5000;
const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

function subscribeReducedMotion(onChange: () => void) {
  const query = window.matchMedia(REDUCED_MOTION);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}
const getReducedMotion = () => window.matchMedia(REDUCED_MOTION).matches;
// Nothing may move before hydration, so the server assumes reduced motion.
const getServerReducedMotion = () => true;

const CAROUSEL_OPTIONS = {
  loop: true,
  // Manual slide changes jump instead of animating under reduced motion.
  // Embla evaluates (and re-evaluates) media-query breakpoints itself.
  breakpoints: { [REDUCED_MOTION]: { duration: 0 } },
};

export function HeroSlider({ items }: { items: MediaItem[] }) {
  const t = useTranslations('home');
  const [api, setApi] = useState<CarouselApi>();
  const [selected, setSelected] = useState(0);
  // null = the user has not touched the toggle; reduced motion decides.
  const [userPaused, setUserPaused] = useState<boolean | null>(null);
  const [trailerOpen, setTrailerOpen] = useState(false);
  // Keyboard focus inside the region stops rotation until focus leaves it or
  // the user presses play (APG carousel).
  const [focusPaused, setFocusPaused] = useState(false);
  const reducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotion,
    getServerReducedMotion
  );
  // One plugin instance for the component's lifetime. It never starts by
  // itself (playOnInit: false); the effect below is the single place that
  // decides whether it runs.
  const [plugins] = useState(() => [
    Autoplay({
      delay: AUTOPLAY_DELAY,
      playOnInit: false,
      stopOnMouseEnter: true,
      stopOnInteraction: false,
      stopOnFocusIn: true,
      // Listen for hover on the whole region, so pointing at the controls
      // (siblings of the viewport) also pauses.
      rootNode: (viewport) => viewport.parentElement ?? viewport,
    }),
  ]);
  const autoplay = plugins[0];

  const autoplayEnabled = userPaused === null ? !reducedMotion : !userPaused;
  // What the toggle shows. An open trailer is a temporary hold on top of it.
  const rotating = autoplayEnabled && !focusPaused;
  const shouldPlay = rotating && !trailerOpen;

  function toggleRotation() {
    if (rotating) {
      setUserPaused(true);
    } else {
      setUserPaused(false);
      setFocusPaused(false);
    }
  }

  // Last input modality, like the browser's :focus-visible heuristic (which
  // jsdom does not implement reliably). Keyboard by default: unexplained
  // focus should rather pause than keep moving.
  const lastInputRef = useRef<'keyboard' | 'pointer'>('keyboard');
  useEffect(() => {
    const onPointer = () => (lastInputRef.current = 'pointer');
    const onKey = () => (lastInputRef.current = 'keyboard');
    window.addEventListener('pointerdown', onPointer, true);
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('pointerdown', onPointer, true);
      window.removeEventListener('keydown', onKey, true);
    };
  }, []);

  // React's onFocus/onBlur bubble like focusin/focusout. Only focus arriving
  // from outside counts, so moving between controls (or pressing play while
  // focused) does not re-pause. Only keyboard focus counts: a mouse click, or
  // Radix returning focus after a trailer closed by mouse, must not hold the
  // slideshow (hover already pauses it for pointers).
  function handleFocus(event: FocusEvent<HTMLDivElement>) {
    if (event.currentTarget.contains(event.relatedTarget)) return;
    if (lastInputRef.current === 'keyboard') setFocusPaused(true);
  }
  function handleBlur(event: FocusEvent<HTMLDivElement>) {
    if (!event.currentTarget.contains(event.relatedTarget)) {
      setFocusPaused(false);
    }
  }

  const shouldPlayRef = useRef(shouldPlay);
  useEffect(() => {
    shouldPlayRef.current = shouldPlay;
  }, [shouldPlay]);

  useEffect(() => {
    if (!api) return;
    // With a single scroll snap (one item, or no layout yet) the plugin skips
    // its own init and must not be called. Re-applied after every reInit
    // because Embla re-initialises its plugins then.
    const sync = () => {
      if (api.scrollSnapList().length <= 1) return;
      if (shouldPlayRef.current) autoplay.play();
      else autoplay.stop();
    };
    sync();
    api.on('reInit', sync);
    return () => {
      api.off('reInit', sync);
    };
  }, [api, autoplay, shouldPlay]);

  useEffect(() => {
    if (!api) return;
    // The plugin restarts itself on mouseleave, focusout and drag end. A pause
    // from the toggle, keyboard focus, an open trailer or reduced motion must
    // win, so undo
    // those restarts. The plugin only marks itself active after emitting, so
    // stopping has to wait for a microtask.
    const onPlay = () => {
      if (!shouldPlayRef.current) queueMicrotask(() => autoplay.stop());
    };
    const onSelect = () => setSelected(api.selectedScrollSnap());
    api.on('autoplay:play', onPlay);
    api.on('select', onSelect);
    api.on('reInit', onSelect);
    return () => {
      api.off('autoplay:play', onPlay);
      api.off('select', onSelect);
      api.off('reInit', onSelect);
    };
  }, [api, autoplay]);

  if (items.length === 0) return null;

  return (
    <Carousel
      setApi={setApi}
      opts={CAROUSEL_OPTIONS}
      plugins={plugins}
      aria-label={t('heroLabel')}
      onFocus={handleFocus}
      onBlur={handleBlur}
    >
      {/* First in tab order (APG carousel): users can stop the motion before
          reaching the slide content. Visually it sits at the bottom. */}
      <div className="absolute inset-x-0 bottom-4 z-10 mx-auto flex max-w-7xl items-center justify-center gap-2 px-4 md:bottom-6 md:justify-end">
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          // Constant name + aria-pressed (like FavoriteButton): a label that
          // flipped between "Pause" and "Play" would be announced as a new control.
          aria-label={t('pauseSlideshow')}
          aria-pressed={!rotating}
          onClick={toggleRotation}
          className="rounded-full"
        >
          {rotating ? (
            <Pause aria-hidden="true" />
          ) : (
            <Play aria-hidden="true" />
          )}
        </Button>
        <CarouselPrevious label={t('previousSlide')} className="static my-0" />
        <div role="group" aria-label={t('slides')} className="flex">
          {items.map((item, i) => (
            <button
              key={`${item.mediaType}-${item.id}`}
              type="button"
              aria-label={t('goToSlide', { index: i + 1 })}
              aria-current={i === selected ? 'true' : undefined}
              onClick={() => api?.scrollTo(i)}
              className="focus-visible:ring-ring flex h-6 min-w-6 items-center justify-center rounded-full px-1 outline-none focus-visible:ring-2"
            >
              <span
                className={cn(
                  'block h-2 rounded-full transition-all motion-reduce:transition-none',
                  i === selected ? 'bg-foreground w-6' : 'bg-foreground/40 w-2'
                )}
              />
            </button>
          ))}
        </div>
        <CarouselNext label={t('nextSlide')} className="static my-0" />
      </div>

      <CarouselContent
        className="ml-0"
        // Announce slide changes only when they are not automatic (APG).
        aria-live={shouldPlay ? 'off' : 'polite'}
      >
        {items.map((item, i) => (
          <CarouselItem
            key={`${item.mediaType}-${item.id}`}
            className="pl-0"
            aria-label={t('slideLabel', { index: i + 1, total: items.length })}
            // Off-screen slides leave the tab order and the accessibility tree.
            inert={i !== selected}
          >
            <HeroSlide
              item={item}
              priority={i === 0}
              onTrailerOpenChange={setTrailerOpen}
            />
          </CarouselItem>
        ))}
      </CarouselContent>
    </Carousel>
  );
}

type HeroSlideProps = {
  item: MediaItem;
  priority: boolean;
  onTrailerOpenChange: (open: boolean) => void;
};

function HeroSlide({ item, priority, onTrailerOpenChange }: HeroSlideProps) {
  const t = useTranslations('home');
  const tc = useTranslations('common');
  const format = useFormatter();
  const showRating = item.voteCount > 0;

  return (
    <div className="relative h-[60vh] max-h-[52rem] min-h-[30rem] w-full md:h-[70vh] md:min-h-[34rem]">
      {/* bottom-px: the browser bleeds the image's last pixel row past the
          opaque gradient into a visible seam above the rows. */}
      <div className="absolute inset-x-0 top-0 bottom-px">
        <Image
          src={tmdbImage(item.backdropPath, 'w1280', 'backdrop')}
          alt=""
          fill
          sizes="100vw"
          unoptimized={!item.backdropPath}
          // Only the first slide is the LCP candidate; the rest wait until shown.
          {...(priority
            ? { preload: true, fetchPriority: 'high' as const }
            : { loading: 'lazy' as const })}
          className="object-cover"
        />
      </div>
      {/* Gradients keep text at AA contrast over any image, in both themes. */}
      <div
        aria-hidden="true"
        className="from-background via-background/85 to-background/10 absolute inset-0 bg-linear-to-t"
      />
      <div
        aria-hidden="true"
        className="from-background/90 via-background/40 absolute inset-0 hidden bg-linear-to-r to-transparent md:block"
      />
      <div
        aria-hidden="true"
        className="from-background/80 absolute inset-x-0 top-0 h-24 bg-linear-to-b to-transparent"
      />

      <div className="relative mx-auto flex h-full max-w-7xl items-end gap-8 px-4 pb-20 md:pb-24">
        <div className="bg-muted relative hidden aspect-[2/3] w-48 shrink-0 overflow-hidden rounded-lg shadow-lg lg:block">
          <Image
            src={tmdbImage(item.posterPath, 'w342')}
            alt=""
            fill
            sizes="192px"
            unoptimized={!item.posterPath}
            loading="lazy"
            className="object-cover"
          />
        </div>
        <div className="max-w-2xl min-w-0">
          <h2 className="line-clamp-2 text-3xl font-bold md:text-5xl">
            {item.title}
          </h2>
          {(item.year !== null || showRating) && (
            <p className="mt-3 flex items-center gap-2 text-sm font-medium">
              {item.year !== null && <span>{item.year}</span>}
              {item.year !== null && showRating && (
                <span aria-hidden="true">·</span>
              )}
              {showRating && (
                <span>
                  <span className="sr-only">{tc('rating')}</span>
                  <span aria-hidden="true">★ </span>
                  {format.number(item.voteAverage, {
                    minimumFractionDigits: 1,
                    maximumFractionDigits: 1,
                  })}
                </span>
              )}
            </p>
          )}
          {item.overview && (
            <p className="mt-3 line-clamp-3 text-sm md:text-base">
              {item.overview}
            </p>
          )}
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Button asChild>
              <Link
                href={`/${item.mediaType}/${item.id}`}
                aria-label={t('detailsTitle', { title: item.title })}
              >
                <Info aria-hidden="true" />
                {t('details')}
              </Link>
            </Button>
            <TrailerButton
              mediaType={item.mediaType}
              id={item.id}
              title={item.title}
              onOpenChange={onTrailerOpenChange}
              variant="secondary"
            />
            <FavoriteButton
              item={{
                id: item.id,
                mediaType: item.mediaType,
                title: item.title,
                posterPath: item.posterPath,
                voteAverage: item.voteAverage,
                year: item.year,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
