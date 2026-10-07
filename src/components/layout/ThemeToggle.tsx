'use client';

import { Moon, Sun } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import { useSyncExternalStore } from 'react';
import { Button } from '@/components/ui/button';

const subscribe = () => () => {};

export function ThemeToggle() {
  const t = useTranslations('common');
  const { resolvedTheme, setTheme } = useTheme();
  // The theme is only known on the client. Render a neutral placeholder until
  // hydration finishes so server and client markup match.
  const mounted = useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  );
  const isDark = resolvedTheme === 'dark';

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={t('toggleTheme')}
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
    >
      {!mounted ? <span className="size-4" /> : isDark ? <Sun /> : <Moon />}
    </Button>
  );
}
