import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { MediaItem } from '@/lib/tmdb/types';
import { renderWithIntl } from '../../../tests/utils/render';
import { tvItem } from '../../../tests/fixtures/media';
import { HeroSlider } from './HeroSlider';

vi.mock(
  '@/i18n/navigation',
  () => import('../../../tests/utils/mock-navigation')
);

// Stand-in for the real TrailerButton (covered by TrailerDialog.test): it only
// exposes the onOpenChange callback the slider reacts to.
vi.mock('./TrailerButton', () => ({
  TrailerButton: ({
    title,
    onOpenChange,
  }: {
    title: string;
    onOpenChange?: (open: boolean) => void;
  }) => (
    <>
      <button type="button" onClick={() => onOpenChange?.(true)}>
        Open trailer: {title}
      </button>
      <button type="button" onClick={() => onOpenChange?.(false)}>
        Close trailer: {title}
      </button>
    </>
  ),
}));

// jsdom has no layout, so the real Autoplay plugin refuses to run (it sees a
// single scroll snap). This fake keeps the public API and the emitted event.
type EmblaLike = { emit: (event: 'autoplay:play') => void };
const autoplay = vi.hoisted(() => ({
  options: undefined as Record<string, unknown> | undefined,
  playing: false,
  api: undefined as EmblaLike | undefined,
}));

vi.mock('embla-carousel-autoplay', () => ({
  default: (options: Record<string, unknown>) => {
    autoplay.options = options;
    return {
      name: 'autoplay',
      options,
      init: (api: EmblaLike) => {
        autoplay.api = api;
      },
      destroy: () => {},
      play: () => {
        if (!autoplay.playing) autoplay.api?.emit('autoplay:play');
        autoplay.playing = true;
      },
      stop: () => {
        autoplay.playing = false;
      },
      reset: () => {},
      isPlaying: () => autoplay.playing,
      timeUntilNext: () => null,
    };
  },
}));

let reducedMotion = false;

beforeAll(() => {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query.includes('prefers-reduced-motion') && reducedMotion,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
  }));
  class Stub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  vi.stubGlobal('ResizeObserver', Stub);
  vi.stubGlobal('IntersectionObserver', Stub);
});

beforeEach(() => {
  reducedMotion = false;
  autoplay.playing = false;
  autoplay.api = undefined;
});

const items: MediaItem[] = Array.from({ length: 5 }, (_, i) => ({
  ...tvItem,
  id: 100 + i,
  mediaType: i % 2 === 0 ? 'movie' : 'tv',
  title: `Title ${i + 1}`,
  backdropPath: `/backdrop-${i + 1}.jpg`,
}));

const pauseButton = () =>
  screen.getByRole('button', { name: 'Pause slideshow' });

async function renderSlider(list = items) {
  const view = renderWithIntl(<HeroSlider items={list} />);
  // Embla initialises in an effect; autoplay is driven once the api exists.
  await waitFor(() => expect(autoplay.api).toBeDefined());
  return view;
}

