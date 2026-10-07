'use client';

import { Children, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';

type MediaCarouselProps = {
  /** Server-rendered cards; each child becomes one slide. */
  children: ReactNode;
  /** Accessible name of the carousel region. */
  label: string;
};

/** Scrolling only: it knows nothing about cards, so they can stay Server Components. */
export function MediaCarousel({ children, label }: MediaCarouselProps) {
  const t = useTranslations('common');

  return (
    <Carousel
      aria-label={label}
      opts={{ align: 'start', slidesToScroll: 'auto' }}
      className="w-full min-w-0 px-0 md:px-12"
    >
      {/* py-1/pr-1: room for the cards' focus ring, which the viewport's overflow-hidden would clip */}
      <CarouselContent className="py-1 pr-1">
        {Children.map(children, (child) => (
          <CarouselItem className="basis-1/2 sm:basis-1/3 md:basis-1/4 lg:basis-1/5 xl:basis-1/6">
            {child}
          </CarouselItem>
        ))}
      </CarouselContent>
      <CarouselPrevious
        label={t('carouselPrevious')}
        className="left-0 hidden md:inline-flex"
      />
      <CarouselNext
        label={t('carouselNext')}
        className="right-0 hidden md:inline-flex"
      />
    </Carousel>
  );
}
