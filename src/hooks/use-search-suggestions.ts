'use client';

import { useEffect, useState } from 'react';
import {
  SUGGEST_MIN_LENGTH,
  suggestUrl,
  type Suggestion,
  type SuggestResponse,
} from '@/lib/search-suggest';

/** Pause after the last keystroke before asking the server. */
export const SUGGEST_DEBOUNCE_MS = 250;

export type SuggestState =
  | { status: 'idle'; items: [] }
  /** `items` are the previous suggestions, kept so the list does not flash. */
  | { status: 'loading'; items: Suggestion[] }
  | { status: 'success'; items: Suggestion[] }
  | { status: 'error'; items: [] };

type Settled = {
  key: string;
  status: 'success' | 'error';
  items: Suggestion[];
};

const IDLE: SuggestState = { status: 'idle', items: [] };

/**
 * Suggestions for a search query, from /api/search/suggest.
 *
 * Debounced, and every superseded request is aborted, so fast typing makes
 * one request and an old answer can never overwrite a newer one. Answers are
 * cached per locale and query for the life of the component (the dialog), so
 * deleting back to an earlier query is instant.
 */
export function useSearchSuggestions(
  query: string,
  locale: string
): SuggestState {
  const [cache] = useState(() => new Map<string, Suggestion[]>());
  const [settled, setSettled] = useState<Settled | null>(null);

  const q = query.trim();
  const enabled = q.length >= SUGGEST_MIN_LENGTH;
  // TMDB search is case-insensitive.
  const key = `${locale}:${q.toLowerCase()}`;
  const cached = enabled ? cache.get(key) : undefined;

  useEffect(() => {
    if (!enabled || cache.has(key)) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(suggestUrl(q, locale), {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const { items } = (await response.json()) as SuggestResponse;
        cache.set(key, items);
        setSettled({ key, status: 'success', items });
      } catch {
        // A superseded request is expected, not an error.
        if (controller.signal.aborted) return;
        setSettled({ key, status: 'error', items: [] });
      }
    }, SUGGEST_DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [cache, enabled, key, locale, q]);

  if (!enabled) return IDLE;
  if (cached) return { status: 'success', items: cached };
  if (settled?.key === key && settled.status === 'error') {
    return { status: 'error', items: [] };
  }
  return {
    status: 'loading',
    items: settled?.status === 'success' ? settled.items : [],
  };
}
