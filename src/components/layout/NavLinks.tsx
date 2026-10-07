'use client';

import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { href: '/', labelKey: 'home' },
  { href: '/movie', labelKey: 'movies' },
  { href: '/tv', labelKey: 'tv' },
  { href: '/discover', labelKey: 'discover' },
  { href: '/favorites', labelKey: 'favorites' },
] as const;

/**
 * `pathname` must be locale-less (next-intl's `usePathname()` strips `/vi` and
 * `/en`), so `/` is Home and `/movie/123` is nested under `/movie`.
 */
export function isActivePath(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

type NavLinksProps = {
  orientation?: 'horizontal' | 'vertical';
  onNavigate?: () => void;
};

export function NavLinks({
  orientation = 'horizontal',
  onNavigate,
}: NavLinksProps) {
  const t = useTranslations('nav');
  const pathname = usePathname();

  return (
    <nav aria-label={t('main')}>
      <ul
        className={cn(
          'flex gap-1',
          orientation === 'vertical' ? 'flex-col' : 'items-center'
        )}
      >
        {NAV_ITEMS.map(({ href, labelKey }) => {
          const active = isActivePath(pathname, href);
          return (
            <li key={href}>
              <Link
                href={href}
                onClick={onNavigate}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'focus-visible:ring-ring hover:text-foreground block rounded-md px-3 py-2 text-sm font-medium transition-colors outline-none focus-visible:ring-2',
                  active
                    ? 'text-foreground decoration-primary underline decoration-2 underline-offset-8'
                    : 'text-muted-foreground'
                )}
              >
                {t(labelKey)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
