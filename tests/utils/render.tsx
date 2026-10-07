import { render, type RenderResult } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactElement } from 'react';
import en from '@/messages/en.json';
import vi from '@/messages/vi.json';
import type { AppLocale } from '@/i18n/routing';

const messages = { en, vi } as const;

export function renderWithIntl(
  ui: ReactElement,
  locale: AppLocale = 'en'
): RenderResult {
  return render(
    <NextIntlClientProvider locale={locale} messages={messages[locale]}>
      {ui}
    </NextIntlClientProvider>
  );
}
