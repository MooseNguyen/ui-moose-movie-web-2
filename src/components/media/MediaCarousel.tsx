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
      className="px-0 md:px-12"
    >
      <CarouselContent>
        {Children.toArray(children).map((child, index) => (
          <CarouselItem
            key={(child as { key?: string }).key ?? index}
            className="basis-1/2 sm:basis-1/3 md:basis-1/4 lg:basis-1/5 xl:basis-1/6"
          >
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
