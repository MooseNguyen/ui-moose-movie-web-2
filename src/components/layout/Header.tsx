'use client';

import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';
import { LocaleSwitcher } from './LocaleSwitcher';
import { MobileNav } from './MobileNav';
import { NavLinks } from './NavLinks';
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
            priority
            unoptimized
          />
          <span className="text-lg font-bold">{t('appName')}</span>
        </Link>
        <div className="ml-6 hidden md:block">
          <NavLinks />
        </div>
        <div className="ml-auto flex items-center gap-1">
          <LocaleSwitcher />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
