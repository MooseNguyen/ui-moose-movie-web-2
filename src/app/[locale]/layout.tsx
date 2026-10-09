import type { Metadata } from 'next';
import { Be_Vietnam_Pro } from 'next/font/google';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Footer } from '@/components/layout/Footer';
import { Header } from '@/components/layout/Header';
import { ThemeScript } from '@/components/theme/ThemeScript';
import { Providers } from '@/components/providers';
import { routing } from '@/i18n/routing';
import { SITE_NAME, siteUrl } from '@/lib/seo';
import '../globals.css';

const beVietnamPro = Be_Vietnam_Pro({
  variable: '--font-be-vietnam-pro',
  subsets: ['latin', 'vietnamese'],
  weight: ['400', '500', '700'],
  display: 'swap',
});

export async function generateMetadata({
  params,
}: LayoutProps<'/[locale]'>): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: 'layout' });
  return {
    // Resolves any relative metadata URL (e.g. local images) against the site.
    metadataBase: new URL(siteUrl()),
    title: { default: t('metaTitle'), template: `%s | ${SITE_NAME}` },
    description: t('metaDescription'),
  };
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: LayoutProps<'/[locale]'>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  return (
    <html
      lang={locale}
      className={`${beVietnamPro.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <ThemeScript />
      </head>
      <body className="flex min-h-full flex-col">
        <NextIntlClientProvider>
          <Providers>
            <Header />
            <main id="main-content" className="w-full min-w-0 flex-1">
              {children}
            </main>
            <Footer />
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
