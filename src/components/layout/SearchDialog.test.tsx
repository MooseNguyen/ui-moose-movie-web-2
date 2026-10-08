import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithIntl } from '../../../tests/utils/render';
import { SearchDialog } from './SearchDialog';

const push = vi.fn();

vi.mock('@/i18n/navigation', () => ({ useRouter: () => ({ push }) }));

beforeEach(() => push.mockClear());

const trigger = () => screen.getByRole('button', { name: 'Search' });

describe('SearchDialog', () => {
  it('renders only an accessible trigger until opened', () => {
    renderWithIntl(<SearchDialog />);

    expect(trigger()).toHaveAttribute('aria-haspopup', 'dialog');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
  });

  it('opens a titled dialog with the search input focused', async () => {
    const user = userEvent.setup();
    renderWithIntl(<SearchDialog />);

    await user.click(trigger());

    expect(
      screen.getByRole('dialog', {
        name: 'Search movies, TV series and people',
      })
    ).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('searchbox')).toHaveFocus());
  });

  it('closes after a submit and returns focus to the trigger', async () => {
    const user = userEvent.setup();
    renderWithIntl(<SearchDialog />);

    await user.click(trigger());
    await user.type(screen.getByRole('searchbox'), ' người nhện {enter}');

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
    await user.type(screen.getByRole('searchbox'), '  {enter}');

    expect(push).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('closes on Escape and returns focus to the trigger', async () => {
    const user = userEvent.setup();
    renderWithIntl(<SearchDialog />);

    await user.click(trigger());
    await user.keyboard('{Escape}');

    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    );
    expect(trigger()).toHaveFocus();
    expect(push).not.toHaveBeenCalled();
  });
});
