'use client';

import type { ReactNode } from 'react';
import { FavoritesHydrator } from '@/features/favorites/FavoritesHydrator';
import { TiltController } from '@/components/media/TiltController';
import { Toaster } from '@/components/ui/sonner';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <FavoritesHydrator />
      <TiltController />
      <Toaster />
    </>
  );
}
