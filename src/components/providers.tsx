'use client';

import type { ReactNode } from 'react';
import { FavoritesHydrator } from '@/features/favorites/FavoritesHydrator';
import { PosterTransitionController } from '@/components/media/PosterTransitionController';
import { TiltController } from '@/components/media/TiltController';
import { LazyToaster } from '@/components/ui/toast';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <FavoritesHydrator />
      <TiltController />
      <PosterTransitionController />
      <LazyToaster />
    </>
  );
}
