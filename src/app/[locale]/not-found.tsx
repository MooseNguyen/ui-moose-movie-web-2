import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';

export default function NotFound() {
  const t = useTranslations('errors');

  return (
    <div className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center gap-4 px-4 pt-24 text-center">
      <p className="text-foreground text-6xl font-bold">404</p>
      <h1 className="text-2xl font-bold">{t('notFoundTitle')}</h1>
      <p className="text-muted-foreground">{t('notFoundDescription')}</p>
      <Button asChild>
        <Link href="/">{t('backHome')}</Link>
      </Button>
    </div>
  );
}
