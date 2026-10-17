import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithIntl } from '../../../tests/utils/render';
import { SearchDialog } from './SearchDialog';

const push = vi.fn();

vi.mock('@/i18n/navigation', async () => ({
  ...(await import('../../../tests/utils/mock-navigation')),
  useRouter: () => ({ push }),
}));
// Suggestions are covered by SearchCombobox and its hook; no fetches here.
vi.mock('@/hooks/use-search-suggestions', () => ({
  useSearchSuggestions: () => ({ status: 'idle', items: [] }),
}));

// Records every render of the lazily loaded dialog, so a test can tell
// whether its chunk was loaded without opening it.
const contentRendered = vi.hoisted(() => vi.fn());
vi.mock('./SearchDialogContent', async (importOriginal) => {
  const mod = await importOriginal<typeof import('./SearchDialogContent')>();
  return {
    SearchDialogContent: (
      props: React.ComponentProps<typeof mod.SearchDialogContent>
    ) => {
      contentRendered(props);
      return <mod.SearchDialogContent {...props} />;
    },
  };
});

beforeEach(() => {
  push.mockClear();
  contentRendered.mockClear();
});

const trigger = () => screen.getByRole('button', { name: 'Search' });

describe('SearchDialog', () => {
  it('renders only an accessible trigger until opened', () => {
    renderWithIntl(<SearchDialog />);

    expect(trigger()).toHaveAttribute('aria-haspopup', 'dialog');
    expect(trigger()).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(contentRendered).not.toHaveBeenCalled();
  });

  it('loads the dialog when the trigger gets focus, without opening it', async () => {
    renderWithIntl(<SearchDialog />);

    act(() => trigger().focus());

    await waitFor(() =>
      expect(contentRendered).toHaveBeenCalledWith(
        expect.objectContaining({ open: false })
      )
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens from the keyboard', async () => {
    const user = userEvent.setup();
    renderWithIntl(<SearchDialog />);
    // Captured up front: once the modal is open, Radix hides the rest of the
    // page from the accessibility tree.
    const button = trigger();

    await user.tab();
    expect(button).toHaveFocus();
    await user.keyboard('{Enter}');

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(button).toHaveAttribute('aria-expanded', 'true');
    await waitFor(() => expect(screen.getByRole('combobox')).toHaveFocus());
  });

  it('opens a titled dialog with the search input focused', async () => {
    const user = userEvent.setup();
    renderWithIntl(<SearchDialog />);

    await user.click(trigger());

    expect(
      await screen.findByRole('dialog', {
        name: 'Search movies, TV series and people',
      })
    ).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('combobox')).toHaveFocus());
  });

  it('closes after a submit and returns focus to the trigger', async () => {
    const user = userEvent.setup();
    renderWithIntl(<SearchDialog />);

    await user.click(trigger());
    await user.type(await screen.findByRole('combobox'), ' người nhện {enter}');

    expect(push).toHaveBeenCalledWith({
      pathname: '/search',
      query: { q: 'người nhện', type: 'multi' },
    });
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    );
    expect(trigger()).toHaveFocus();
  });

  it('stays open when the query is empty', async () => {
    const user = userEvent.setup();
    renderWithIntl(<SearchDialog />);

    await user.click(trigger());
    await user.type(await screen.findByRole('combobox'), '  {enter}');

    expect(push).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('advertises its keyboard shortcut', () => {
    renderWithIntl(<SearchDialog />);

    expect(trigger()).toHaveAttribute('aria-keyshortcuts', 'Control+K Meta+K');
  });

  it.each([
    ['Ctrl+K', '{Control>}k{/Control}'],
    ['⌘K', '{Meta>}k{/Meta}'],
  ])(
    '%s toggles the dialog from anywhere on the page',
    async (_label, keys) => {
      const user = userEvent.setup();
      renderWithIntl(<SearchDialog />);

      await user.keyboard(keys);
      expect(await screen.findByRole('dialog')).toBeInTheDocument();
      await waitFor(() => expect(screen.getByRole('combobox')).toHaveFocus());
      expect(screen.getByText('Ctrl K')).toBeInTheDocument();

      await user.keyboard(keys);
      await waitFor(() =>
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      );
    }
  );

  it.each([
    ['k alone', 'k'],
    ['Ctrl+Shift+K', '{Control>}{Shift>}k{/Shift}{/Control}'],
    ['Ctrl+Alt+K', '{Control>}{Alt>}k{/Alt}{/Control}'],
  ])('ignores %s', async (_label, keys) => {
    const user = userEvent.setup();
    renderWithIntl(<SearchDialog />);

    await user.keyboard(keys);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(contentRendered).not.toHaveBeenCalledWith(
      expect.objectContaining({ open: true })
    );
  });

  it('closes on Escape and returns focus to the trigger', async () => {
    const user = userEvent.setup();
    renderWithIntl(<SearchDialog />);

    await user.click(trigger());
    await screen.findByRole('dialog');
    await user.keyboard('{Escape}');

    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    );
    expect(trigger()).toHaveFocus();
    expect(trigger()).toHaveAttribute('aria-expanded', 'false');
    expect(push).not.toHaveBeenCalled();
  });
});
