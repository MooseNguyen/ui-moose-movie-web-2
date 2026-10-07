'use client';

import { Languages } from 'lucide-react';
import { hasLocale, useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { usePathname, useRouter } from '@/i18n/navigation';
import { routing, type AppLocale } from '@/i18n/routing';

const LOCALE_LABELS: Record<AppLocale, string> = {
  vi: 'Tiếng Việt',
  en: 'English',
};

export function LocaleSwitcher() {
  const t = useTranslations('common');
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  function switchTo(next: string) {
    if (next === locale || !hasLocale(routing.locales, next)) return;
    // Read the query at click time: useSearchParams() would opt the whole
    // layout out of static rendering, and the value is only needed here.
    const query = window.location.search;
    router.replace(`${pathname}${query}`, {
      locale: next,
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" aria-label={t('language')}>
          <Languages />
          <span className="uppercase">{locale}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup value={locale} onValueChange={switchTo}>
          {routing.locales.map((l) => (
            <DropdownMenuRadioItem key={l} value={l}>
              {LOCALE_LABELS[l]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
