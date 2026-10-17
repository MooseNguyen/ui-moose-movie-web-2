import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { SuggestState } from '@/hooks/use-search-suggestions';
import { useSearchSuggestions } from '@/hooks/use-search-suggestions';
import type { Suggestion } from '@/lib/search-suggest';
import { renderWithIntl } from '../../../tests/utils/render';
import { SearchCombobox } from './SearchCombobox';

const push = vi.fn();

vi.mock('@/i18n/navigation', async () => ({
  ...(await import('../../../tests/utils/mock-navigation')),
  useRouter: () => ({ push }),
}));
vi.mock('@/hooks/use-search-suggestions', () => ({
  useSearchSuggestions: vi.fn(),
}));

const suggest = vi.mocked(useSearchSuggestions);

const items: Suggestion[] = [
  {
    id: 1,
    mediaType: 'movie',
    title: 'The Batman',
    year: 2022,
    imagePath: '/a.jpg',
  },
  { id: 2, mediaType: 'tv', title: 'Batman', year: 1966, imagePath: null },
  {
    id: 3,
    mediaType: 'person',
    title: 'Christian Bale',
    year: null,
    imagePath: null,
  },
];

function withState(state: SuggestState) {
  suggest.mockReturnValue(state);
}

const input = () => screen.getByRole('combobox', { name: 'Search keyword' });
const options = () => screen.getAllByRole('option');
const active = () =>
  document.getElementById(input().getAttribute('aria-activedescendant') ?? '');

async function typeQuery(text = 'batman') {
  const user = userEvent.setup();
  const onNavigate = vi.fn();
  renderWithIntl(<SearchCombobox onNavigate={onNavigate} />);
  await user.type(input(), text);
  return { user, onNavigate };
}

beforeEach(() => {
  push.mockClear();
  withState({ status: 'idle', items: [] });
});

