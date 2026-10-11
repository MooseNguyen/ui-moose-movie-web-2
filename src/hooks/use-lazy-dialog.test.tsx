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

  it('resets to closed when loading fails and retries on the next open', async () => {
    const load = vi
      .fn<() => Promise<ComponentType<LazyDialogProps>>>()
      .mockRejectedValueOnce(new Error('chunk failed'))
      .mockResolvedValueOnce(FakeDialog);
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    render(<Harness load={load} onOpenChange={onOpenChange} />);

    // A plain click (no hover warm-up) so this open is the failing load.
    fireEvent.click(trigger());
    await waitFor(() =>
      expect(trigger()).toHaveAttribute('aria-expanded', 'false')
    );
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await user.click(trigger());
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(load).toHaveBeenCalledTimes(2);
  });
});
