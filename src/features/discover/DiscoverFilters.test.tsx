import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import en from '@/messages/en.json';
import type { Genre } from '@/lib/tmdb/types';
import { renderWithIntl } from '../../../tests/utils/render';
import { DiscoverFilters } from './DiscoverFilters';
import { DEFAULT_DISCOVER, type DiscoverParams } from './params';

const push = vi.fn();

vi.mock('@/i18n/navigation', () => ({ useRouter: () => ({ push }) }));

// Radix Select relies on pointer capture and scrollIntoView, which jsdom lacks.
beforeAll(() => {
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.setPointerCapture ??= () => {};
  Element.prototype.releasePointerCapture ??= () => {};
  Element.prototype.scrollIntoView ??= () => {};
});

beforeEach(() => push.mockClear());

// Deliberately not the test machine's year: the list must come from the prop.
const CURRENT_YEAR = 2030;

const genres: Genre[] = [
  { id: 12, name: 'Adventure' },
  { id: 28, name: 'Action' },
  { id: 35, name: 'Comedy' },
];

const value = (overrides: Partial<DiscoverParams> = {}): DiscoverParams => ({
  ...DEFAULT_DISCOVER,
  ...overrides,
});

/** The URL the real next-intl router builds from an object href. */
function pushedUrl(call = push.mock.calls.at(-1)) {
  const [href] = call as [{ pathname: string; query?: Record<string, string> }];
  const query = new URLSearchParams(href.query ?? {}).toString();
  return query ? `${href.pathname}?${query}` : href.pathname;
}

