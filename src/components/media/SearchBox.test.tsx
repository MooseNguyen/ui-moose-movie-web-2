import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithIntl } from '../../../tests/utils/render';
import { SearchBox } from './SearchBox';

const push = vi.fn();

vi.mock('@/i18n/navigation', () => ({ useRouter: () => ({ push }) }));

beforeEach(() => push.mockClear());

describe('SearchBox', () => {
  it('pushes encoded Vietnamese query on Enter', async () => {
    const user = userEvent.setup();
    renderWithIntl(<SearchBox />);

    await user.type(screen.getByRole('searchbox'), '  người nhện {enter}');

    // An object href: next-intl encodes the query, the string stays exact.
    expect(push).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith({
      pathname: '/search',
      query: { q: 'người nhện', type: 'multi' },
    });
  });

  it('does not push for whitespace only', async () => {
    const onSubmitted = vi.fn();
    const user = userEvent.setup();
    renderWithIntl(<SearchBox onSubmitted={onSubmitted} />);

    await user.type(screen.getByRole('searchbox'), '   {enter}');
    await user.click(screen.getByRole('button', { name: 'Search' }));

    expect(push).not.toHaveBeenCalled();
    expect(onSubmitted).not.toHaveBeenCalled();
  });

  it('Enter outside the input does nothing', async () => {
    const user = userEvent.setup();
    renderWithIntl(<SearchBox defaultValue="dune" />);

    fireEvent.keyDown(document.body, { key: 'Enter' });
    fireEvent.keyUp(document.body, { key: 'Enter' });
    await user.keyboard('{Enter}');

    expect(document.activeElement).toBe(document.body);
    expect(push).not.toHaveBeenCalled();
  });

  it('keeps the current type and submits with the button', async () => {
    const user = userEvent.setup();
    renderWithIntl(<SearchBox type="tv" />);

    await user.type(screen.getByRole('searchbox'), 'a/b');
    await user.click(screen.getByRole('button', { name: 'Search' }));

    expect(push).toHaveBeenCalledWith({
      pathname: '/search',
      query: { q: 'a/b', type: 'tv' },
    });
  });

  it.each(['50%', 'người nhện', 'a/b'])(
    'shows the default value %j exactly and submits it unchanged',
    async (value) => {
      const user = userEvent.setup();
      renderWithIntl(<SearchBox defaultValue={value} type="person" />);

      expect(screen.getByRole('searchbox')).toHaveValue(value);
      await user.click(screen.getByRole('button', { name: 'Search' }));

      expect(push).toHaveBeenCalledWith({
        pathname: '/search',
        query: { q: value, type: 'person' },
      });
    }
  );

  it('is a labelled search form with a search-keyboard input', () => {
    renderWithIntl(<SearchBox />);

    expect(screen.getByRole('search')).toBeInTheDocument();
    const input = screen.getByRole('searchbox', { name: 'Search keyword' });
    expect(input).toHaveAttribute('type', 'search');
    expect(input).toHaveAttribute('name', 'q');
    expect(input).toHaveAttribute('enterkeyhint', 'search');
    expect(screen.getByRole('button', { name: 'Search' })).toHaveAttribute(
      'type',
      'submit'
    );
  });

  it('limits the input to the shared max query length', async () => {
    const user = userEvent.setup();
    renderWithIntl(<SearchBox />);
    const input = screen.getByRole('searchbox');

    expect(input).toHaveAttribute('maxlength', '100');
    await user.type(input, 'x'.repeat(150));
    expect(input).toHaveValue('x'.repeat(100));
  });

  it('calls onSubmitted only after a real submit', async () => {
    const onSubmitted = vi.fn();
    const user = userEvent.setup();
    renderWithIntl(<SearchBox onSubmitted={onSubmitted} />);

    await user.type(screen.getByRole('searchbox'), 'dune');
    expect(onSubmitted).not.toHaveBeenCalled();

    await user.keyboard('{Enter}');
    expect(onSubmitted).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledTimes(1);
  });

  it('focuses the input when autoFocus is set', () => {
    renderWithIntl(<SearchBox autoFocus />);
    expect(screen.getByRole('searchbox')).toHaveFocus();
  });

  it('renders Vietnamese labels', () => {
    renderWithIntl(<SearchBox />, 'vi');
    expect(
      screen.getByRole('searchbox', { name: 'Từ khóa tìm kiếm' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Tìm kiếm' })
    ).toBeInTheDocument();
  });
});
