import { useTranslations } from 'next-intl';

// Temporary placeholder; the real Home page is built in Task 12.
export default function HomePage() {
  const t = useTranslations('common');
  return (
    <div className="mx-auto w-full max-w-7xl flex-1 px-4 pt-24">
      <h1 className="text-3xl font-bold">{t('homeHeading')}</h1>
    </div>
  );
}