describe('HeroSlider', () => {
  it('configures autoplay for 5s, hover/focus pause and no autoplay on init', async () => {
    await renderSlider();
    expect(autoplay.options).toMatchObject({
      delay: 5000,
      playOnInit: false,
      stopOnMouseEnter: true,
      stopOnInteraction: false,
      stopOnFocusIn: true,
    });
  });

  it('links Details to the detail page of the right media type', async () => {
    const tv = { ...tvItem, id: 1399 };
    await renderSlider([tv]);
    expect(
      screen.getByRole('link', { name: 'Details: Game of Thrones' })
    ).toHaveAttribute('href', '/en/tv/1399');
  });

  it('labels the region and each slide as "N of total"', async () => {
    await renderSlider();
    const region = screen.getByRole('region', { name: 'Trending this week' });
    expect(region).toHaveAttribute('aria-roledescription', 'carousel');
    const slide = screen.getByRole('group', { name: '1 of 5' });
    expect(slide).toHaveAttribute('aria-roledescription', 'slide');
    expect(
      within(slide).getByRole('heading', { level: 2, name: 'Title 1' })
    ).toBeInTheDocument();
  });

  it('renders 5 labelled dots with the current one marked', async () => {
    await renderSlider();
    const dots = within(
      screen.getByRole('group', { name: 'Choose a slide' })
    ).getAllByRole('button');
    expect(dots).toHaveLength(5);
    dots.forEach((dot, i) =>
      expect(dot).toHaveAccessibleName(`Go to slide ${i + 1}`)
    );
    expect(dots[0]).toHaveAttribute('aria-current', 'true');
    dots
      .slice(1)
      .forEach((dot) => expect(dot).not.toHaveAttribute('aria-current'));
  });

  it('moves to a slide from its dot and makes only that slide interactive', async () => {
    const user = userEvent.setup();
    await renderSlider();
    const dot = screen.getByRole('button', { name: 'Go to slide 3' });
    await user.click(dot);

    await waitFor(() => expect(dot).toHaveAttribute('aria-current', 'true'));
    expect(screen.getByRole('group', { name: '3 of 5' })).not.toHaveAttribute(
      'inert'
    );
    expect(screen.getByRole('group', { name: '1 of 5' })).toHaveAttribute(
      'inert'
    );
  });

  it('has translated previous/next arrows', async () => {
    await renderSlider();
    expect(
      screen.getByRole('button', { name: 'Previous slide' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Next slide' })
    ).toBeInTheDocument();
  });

  it('loads the first backdrop eagerly with high priority and lazy-loads the rest', async () => {
    const { container } = await renderSlider();
    const backdrops = container.querySelectorAll('img[sizes="100vw"]');
    expect(backdrops).toHaveLength(5);
    expect(backdrops[0]).not.toHaveAttribute('loading', 'lazy');
    expect(backdrops[0]).toHaveAttribute('fetchpriority', 'high');
    [...backdrops]
      .slice(1)
      .forEach((img) => expect(img).toHaveAttribute('loading', 'lazy'));
  });

  it('autoplays and the pause toggle stops and restarts it', async () => {
    const user = userEvent.setup();
    await renderSlider();
    await waitFor(() => expect(autoplay.playing).toBe(true));
    expect(pauseButton()).toHaveAttribute('aria-pressed', 'false');

    await user.click(pauseButton());
    expect(pauseButton()).toHaveAttribute('aria-pressed', 'true');
    expect(autoplay.playing).toBe(false);

    await user.click(pauseButton());
    expect(pauseButton()).toHaveAttribute('aria-pressed', 'false');
    expect(autoplay.playing).toBe(true);
  });

  it('keeps a manual pause when hover/focus handling restarts autoplay', async () => {
    const user = userEvent.setup();
    await renderSlider();
    await user.click(pauseButton());

    // What the plugin does on mouseleave / focusout: restart and emit.
    await act(async () => {
      autoplay.playing = true;
      autoplay.api?.emit('autoplay:play');
    });
    expect(autoplay.playing).toBe(false);
  });

  it('pauses while keyboard focus is in the region and resumes when it leaves', async () => {
    const user = userEvent.setup();
    renderWithIntl(
      <>
        <HeroSlider items={items} />
        <button type="button">Outside</button>
      </>
    );
    await waitFor(() => expect(autoplay.playing).toBe(true));

    await user.tab(); // the pause toggle is the region's first tab stop
    expect(pauseButton()).toHaveFocus();
    expect(autoplay.playing).toBe(false);
    expect(pauseButton()).toHaveAttribute('aria-pressed', 'true');

    // Moving within the region keeps it paused.
    await user.tab();
    expect(autoplay.playing).toBe(false);

    act(() => screen.getByRole('button', { name: 'Outside' }).focus());
    expect(autoplay.playing).toBe(true);
    expect(pauseButton()).toHaveAttribute('aria-pressed', 'false');
  });

  it('plays when the user presses play while focus is inside', async () => {
    const user = userEvent.setup();
    await renderSlider();
    await waitFor(() => expect(autoplay.playing).toBe(true));

    await user.tab();
    expect(autoplay.playing).toBe(false);
    await user.keyboard('{Enter}');
    expect(autoplay.playing).toBe(true);
    expect(pauseButton()).toHaveAttribute('aria-pressed', 'false');
  });

  it('stays paused when focus leaves the region after a manual pause', async () => {
    const user = userEvent.setup();
    renderWithIntl(
      <>
        <HeroSlider items={items} />
        <button type="button">Outside</button>
      </>
    );
    await waitFor(() => expect(autoplay.playing).toBe(true));

    await user.click(pauseButton());
    act(() => screen.getByRole('button', { name: 'Outside' }).focus());
    expect(autoplay.playing).toBe(false);
    expect(pauseButton()).toHaveAttribute('aria-pressed', 'true');
  });

  it('jumps instead of animating under reduced motion', async () => {
    reducedMotion = true;
    await renderSlider();
    // Read through the plugin's Embla instance: the media query resolved.
    const api = autoplay.api as unknown as {
      internalEngine: () => { options: { duration: number } };
    };
    expect(api.internalEngine().options.duration).toBe(0);
  });

  it('does not autoplay when the user prefers reduced motion', async () => {
    reducedMotion = true;
    await renderSlider();
    // Give effects a chance to (wrongly) start autoplay.
    await act(async () => {});
    expect(autoplay.playing).toBe(false);
    expect(pauseButton()).toHaveAttribute('aria-pressed', 'true');
  });

  it('pauses while a trailer is open and resumes when it closes', async () => {
    const user = userEvent.setup();
    await renderSlider();
    await waitFor(() => expect(autoplay.playing).toBe(true));

    await user.click(
      screen.getByRole('button', { name: 'Open trailer: Title 1' })
    );
    expect(autoplay.playing).toBe(false);

    await user.click(
      screen.getByRole('button', { name: 'Close trailer: Title 1' })
    );
    expect(autoplay.playing).toBe(true);
  });

  it('stays paused after a trailer closes if the user paused manually', async () => {
    const user = userEvent.setup();
    await renderSlider();
    await user.click(pauseButton());

    await user.click(
      screen.getByRole('button', { name: 'Open trailer: Title 1' })
    );
    await user.click(
      screen.getByRole('button', { name: 'Close trailer: Title 1' })
    );
    expect(autoplay.playing).toBe(false);
  });

  it('renders favorite buttons for the slides', async () => {
    await renderSlider();
    expect(
      screen.getByRole('button', { name: 'Favorite: Title 1' })
    ).toBeInTheDocument();
  });

  it('renders nothing without items', () => {
    const { container } = renderWithIntl(<HeroSlider items={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
