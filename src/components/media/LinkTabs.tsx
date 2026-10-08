import type { ComponentProps } from 'react';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

export type LinkTabItem = {
  key: string;
  href: ComponentProps<typeof Link>['href'];
  label: string;
  active: boolean;
};

type Props = { label: string; items: LinkTabItem[] };

/**
 * Tab-styled links. Each tab is a different URL rendered by the server, so
 * this is a navigation landmark with aria-current, not an ARIA tablist (which
 * promises arrow-key roving and in-page panels).
 */
export function LinkTabs({ label, items }: Props) {
  return (
    <nav aria-label={label}>
      {/* Wraps instead of scrolling: every tab, including the active one,
          stays visible on narrow screens without client JS. */}
      <ul className="flex flex-wrap gap-2">
        {items.map((item) => (
          <li key={item.key}>
            <Link
              href={item.href}
              aria-current={item.active ? 'page' : undefined}
              className={cn(
                'focus-visible:ring-ring block rounded-full border px-4 py-2 text-sm font-medium whitespace-nowrap outline-none focus-visible:ring-2',
                item.active
                  ? 'bg-primary text-primary-foreground border-transparent'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )}
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
