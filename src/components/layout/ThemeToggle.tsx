'use client';

import { Moon, Sun } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/components/theme/use-theme';

export function ThemeToggle() {
  const t = useTranslations('common');
  const { theme, toggle } = useTheme();
  const isDark = theme === 'dark';

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={isDark ? t('switchToLight') : t('switchToDark')}
      onClick={toggle}
    >
      {isDark ? <Sun /> : <Moon />}
    </Button>
  );
}
