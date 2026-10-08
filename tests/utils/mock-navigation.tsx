import { useLocale } from 'next-intl';
import type { ComponentProps } from 'react';

type Href =
  string | { pathname: string; query?: Record<string, string | number> };

// Same serialisation as next-intl (URLSearchParams), so tests see the real
// encoding of object hrefs: `{ q: 'a/b' }` → `?q=a%2Fb`.
function toPath(href: Href): string {
  if (typeof href === 'string') return href;
  const query = new URLSearchParams(
    Object.entries(href.query ?? {}).map(([k, v]) => [k, String(v)])
  ).toString();
  return query ? `${href.pathname}?${query}` : href.pathname;
}

// The real next-intl Link needs the Next router, which is absent in vitest.
// This stand-in prefixes the active locale like the real one does.
// Usage: vi.mock('@/i18n/navigation', () => import('../../../tests/utils/mock-navigation'));
export function Link({
  href,
  ...props
}: Omit<ComponentProps<'a'>, 'href'> & { href: Href }) {
  return <a href={'/' + useLocale() + toPath(href)} {...props} />;
}

// Inert router for client components rendered inside page trees. Tests that
// assert navigation mock '@/i18n/navigation' themselves.
export function useRouter() {
  return { push: () => {}, replace: () => {} };
}
