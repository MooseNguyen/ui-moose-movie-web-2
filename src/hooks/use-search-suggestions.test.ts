import { act, renderHook } from '@testing-library/react';
import type { Suggestion } from '@/lib/search-suggest';
import {
  SUGGEST_DEBOUNCE_MS,
  useSearchSuggestions,
} from './use-search-suggestions';

const batman: Suggestion = {
  id: 1,
  mediaType: 'movie',
  title: 'The Batman',
  year: 2022,
  imagePath: null,
};

type Call = { url: string; signal: AbortSignal };

/** fetch stub: records calls and answers each one when the test resolves it. */
function stubFetch() {
  const calls: Call[] = [];
  const pending: ((response: Response) => void)[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init: RequestInit) => {
      calls.push({ url, signal: init.signal! });
      return new Promise<Response>((resolve, reject) => {
        pending.push(resolve);
        init.signal!.addEventListener('abort', () =>
          reject(new DOMException('Aborted', 'AbortError'))
        );
      });
    })
  );
  return {
    calls,
    async respond(index: number, response: Response) {
      await act(async () => pending[index](response));
    },
  };
}

const ok = (items: Suggestion[]) => Response.json({ items });

async function waitDebounce() {
  await act(async () => vi.advanceTimersByTime(SUGGEST_DEBOUNCE_MS));
}

function renderSuggestions(query: string, locale = 'vi') {
  return renderHook(({ q, l }) => useSearchSuggestions(q, l), {
    initialProps: { q: query, l: locale },
  });
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('useSearchSuggestions', () => {
  it.each(['', ' ', 'b', ' b '])(
    'stays idle and never fetches for %j',
    async (query) => {
      const fetch = stubFetch();
      const { result } = renderSuggestions(query);

      await waitDebounce();

      expect(result.current).toEqual({ status: 'idle', items: [] });
      expect(fetch.calls).toHaveLength(0);
    }
  );

  it('debounces, then fetches the trimmed query for the locale', async () => {
    const fetch = stubFetch();
    const { result } = renderSuggestions(' batman ');

    expect(result.current.status).toBe('loading');
    await act(async () => vi.advanceTimersByTime(SUGGEST_DEBOUNCE_MS - 1));
    expect(fetch.calls).toHaveLength(0);
    await act(async () => vi.advanceTimersByTime(1));

    expect(fetch.calls).toHaveLength(1);
    expect(fetch.calls[0].url).toBe('/api/search/suggest?q=batman&locale=vi');

    await fetch.respond(0, ok([batman]));
    expect(result.current).toEqual({ status: 'success', items: [batman] });
  });

  it('only fetches the last query typed within the debounce window', async () => {
    const fetch = stubFetch();
    const { rerender } = renderSuggestions('ba');

    for (const q of ['bat', 'batm', 'batman']) {
      await act(async () => vi.advanceTimersByTime(SUGGEST_DEBOUNCE_MS / 2));
      rerender({ q, l: 'vi' });
    }
    await waitDebounce();

    expect(fetch.calls.map((c) => c.url)).toEqual([
      '/api/search/suggest?q=batman&locale=vi',
    ]);
  });

  it('aborts a request that a newer query made stale', async () => {
    const fetch = stubFetch();
    const { result, rerender } = renderSuggestions('batman');
    await waitDebounce();

    rerender({ q: 'superman', l: 'vi' });
    await waitDebounce();

    expect(fetch.calls[0].signal.aborted).toBe(true);
    await fetch.respond(1, ok([{ ...batman, id: 2, title: 'Superman' }]));
    expect(result.current.items.map((i) => i.title)).toEqual(['Superman']);
  });

  it('keeps the previous suggestions while the next ones load', async () => {
    const fetch = stubFetch();
    const { result, rerender } = renderSuggestions('batman');
    await waitDebounce();
    await fetch.respond(0, ok([batman]));

    rerender({ q: 'batman 2', l: 'vi' });

    expect(result.current).toEqual({ status: 'loading', items: [batman] });
  });

  it('answers a repeated query from the session cache without fetching', async () => {
    const fetch = stubFetch();
    const { result, rerender } = renderSuggestions('batman');
    await waitDebounce();
    await fetch.respond(0, ok([batman]));
    rerender({ q: 'superman', l: 'vi' });
    await waitDebounce();

    rerender({ q: 'Batman', l: 'vi' });

    expect(result.current).toEqual({ status: 'success', items: [batman] });
    await waitDebounce();
    expect(fetch.calls).toHaveLength(2);
  });

  it('caches per locale', async () => {
    const fetch = stubFetch();
    const { rerender } = renderSuggestions('batman');
    await waitDebounce();
    await fetch.respond(0, ok([batman]));

    rerender({ q: 'batman', l: 'en' });
    await waitDebounce();

    expect(fetch.calls[1].url).toBe('/api/search/suggest?q=batman&locale=en');
  });

  it('reports an error status, and retries when the query comes back', async () => {
    const fetch = stubFetch();
    const { result, rerender } = renderSuggestions('batman');
    await waitDebounce();
    await fetch.respond(
      0,
      Response.json({ error: 'upstream' }, { status: 502 })
    );

    expect(result.current).toEqual({ status: 'error', items: [] });

    rerender({ q: 'batma', l: 'vi' });
    rerender({ q: 'batman', l: 'vi' });
    await waitDebounce();
    expect(fetch.calls).toHaveLength(2);
  });

  it('aborts the pending request on unmount', async () => {
    const fetch = stubFetch();
    const { unmount } = renderSuggestions('batman');
    await waitDebounce();

    unmount();

    expect(fetch.calls[0].signal.aborted).toBe(true);
  });
});
