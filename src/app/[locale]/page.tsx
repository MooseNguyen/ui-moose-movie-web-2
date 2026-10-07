import { useTranslations } from 'next-intl';

// Temporary placeholder; the real Home page is built in Task 12.
export default function HomePage() {
  const t = useTranslations('common');
  return (
    <main className="mx-auto max-w-6xl px-4 pt-24">
      <h1 className="text-3xl font-bold">{t('homeHeading')}</h1>
    </main>
  );
}
