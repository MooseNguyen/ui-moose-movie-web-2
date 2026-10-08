'use client';

import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';
import { LocaleSwitcher } from './LocaleSwitcher';
import { MobileNav } from './MobileNav';
import { NavLinks } from './NavLinks';
import { SearchDialog } from './SearchDialog';
import { ThemeToggle } from './ThemeToggle';

const SCROLL_THRESHOLD = 80;

export function Header() {
  const t = useTranslations('common');
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > SCROLL_THRESHOLD);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      data-scrolled={scrolled}
      className={cn(
        'fixed inset-x-0 top-0 z-40 border-b transition-colors duration-300',
        scrolled
          ? 'bg-background/95 border-border backdrop-blur'
          : 'border-transparent bg-transparent'
      )}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-2 px-4">
        <MobileNav />
        <Link href="/" className="flex items-center gap-2">
          <Image
            src="/logo.png"
            alt=""
            width={32}
            height={36}
            className="h-9 w-auto"
            // Above the fold, so not lazy; but React preloads every eager
            // <img> in the shell unless it is low priority, and that preload
            // would compete with the hero backdrop (LCP).
            loading="eager"
            fetchPriority="low"
            unoptimized
          />
          {/* Below 400px the logo, nav button and right cluster leave too
              little room: show the logo alone, keep the text as the link's
              accessible name (sr-only, not hidden). */}
          <span className="sr-only text-lg font-bold whitespace-nowrap min-[400px]:not-sr-only">
            {t('appName')}
          </span>
        </Link>
        <div className="ml-6 hidden md:block">
          <NavLinks />
        </div>
        <div className="ml-auto flex items-center gap-1">
          <SearchDialog />
          <LocaleSwitcher />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
