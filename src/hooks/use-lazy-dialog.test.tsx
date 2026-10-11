import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentType } from 'react';
import { useLazyDialog, type LazyDialogProps } from './use-lazy-dialog';

// Minimal stand-in for a Radix dialog: renders only while open and calls
// onCloseAutoFocus on close, like Radix does.
function FakeDialog({ open, onOpenChange, onCloseAutoFocus }: LazyDialogProps) {
  if (!open) return null;
  return (
    <div role="dialog" aria-label="Fake">
      <button
        type="button"
        onClick={() => {
          onOpenChange(false);
          const event = new Event('closeAutoFocus', { cancelable: true });
          onCloseAutoFocus(event);
          if (!event.defaultPrevented) document.body.focus();
        }}
      >
        Close
      </button>
    </div>
  );
}

function Harness({
  load,
  onOpenChange,
}: {
  load: () => Promise<ComponentType<LazyDialogProps>>;
  onOpenChange?: (open: boolean) => void;
}) {
  const { Dialog, triggerProps, dialogProps } = useLazyDialog(load, {
    onOpenChange,
  });
  return (
    <>
      <button {...triggerProps}>Open</button>
      {Dialog && <Dialog {...dialogProps} />}
    </>
  );
}

const trigger = () => screen.getByRole('button', { name: 'Open' });

describe('useLazyDialog', () => {
  it('renders an accessible closed trigger without loading the dialog', () => {
    const load = vi.fn(() => Promise.resolve(FakeDialog));
    render(<Harness load={load} />);

    expect(trigger()).toHaveAttribute('aria-haspopup', 'dialog');
    expect(trigger()).toHaveAttribute('aria-expanded', 'false');
    expect(load).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('warms up on focus and pointer enter, loading only once', async () => {
    const load = vi.fn(() => Promise.resolve(FakeDialog));
    render(<Harness load={load} />);

    act(() => trigger().focus());
    fireEvent.pointerEnter(trigger());
    act(() => trigger().blur());
    act(() => trigger().focus());

    expect(load).toHaveBeenCalledTimes(1);
    // Warming up never opens the dialog.
    await act(async () => {});
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger()).toHaveAttribute('aria-expanded', 'false');
  });

  it('opens by keyboard once the dialog has loaded', async () => {
    const load = vi.fn(() => Promise.resolve(FakeDialog));
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    render(<Harness load={load} onOpenChange={onOpenChange} />);

    await user.tab();
    expect(trigger()).toHaveFocus();
    await user.keyboard('{Enter}');

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(trigger()).toHaveAttribute('aria-expanded', 'true');
    expect(onOpenChange).toHaveBeenLastCalledWith(true);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('returns focus to the trigger on close', async () => {
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    render(
      <Harness
        load={() => Promise.resolve(FakeDialog)}
        onOpenChange={onOpenChange}
      />
    );

    await user.click(trigger());
    await user.click(await screen.findByRole('button', { name: 'Close' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger()).toHaveFocus();
    expect(trigger()).toHaveAttribute('aria-expanded', 'false');
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
  });

  it('resets to closed when loading fails, logs once and retries on the next open', async () => {
    const error = new Error('chunk failed');
    const load = vi
      .fn<() => Promise<ComponentType<LazyDialogProps>>>()
      .mockRejectedValueOnce(error)
      .mockResolvedValueOnce(FakeDialog);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    render(<Harness load={load} onOpenChange={onOpenChange} />);

    // A plain click (no hover warm-up) so this open is the failing load.
    fireEvent.click(trigger());
    await waitFor(() => expect(onOpenChange).toHaveBeenLastCalledWith(false));
    expect(trigger()).toHaveAttribute('aria-expanded', 'false');
    expect(trigger()).not.toHaveAttribute('aria-busy');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('[lazy-dialog]'),
      error
    );

    await user.click(trigger());
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(load).toHaveBeenCalledTimes(2);
    expect(errorSpy).toHaveBeenCalledTimes(1);
    errorSpy.mockRestore();
  });

  describe('while the dialog is still loading', () => {
    function deferredLoad() {
      let resolve!: (c: ComponentType<LazyDialogProps>) => void;
      const promise = new Promise<ComponentType<LazyDialogProps>>(
        (r) => (resolve = r)
      );
      return { load: vi.fn(() => promise), resolve };
    }

    it('marks the trigger busy and expands it only once loaded', async () => {
      const { load, resolve } = deferredLoad();
      render(<Harness load={load} />);

      fireEvent.click(trigger());

      expect(trigger()).toHaveAttribute('aria-busy', 'true');
      expect(trigger()).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

      await act(async () => resolve(FakeDialog));

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(trigger()).toHaveAttribute('aria-expanded', 'true');
      expect(trigger()).not.toHaveAttribute('aria-busy');
    });

    it('cancels the pending open on Escape', async () => {
      const { load, resolve } = deferredLoad();
      const onOpenChange = vi.fn();
      render(<Harness load={load} onOpenChange={onOpenChange} />);

      fireEvent.click(trigger());
      fireEvent.keyDown(trigger(), { key: 'Escape' });

      expect(trigger()).not.toHaveAttribute('aria-busy');
      expect(onOpenChange).toHaveBeenLastCalledWith(false);

      await act(async () => resolve(FakeDialog));

      // Loaded, but the cancelled open must not pop up late.
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(trigger()).toHaveAttribute('aria-expanded', 'false');
    });

    it('ignores Escape when nothing is pending', () => {
      const onOpenChange = vi.fn();
      render(
        <Harness
          load={() => Promise.resolve(FakeDialog)}
          onOpenChange={onOpenChange}
        />
      );

      fireEvent.keyDown(trigger(), { key: 'Escape' });

      expect(onOpenChange).not.toHaveBeenCalled();
    });
  });
});
