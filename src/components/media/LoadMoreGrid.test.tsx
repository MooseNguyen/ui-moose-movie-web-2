import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { stubLocalStorage } from '../../../tests/utils/memory-storage';
import { NextIntlClientProvider } from 'next-intl';
import { renderWithIntl } from '../../../tests/utils/render';
import en from '@/messages/en.json';
import { resetSafeStorage, useFavorites } from '@/features/favorites/store';
import type { ActionError, ActionResult } from '@/lib/actions/types';
import type { GridItem, MediaItem, Paginated } from '@/lib/tmdb/types';
import { tvItem } from '../../../tests/fixtures/media';
import { LoadMoreGrid } from './LoadMoreGrid';

vi.mock(
  '@/i18n/navigation',
  () => import('../../../tests/utils/mock-navigation')
);

type Result = ActionResult<Paginated<GridItem>>;

const media = (id: number, title: string): MediaItem => ({
  ...tvItem,
  id,
  title,
  originalTitle: title,
});
const page1: Paginated<GridItem> = {
  items: [media(1, 'Alpha'), media(2, 'Beta')],
  page: 1,
  totalPages: 3,
};
const ok = (items: GridItem[], page: number, totalPages = 3): Result => ({
  ok: true,
  data: { items, page, totalPages },
});

function deferred() {
  let resolve!: (r: Result) => void;
  const promise = new Promise<Result>((r) => (resolve = r));
  return { promise, resolve };
}

const initial = useFavorites.getInitialState();
beforeEach(() => {
  stubLocalStorage();
  resetSafeStorage();
  useFavorites.setState(initial, true);
});
afterEach(() => vi.unstubAllGlobals());

const loadButton = () => screen.getByRole('button', { name: 'Load more' });

