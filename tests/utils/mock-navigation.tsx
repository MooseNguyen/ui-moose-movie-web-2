import { useLocale } from 'next-intl';
import type { ComponentProps } from 'react';

// The real next-intl Link needs the Next router, which is absent in vitest.
// This stand-in prefixes the active locale like the real one does.
// Usage: vi.mock('@/i18n/navigation', () => import('../../../tests/utils/mock-navigation'));
export function Link({
  href,
  ...props
}: ComponentProps<'a'> & { href: string }) {
  return <a href={'/' + useLocale() + href} {...props} />;
}
