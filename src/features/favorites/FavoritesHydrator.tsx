'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { FAVORITES_STORAGE_KEY, useFavorites } from './store';

/** Renders nothing: loads favorites after mount and keeps tabs in sync. */
export function FavoritesHydrator() {
  const t = useTranslations('favorites');
  const storageAvailable = useFavorites((s) => s.storageAvailable);
  const warned = useRef(false);

  useEffect(() => {
    let active = true;
    const rehydrate = () =>
      Promise.resolve(useFavorites.persist.rehydrate()).finally(() => {
        if (active) useFavorites.setState({ hasHydrated: true });
      });

    void rehydrate();

    // Another tab changed favorites (or cleared all storage: key === null).
    const onStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === FAVORITES_STORAGE_KEY) {
        void rehydrate();
      }
    };
    window.addEventListener('storage', onStorage);
    return () => {
      active = false;
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  useEffect(() => {
    if (!storageAvailable && !warned.current) {
      warned.current = true;
      toast(t('storageUnavailable'));
    }
  }, [storageAvailable, t]);

  return null;
}