describe('LoadMoreGrid', () => {
  it('appends the next page after a click', async () => {
    const user = userEvent.setup();
    const d = deferred();
    const loadMore = vi.fn((page: number) => {
      void page;
      return d.promise;
    });
    renderWithIntl(<LoadMoreGrid initial={page1} loadMore={loadMore} />);
    expect(screen.getAllByRole('listitem')).toHaveLength(2);

    await user.click(loadButton());
    expect(loadMore).toHaveBeenCalledWith(2);
    expect(loadButton()).toHaveAttribute('aria-busy', 'true');

    await act(async () => d.resolve(ok([media(3, 'Gamma')], 2)));
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    expect(screen.getByText('Gamma')).toBeInTheDocument();
    expect(loadButton()).not.toHaveAttribute('aria-disabled');
  });

  it('stays focusable while pending (aria-disabled, never disabled)', async () => {
    const user = userEvent.setup();
    const d = deferred();
    const loadMore = vi.fn((page: number) => {
      void page;
      return d.promise;
    });
    renderWithIntl(<LoadMoreGrid initial={page1} loadMore={loadMore} />);
    await user.click(loadButton());

    // jsdom cannot reproduce the real-browser blur of a button that becomes
    // `disabled` while focused, so "not disabled" is the regression guard.
    const button = loadButton();
    expect(button).not.toBeDisabled();
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).toHaveFocus();
    expect(screen.getByRole('status')).toHaveTextContent('Loading…');

    await user.keyboard('{Enter}');
    await user.click(button);
    expect(loadMore).toHaveBeenCalledTimes(1);

    await act(async () => d.resolve(ok([media(3, 'Gamma')], 2)));
    expect(button).not.toHaveAttribute('aria-disabled');
    expect(button).toHaveFocus();
  });

  it('changes the live-region text on consecutive loads with equal counts', async () => {
    const user = userEvent.setup();
    const loadMore = vi
      .fn<(page: number) => Promise<Result>>()
      .mockResolvedValueOnce(ok([media(3, 'Gamma')], 2))
      .mockResolvedValueOnce(ok([media(4, 'Delta')], 3, 4));
    renderWithIntl(<LoadMoreGrid initial={page1} loadMore={loadMore} />);
    await user.click(loadButton());
    await screen.findByText('Gamma');
    const first = screen.getByRole('status').textContent;
    expect(first).toContain('Loaded 1 more title');
    await user.click(loadButton());
    await screen.findByText('Delta');
    const second = screen.getByRole('status').textContent;
    expect(second).toContain('Loaded 1 more title');
    expect(second).not.toBe(first);
  });

  it('treats a rejected loadMore as an unknown error and can retry', async () => {
    const user = userEvent.setup();
    const loadMore = vi
      .fn<(page: number) => Promise<Result>>()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce(ok([media(3, 'Gamma')], 2));
    renderWithIntl(<LoadMoreGrid initial={page1} loadMore={loadMore} />);
    await user.click(loadButton());
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not load more titles. Please try again.'
    );
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Gamma')).toBeInTheDocument();
  });

  it.each<ActionError>(['invalid_input', 'not_found'])(
    'maps %s to the generic load-more message',
    async (error) => {
      const user = userEvent.setup();
      const loadMore = vi.fn(async (): Promise<Result> => ({
        ok: false,
        error,
      }));
      renderWithIntl(<LoadMoreGrid initial={page1} loadMore={loadMore} />);
      await user.click(loadButton());
      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Could not load more titles. Please try again.'
      );
    }
  );

  it('does not move focus on initial render of a single-page list', () => {
    renderWithIntl(
      <LoadMoreGrid initial={{ ...page1, totalPages: 1 }} loadMore={vi.fn()} />
    );
    expect(document.body).toHaveFocus();
  });

  it('announces the end and focuses the last link when the final page is all duplicates', async () => {
    const user = userEvent.setup();
    const loadMore = vi.fn(async () => ok([media(2, 'Beta')], 3, 3));
    renderWithIntl(
      <LoadMoreGrid initial={{ ...page1, page: 2 }} loadMore={loadMore} />
    );
    await user.click(loadButton());
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Load more' })).toBeNull()
    );
    expect(screen.getByRole('status')).toHaveTextContent(
      "You've reached the end"
    );
    const links = screen.getAllByRole('link');
    expect(links[links.length - 1]).toHaveFocus();
  });

  it('calls loadMore once on a rapid double click', async () => {
    const user = userEvent.setup();
    const d = deferred();
    const loadMore = vi.fn((page: number) => {
      void page;
      return d.promise;
    });
    renderWithIntl(<LoadMoreGrid initial={page1} loadMore={loadMore} />);
    await user.dblClick(loadButton());
    expect(loadMore).toHaveBeenCalledTimes(1);
    expect(loadMore).toHaveBeenCalledWith(2);
    await act(async () => d.resolve(ok([media(3, 'Gamma')], 2)));
  });

  it('removes the button on the last page, announces it and focuses the last item', async () => {
    const user = userEvent.setup();
    const loadMore = vi.fn(async () => ok([media(3, 'Gamma')], 3, 3));
    renderWithIntl(
      <LoadMoreGrid initial={{ ...page1, page: 2 }} loadMore={loadMore} />
    );
    await user.click(loadButton());
    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: 'Load more' })
      ).not.toBeInTheDocument()
    );
    expect(screen.getByRole('status')).toHaveTextContent(
      "You've reached the end"
    );
    const links = screen.getAllByRole('link');
    expect(links[links.length - 1]).toHaveFocus();
  });

  it('does not render the button when there is a single page', () => {
    renderWithIntl(
      <LoadMoreGrid initial={{ ...page1, totalPages: 1 }} loadMore={vi.fn()} />
    );
    expect(screen.queryByRole('button', { name: 'Load more' })).toBeNull();
  });

  it.each<[ActionError, string]>([
    ['rate_limit', 'Too many requests. Please wait a moment and try again.'],
    ['network', 'Network problem. Check your connection and try again.'],
    ['unknown', 'Could not load more titles. Please try again.'],
  ])(
    'shows a message for %s, keeps items and retries page 2',
    async (error, text) => {
      const user = userEvent.setup();
      const loadMore = vi
        .fn<(page: number) => Promise<Result>>()
        .mockResolvedValueOnce({ ok: false, error })
        .mockResolvedValueOnce(ok([media(3, 'Gamma')], 2));
      renderWithIntl(<LoadMoreGrid initial={page1} loadMore={loadMore} />);

      await user.click(loadButton());
      expect(await screen.findByRole('alert')).toHaveTextContent(text);
      expect(screen.getAllByRole('listitem')).toHaveLength(2);

      await user.click(screen.getByRole('button', { name: 'Try again' }));
      expect(loadMore).toHaveBeenNthCalledWith(2, 2);
      expect(await screen.findByText('Gamma')).toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    }
  );

  it('renders an item returned twice only once', async () => {
    const user = userEvent.setup();
    const loadMore = vi.fn(async () =>
      ok([media(2, 'Beta again'), media(3, 'Gamma')], 2)
    );
    renderWithIntl(<LoadMoreGrid initial={page1} loadMore={loadMore} />);
    await user.click(loadButton());
    await screen.findByText('Gamma');
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    expect(screen.queryByText('Beta again')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Loaded 1 more title');
  });

  it('ignores a response that resolves after unmount', async () => {
    const user = userEvent.setup();
    const d = deferred();
    const loadMore = vi.fn((page: number) => {
      void page;
      return d.promise;
    });
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { unmount } = renderWithIntl(
      <LoadMoreGrid initial={page1} loadMore={loadMore} />
    );
    await user.click(loadButton());
    unmount();
    await act(async () => d.resolve(ok([media(3, 'Gamma')], 2)));
    expect(screen.queryByText('Gamma')).not.toBeInTheDocument();
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('shows only the new list after rerendering with a new key', async () => {
    const user = userEvent.setup();
    const d = deferred();
    const loadMore = vi.fn((page: number) => {
      void page;
      return d.promise;
    });
    const other: Paginated<GridItem> = {
      items: [media(9, 'Other')],
      page: 1,
      totalPages: 2,
    };
    const { rerender } = renderWithIntl(
      <LoadMoreGrid key="a" initial={page1} loadMore={loadMore} />
    );
    await user.click(loadButton());
    rerender(
      <NextIntlClientProvider locale="en" messages={en}>
        <LoadMoreGrid key="b" initial={other} loadMore={vi.fn()} />
      </NextIntlClientProvider>
    );
    await act(async () => d.resolve(ok([media(3, 'Gamma')], 2)));
    expect(screen.queryByText('Gamma')).not.toBeInTheDocument();
    expect(screen.getByText('Other')).toBeInTheDocument();
  });

  it('announces the new count politely and keeps focus on the button', async () => {
    const user = userEvent.setup();
    const loadMore = vi.fn(async () =>
      ok([media(3, 'Gamma'), media(4, 'Delta')], 2)
    );
    renderWithIntl(<LoadMoreGrid initial={page1} loadMore={loadMore} />);
    await user.click(loadButton());
    await screen.findByText('Delta');
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('Loaded 2 more titles');
    expect(status).toHaveClass('sr-only');
    expect(loadButton()).toHaveFocus();
  });

  it('renders Vietnamese strings', () => {
    renderWithIntl(<LoadMoreGrid initial={page1} loadMore={vi.fn()} />, 'vi');
    expect(
      screen.getByRole('button', { name: 'Tải thêm' })
    ).toBeInTheDocument();
  });
});
