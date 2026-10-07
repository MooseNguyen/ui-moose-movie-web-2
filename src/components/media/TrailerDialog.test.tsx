import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { renderWithIntl } from '../../../tests/utils/render';
import { getTrailer } from '@/lib/actions/media';
import { TrailerButton } from './TrailerButton';
import type { ActionResult } from '@/lib/actions/types';
import type { Video } from '@/lib/tmdb/types';

vi.mock('@/lib/actions/media', () => ({ getTrailer: vi.fn() }));

const mockedGetTrailer = vi.mocked(getTrailer);
const video: Video = {
  key: 'abc123',
  name: 'Official Trailer',
  type: 'Trailer',
  official: true,
};
const ok = (data: Video | null): ActionResult<Video | null> => ({
  ok: true,
  data,
});
const fail: ActionResult<Video | null> = { ok: false, error: 'network' };

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

const props = { mediaType: 'movie' as const, id: 550, title: 'Fight Club' };
const getIframe = () => document.querySelector('iframe');
const openDialog = (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByRole('button', { name: 'Trailer' }));

beforeEach(() => mockedGetTrailer.mockReset());

describe('TrailerButton / TrailerDialog', () => {
  it('renders no iframe and does not fetch before opening', () => {
    renderWithIntl(<TrailerButton {...props} />);
    expect(getIframe()).toBeNull();
    expect(mockedGetTrailer).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Trailer' })).toHaveAttribute(
      'type',
      'button'
    );
  });

  it('fetches on open, renders the iframe with exact attributes, removes it on Esc', async () => {
    mockedGetTrailer.mockResolvedValue(ok(video));
    const user = userEvent.setup();
    renderWithIntl(<TrailerButton {...props} />);
    await openDialog(user);

    await waitFor(() => expect(getIframe()).not.toBeNull());
    expect(mockedGetTrailer).toHaveBeenCalledWith({
      mediaType: 'movie',
      id: 550,
      locale: 'en',
    });
    const iframe = getIframe()!;
    expect(iframe).toHaveAttribute(
      'src',
      'https://www.youtube-nocookie.com/embed/abc123?autoplay=1'
    );
    expect(iframe).toHaveAttribute(
      'allow',
      'autoplay; encrypted-media; picture-in-picture; fullscreen'
    );
    expect(iframe).toHaveAttribute(
      'referrerpolicy',
      'strict-origin-when-cross-origin'
    );
    expect(iframe).toHaveAttribute('title', 'Official Trailer');

    await user.keyboard('{Escape}');
    expect(getIframe()).toBeNull();
  });

  it('shows a loading skeleton while pending', async () => {
    const d = deferred<ActionResult<Video | null>>();
    mockedGetTrailer.mockReturnValue(d.promise);
    const user = userEvent.setup();
    renderWithIntl(<TrailerButton {...props} />);
    await openDialog(user);
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(getIframe()).toBeNull();
    await act(async () => d.resolve(ok(video)));
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('shows the no-trailer message when the action returns null', async () => {
    mockedGetTrailer.mockResolvedValue(ok(null));
    const user = userEvent.setup();
    renderWithIntl(<TrailerButton {...props} />);
    await openDialog(user);
    expect(await screen.findByText('No trailer available.')).toBeVisible();
    expect(getIframe()).toBeNull();
  });

  it('shows an error with retry that refetches and then shows the iframe', async () => {
    mockedGetTrailer
      .mockResolvedValueOnce(fail)
      .mockResolvedValueOnce(ok(video));
    const user = userEvent.setup();
    renderWithIntl(<TrailerButton {...props} />);
    await openDialog(user);
    expect(
      await screen.findByText('Could not load the video. Please try again.')
    ).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(getIframe()).not.toBeNull());
    expect(mockedGetTrailer).toHaveBeenCalledTimes(2);
  });

  it('does not refetch when reopened after a settled result', async () => {
    mockedGetTrailer.mockResolvedValue(ok(video));
    const user = userEvent.setup();
    renderWithIntl(<TrailerButton {...props} />);
    await openDialog(user);
    await waitFor(() => expect(getIframe()).not.toBeNull());
    await user.keyboard('{Escape}');
    await openDialog(user);
    await waitFor(() => expect(getIframe()).not.toBeNull());
    expect(mockedGetTrailer).toHaveBeenCalledTimes(1);
  });

  it('does not refetch when reopened while the first request is still pending', async () => {
    const d = deferred<ActionResult<Video | null>>();
    mockedGetTrailer.mockReturnValue(d.promise);
    const user = userEvent.setup();
    renderWithIntl(<TrailerButton {...props} />);
    await openDialog(user);
    await user.keyboard('{Escape}');
    await openDialog(user);
    await act(async () => d.resolve(ok(video)));
    expect(mockedGetTrailer).toHaveBeenCalledTimes(1);
    expect(getIframe()).not.toBeNull();
  });

  it('keeps the newest result: a retry result is not overwritten by the earlier request', async () => {
    const first = deferred<ActionResult<Video | null>>();
    const second = deferred<ActionResult<Video | null>>();
    mockedGetTrailer
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const user = userEvent.setup();
    renderWithIntl(<TrailerButton {...props} />);
    await openDialog(user);
    await act(async () => first.resolve(fail));
    await user.click(await screen.findByRole('button', { name: 'Try again' }));
    await act(async () =>
      second.resolve(ok({ ...video, key: 'fresh', name: 'Fresh' }))
    );
    expect(getIframe()).toHaveAttribute(
      'src',
      'https://www.youtube-nocookie.com/embed/fresh?autoplay=1'
    );
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('ignores a response that arrives after unmount without warnings', async () => {
    const d = deferred<ActionResult<Video | null>>();
    mockedGetTrailer.mockReturnValue(d.promise);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const user = userEvent.setup();
    const { unmount } = renderWithIntl(<TrailerButton {...props} />);
    await openDialog(user);
    unmount();
    await act(async () => d.resolve(ok(video)));
    expect(errorSpy).not.toHaveBeenCalled();
    expect(getIframe()).toBeNull();
    errorSpy.mockRestore();
  });

  it('has an accessible name, returns focus to the trigger and reports open changes', async () => {
    mockedGetTrailer.mockResolvedValue(ok(video));
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    renderWithIntl(<TrailerButton {...props} onOpenChange={onOpenChange} />);
    const trigger = screen.getByRole('button', { name: 'Trailer' });
    await user.click(trigger);
    expect(
      await screen.findByRole('dialog', { name: 'Trailer: Fight Club' })
    ).toBeVisible();
    expect(onOpenChange).toHaveBeenLastCalledWith(true);

    await user.keyboard('{Escape}');
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('uses the Vietnamese messages and locale', async () => {
    mockedGetTrailer.mockResolvedValue(ok(null));
    const user = userEvent.setup();
    renderWithIntl(<TrailerButton {...props} />, 'vi');
    await user.click(screen.getByRole('button', { name: 'Trailer' }));
    expect(await screen.findByText('Chưa có trailer.')).toBeVisible();
    expect(mockedGetTrailer).toHaveBeenCalledWith(
      expect.objectContaining({ locale: 'vi' })
    );
  });
});
