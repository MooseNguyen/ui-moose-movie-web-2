'use client';

import type { ReactNode } from 'react';
import { FavoritesHydrator } from '@/features/favorites/FavoritesHydrator';
import { Toaster } from '@/components/ui/sonner';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <FavoritesHydrator />
      <Toaster />
    </>
  );
}