describe('SearchCombobox', () => {
  it('is a collapsed combobox until there is something to suggest', () => {
    renderWithIntl(<SearchCombobox onNavigate={vi.fn()} />);

    expect(input()).toHaveAttribute('aria-expanded', 'false');
    expect(input()).toHaveAttribute('aria-autocomplete', 'list');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('asks for suggestions for the typed query in the current locale', async () => {
    await typeQuery('bat');

    expect(suggest).toHaveBeenLastCalledWith('bat', 'en');
  });

  it('lists suggestions as links, then a "see all" option', async () => {
    withState({ status: 'success', items });
    await typeQuery();

    expect(input()).toHaveAttribute('aria-expanded', 'true');
    const listbox = screen.getByRole('listbox', { name: 'Suggestions' });
    expect(input()).toHaveAttribute('aria-controls', listbox.id);
    expect(options().map((o) => o.getAttribute('href'))).toEqual([
      '/en/movie/1',
      '/en/tv/2',
      '/en/person/3',
      '/en/search?q=batman&type=multi',
    ]);
    expect(options()[0]).toHaveAccessibleName(/The Batman.*2022.*Movies/);
    expect(options()[2]).toHaveAccessibleName(/Christian Bale.*People/);
    expect(options()[3]).toHaveAccessibleName('See all results for “batman”');
    expect(options().every((o) => o.tabIndex === -1)).toBe(true);
  });

  it('moves the active option with the arrow keys, wrapping at both ends', async () => {
    withState({ status: 'success', items });
    const { user } = await typeQuery();

    expect(input()).not.toHaveAttribute('aria-activedescendant');
    await user.keyboard('{ArrowDown}');
    expect(active()).toBe(options()[0]);
    expect(options()[0]).toHaveAttribute('aria-selected', 'true');
    expect(options()[1]).toHaveAttribute('aria-selected', 'false');

    await user.keyboard('{ArrowUp}');
    expect(active()).toBe(options()[3]);
    await user.keyboard('{ArrowDown}');
    expect(active()).toBe(options()[0]);
    // Focus never leaves the input (aria-activedescendant pattern).
    expect(input()).toHaveFocus();
  });

  it('opens the active suggestion on Enter', async () => {
    withState({ status: 'success', items });
    const { user, onNavigate } = await typeQuery();

    await user.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}{Enter}');

    expect(push).toHaveBeenCalledExactlyOnceWith('/person/3');
    expect(onNavigate).toHaveBeenCalledOnce();
  });

  it.each([
    ['nothing is active', '{Enter}'],
    ['"see all" is active', '{ArrowUp}{Enter}'],
  ])('goes to the results page when %s', async (_label, keys) => {
    withState({ status: 'success', items });
    const { user, onNavigate } = await typeQuery('  người nhện ');

    await user.keyboard(keys);

    expect(push).toHaveBeenCalledExactlyOnceWith({
      pathname: '/search',
      query: { q: 'người nhện', type: 'multi' },
    });
    expect(onNavigate).toHaveBeenCalledOnce();
  });

  it('forgets the active option when the query changes', async () => {
    withState({ status: 'success', items });
    const { user } = await typeQuery();

    await user.keyboard('{ArrowDown}');
    await user.type(input(), ' 2');

    expect(input()).not.toHaveAttribute('aria-activedescendant');
  });

  it('closes the dialog when a suggestion is clicked', async () => {
    withState({ status: 'success', items });
    const { onNavigate } = await typeQuery();

    // jsdom cannot navigate; the click itself is what matters.
    const link = options()[1];
    link.addEventListener('click', (event) => event.preventDefault());
    fireEvent.click(link);

    expect(onNavigate).toHaveBeenCalledOnce();
  });

  it('does not treat keys as commands while an IME is composing', async () => {
    withState({ status: 'success', items });
    const { onNavigate } = await typeQuery('ng');
    suggest.mockClear();

    fireEvent.compositionStart(input());
    fireEvent.change(input(), { target: { value: 'ngươ' } });
    // Mid-composition text is not a query yet.
    expect(suggest).toHaveBeenLastCalledWith('ng', 'en');
    fireEvent.keyDown(input(), { key: 'ArrowDown', isComposing: true });
    fireEvent.keyDown(input(), { key: 'Enter', isComposing: true });
    expect(input()).not.toHaveAttribute('aria-activedescendant');
    expect(push).not.toHaveBeenCalled();
    expect(onNavigate).not.toHaveBeenCalled();

    fireEvent.change(input(), { target: { value: 'người' } });
    fireEvent.compositionEnd(input());
    expect(suggest).toHaveBeenLastCalledWith('người', 'en');
  });

  it.each<[string, SuggestState, string]>([
    ['loading', { status: 'loading', items: [] }, 'Searching…'],
    ['empty', { status: 'success', items: [] }, 'No suggestions for “zzz”.'],
    [
      'error',
      { status: 'error', items: [] },
      'Could not load suggestions. Press Enter to see the results page.',
    ],
  ])(
    'shows the %s state, keeping "see all" available',
    async (_label, state, text) => {
      withState(state);
      await typeQuery('zzz');

      // Shown once on screen; screen readers get it from the status region.
      expect(
        screen.getByText(text, { selector: 'p[aria-hidden="true"]' })
      ).toBeVisible();
      expect(options()).toHaveLength(1);
    }
  );

  it('announces how many suggestions arrived, but not the loading state', async () => {
    withState({ status: 'loading', items: [] });
    const { user } = await typeQuery();
    expect(screen.getByRole('status')).toHaveTextContent('');

    withState({ status: 'success', items });
    await user.type(input(), 's');

    expect(screen.getByRole('status')).toHaveTextContent('3 suggestions');
  });

  it('pushes nothing for a blank query', async () => {
    const { user, onNavigate } = await typeQuery('   ');

    await user.keyboard('{Enter}');

    expect(push).not.toHaveBeenCalled();
    expect(onNavigate).not.toHaveBeenCalled();
  });
});
