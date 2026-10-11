'use client';

import { Languages } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import type { MouseEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Link, usePathname, useRouter } from '@/i18n/navigation';
import { routing, type AppLocale } from '@/i18n/routing';

const LOCALE_LABELS: Record<AppLocale, string> = {
  vi: 'Tiếng Việt',
  en: 'English',
};

/**
 * With two locales a plain link to the other one is enough, and it avoids
 * shipping a dropdown menu (Radix Menu + Floating UI) on every page.
 */
export function LocaleSwitcher() {
  const t = useTranslations('common');
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const target =
    routing.locales.find((l) => l !== locale) ?? routing.defaultLocale;

  // The href carries only the pathname: useSearchParams() would opt the whole
  // layout out of static rendering. The query is read at click time instead;
  // modified clicks (new tab/window) keep the browser's default.
  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }
    const query = window.location.search;
    if (!query) return;
    event.preventDefault();
    router.replace(`${pathname}${query}`, { locale: target });
  }

  return (
    <Button asChild variant="ghost" size="sm">
      <Link
        href={pathname}
        locale={target}
        hrefLang={target}
        replace
        // Switching language is rare; do not prefetch the other locale.
        prefetch={false}
        onClick={handleClick}
        // Contains the visible label (WCAG 2.5.3) and says what the link does;
        // an sr-only prefix would depend on whitespace in name computation.
        aria-label={t('switchLanguage', { language: LOCALE_LABELS[target] })}
      >
        <Languages aria-hidden="true" />
        <span lang={target}>{LOCALE_LABELS[target]}</span>
      </Link>
    </Button>
  );
}
