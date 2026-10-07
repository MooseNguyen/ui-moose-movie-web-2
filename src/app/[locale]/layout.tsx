import type { Metadata } from 'next';
import { Be_Vietnam_Pro } from 'next/font/google';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { notFound } from 'next/navigation';
import { Footer } from '@/components/layout/Footer';
import { Header } from '@/components/layout/Header';
import { ThemeScript } from '@/components/theme/ThemeScript';
import { Providers } from '@/components/providers';
import { routing } from '@/i18n/routing';
import '../globals.css';

const beVietnamPro = Be_Vietnam_Pro({
  variable: '--font-be-vietnam-pro',
  subsets: ['latin', 'vietnamese'],
  weight: ['400', '500', '700'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: { default: 'Moose Movie', template: '%s | Moose Movie' },
  description: 'Browse movies and TV series powered by TMDB.',
};

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
            {children}
            <Footer />
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
