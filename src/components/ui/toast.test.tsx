import { act, fireEvent, render, screen } from '@testing-library/react';

// The module keeps "a toast was requested" in module state: load a fresh
// copy per test, as a fresh page would.
async function loadToastModule() {
  vi.resetModules();
  return import('./toast');
}

describe('LazyToaster', () => {
  it('renders nothing until a toast is requested', async () => {
    const { LazyToaster } = await loadToastModule();
    const { container } = render(<LazyToaster />);

    expect(container).toBeEmptyDOMElement();
  });

  it('shows a toast requested before the Toaster has loaded', async () => {
    const { LazyToaster, showToast } = await loadToastModule();
    render(<LazyToaster />);

    act(() => showToast('Saved for later'));

    expect(await screen.findByText('Saved for later')).toBeInTheDocument();
  });

  it('runs the toast action when its button is clicked', async () => {
    const { LazyToaster, showToast } = await loadToastModule();
    const onUndo = vi.fn();
    render(<LazyToaster />);

    act(() =>
      showToast('Removed', { action: { label: 'Undo', onClick: onUndo } })
    );
    // fireEvent, not userEvent: sonner calls setPointerCapture on pointerdown,
    // which jsdom does not implement.
    fireEvent.click(await screen.findByRole('button', { name: 'Undo' }));

    expect(onUndo).toHaveBeenCalledTimes(1);
  });
});

describe('showToast', () => {
  afterEach(() => {
    vi.doUnmock('sonner');
    vi.restoreAllMocks();
  });

  it('logs instead of failing silently when the toast library cannot load', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    vi.doMock('sonner', () => {
      throw new Error('offline');
    });
    const { showToast } = await loadToastModule();

    showToast('Saved for later');

    await vi.waitFor(() =>
      expect(consoleError).toHaveBeenCalledWith(
        '[toast] Failed to load the toast library:',
        expect.any(Error)
      )
    );
  });
});
