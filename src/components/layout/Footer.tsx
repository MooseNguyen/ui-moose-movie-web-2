import { GithubIcon, LinkedinIcon } from './brand-icons';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';

const SOCIAL_LINKS = [
  { key: 'github', href: 'https://github.com/MooseNguyen', Icon: GithubIcon },
  {
    key: 'linkedin',
    href: 'https://www.linkedin.com/in/kim-son-39b484217/',
    Icon: LinkedinIcon,
  },
] as const;

export function Footer() {
  const t = useTranslations('footer');
  const tc = useTranslations('common');

  return (
    <footer className="border-border mt-auto border-t">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <Image src="/logo.png" alt="" width={28} height={32} unoptimized />
          <div>
            <p className="font-bold">{tc('appName')}</p>
            <p className="text-muted-foreground text-sm">{t('tagline')}</p>
          </div>
        </div>
        <ul aria-label={t('social')} className="flex gap-1">
          {SOCIAL_LINKS.map(({ key, href, Icon }) => (
            <li key={key}>
              <Button variant="ghost" size="icon" asChild>
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={t(key)}
                >
                  <Icon />
                </a>
              </Button>
            </li>
          ))}
        </ul>
      </div>
      <p className="text-muted-foreground border-border border-t px-4 py-4 text-center text-xs">
        <a
          href="https://www.themoviedb.org"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-foreground underline underline-offset-4"
        >
          {t('tmdbAttribution')}
        </a>
      </p>
    </footer>
  );
}
