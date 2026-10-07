'use client';

import { Languages } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { usePathname, useRouter } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';

type AppLocale = (typeof routing.locales)[number];

const LOCALE_LABELS: Record<AppLocale, string> = {
  vi: 'Tiếng Việt',
  en: 'English',
};

export function LocaleSwitcher() {
  const t = useTranslations('common');
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  function switchTo(next: string) {
    if (next === locale) return;
    const query = searchParams.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, {
      locale: next as AppLocale,
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