describe('DiscoverFilters', () => {
  it('adds a genre to the selection', async () => {
    const user = userEvent.setup();
    renderWithIntl(
      <DiscoverFilters
        value={value({ genres: [12] })}
        genres={genres}
        currentYear={CURRENT_YEAR}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Action' }));

    expect(push).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith(
      { pathname: '/discover', query: { genres: '12,28' } },
      { scroll: false }
    );
    // next-intl encodes the comma; Next decodes it back before parsing.
    expect(pushedUrl()).toBe('/discover?genres=12%2C28');
  });

  it('removes a selected genre', async () => {
    const user = userEvent.setup();
    renderWithIntl(
      <DiscoverFilters
        value={value({ genres: [12, 28], year: 2020 })}
        genres={genres}
        currentYear={CURRENT_YEAR}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Adventure' }));

    expect(push).toHaveBeenCalledWith(
      { pathname: '/discover', query: { genres: '28', year: '2020' } },
      { scroll: false }
    );
  });

  it('exposes selection with aria-pressed and constant names', () => {
    renderWithIntl(
      <DiscoverFilters
        value={value({ genres: [28] })}
        genres={genres}
        currentYear={CURRENT_YEAR}
      />
    );

    const group = screen.getByRole('group', { name: 'Genres' });
    const chips = within(group).getAllByRole('button');
    expect(chips.map((c) => c.textContent)).toEqual([
      'Adventure',
      'Action',
      'Comedy',
    ]);
    expect(chips.map((c) => c.getAttribute('aria-pressed'))).toEqual([
      'false',
      'true',
      'false',
    ]);

    const types = screen.getByRole('group', { name: 'Type' });
    expect(
      within(types).getByRole('button', { name: 'Movies' })
    ).toHaveAttribute('aria-pressed', 'true');
    expect(
      within(types).getByRole('button', { name: 'TV Series' })
    ).toHaveAttribute('aria-pressed', 'false');
  });

  it('switching type clears genres but keeps year and sort', async () => {
    const user = userEvent.setup();
    renderWithIntl(
      <DiscoverFilters
        value={value({
          genres: [12, 28],
          year: 2020,
          sort: 'vote_average.desc',
        })}
        genres={genres}
        currentYear={CURRENT_YEAR}
      />
    );

    await user.click(screen.getByRole('button', { name: 'TV Series' }));

    expect(push).toHaveBeenCalledWith(
      {
        pathname: '/discover',
        query: { type: 'tv', year: '2020', sort: 'vote_average.desc' },
      },
      { scroll: false }
    );
  });

  it('switches type to tv', async () => {
    const user = userEvent.setup();
    renderWithIntl(
      <DiscoverFilters
        value={value({ genres: [12] })}
        genres={genres}
        currentYear={CURRENT_YEAR}
      />
    );

    await user.click(screen.getByRole('button', { name: 'TV Series' }));

    expect(pushedUrl()).toBe('/discover?type=tv');
  });

  it('does not navigate when the active type is clicked again', async () => {
    const user = userEvent.setup();
    renderWithIntl(
      <DiscoverFilters
        value={value()}
        genres={genres}
        currentYear={CURRENT_YEAR}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Movies' }));

    expect(push).not.toHaveBeenCalled();
  });

  it('picks a year from the current year down to 1950', async () => {
    const user = userEvent.setup();
    const currentYear = CURRENT_YEAR;
    renderWithIntl(
      <DiscoverFilters
        value={value()}
        genres={genres}
        currentYear={CURRENT_YEAR}
      />
    );

    const trigger = screen.getByRole('combobox', { name: 'Year' });
    expect(trigger).toHaveTextContent('All years');
    await user.click(trigger);

    const options = screen.getAllByRole('option');
    expect(options[0]).toHaveTextContent('All years');
    expect(options[1]).toHaveTextContent(String(currentYear));
    expect(options.at(-1)).toHaveTextContent('1950');
    expect(options).toHaveLength(currentYear - 1950 + 2);

    await user.click(screen.getByRole('option', { name: '2001' }));

    expect(push).toHaveBeenCalledWith(
      { pathname: '/discover', query: { year: '2001' } },
      { scroll: false }
    );
  });

  it('"All years" removes the year', async () => {
    const user = userEvent.setup();
    renderWithIntl(
      <DiscoverFilters
        value={value({ type: 'tv', year: 2001 })}
        genres={genres}
        currentYear={CURRENT_YEAR}
      />
    );

    const trigger = screen.getByRole('combobox', { name: 'Year' });
    expect(trigger).toHaveTextContent('2001');
    await user.click(trigger);
    await user.click(screen.getByRole('option', { name: 'All years' }));

    expect(push).toHaveBeenCalledWith(
      { pathname: '/discover', query: { type: 'tv' } },
      { scroll: false }
    );
  });

  it('changes the sort order', async () => {
    const user = userEvent.setup();
    renderWithIntl(
      <DiscoverFilters
        value={value()}
        genres={genres}
        currentYear={CURRENT_YEAR}
      />
    );

    const trigger = screen.getByRole('combobox', { name: 'Sort by' });
    expect(trigger).toHaveTextContent('Most popular');
    await user.click(trigger);
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual([
      'Most popular',
      'Top rated',
      'Newest',
      'Title (A–Z)',
    ]);
    await user.click(screen.getByRole('option', { name: 'Top rated' }));

    expect(push).toHaveBeenCalledWith(
      { pathname: '/discover', query: { sort: 'vote_average.desc' } },
      { scroll: false }
    );
  });

  it('"Clear filters" goes back to /discover', async () => {
    const user = userEvent.setup();
    renderWithIntl(
      <DiscoverFilters
        value={value({ type: 'tv', genres: [12], year: 2001 })}
        genres={genres}
        currentYear={CURRENT_YEAR}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Clear filters' }));

    expect(push).toHaveBeenCalledWith(
      { pathname: '/discover', query: {} },
      { scroll: false }
    );
    expect(pushedUrl()).toBe('/discover');
  });

  it('keeps keyboard focus inside the filters after clearing', async () => {
    const user = userEvent.setup();
    const { rerender } = renderWithIntl(
      <DiscoverFilters
        value={value({ type: 'tv', genres: [12] })}
        genres={genres}
        currentYear={CURRENT_YEAR}
      />
    );

    screen.getByRole('button', { name: 'Clear filters' }).focus();
    await user.keyboard('{Enter}');
    // The navigation lands: the button disappears at the defaults.
    rerender(
      <NextIntlClientProvider locale="en" messages={en}>
        <DiscoverFilters
          value={value()}
          genres={genres}
          currentYear={CURRENT_YEAR}
        />
      </NextIntlClientProvider>
    );

    expect(
      screen.queryByRole('button', { name: 'Clear filters' })
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Movies' })).toHaveFocus();
  });

  it('hides "Clear filters" at the defaults', () => {
    renderWithIntl(
      <DiscoverFilters
        value={value()}
        genres={genres}
        currentYear={CURRENT_YEAR}
      />
    );

    expect(
      screen.queryByRole('button', { name: 'Clear filters' })
    ).not.toBeInTheDocument();
  });

  it('is a labelled region and omits the genre group without genres', () => {
    renderWithIntl(
      <DiscoverFilters value={value()} genres={[]} currentYear={CURRENT_YEAR} />
    );

    expect(screen.getByRole('region', { name: 'Filters' })).toBeVisible();
    expect(
      screen.queryByRole('group', { name: 'Genres' })
    ).not.toBeInTheDocument();
  });
});
