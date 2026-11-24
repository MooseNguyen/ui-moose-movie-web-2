import {
  act,
  cleanup,
  fireEvent,
  screen,
  within,
} from '@testing-library/react';
import type { MediaItem } from '@/lib/tmdb/types';
import { renderWithIntl } from '../../../tests/utils/render';
import { tvItem } from '../../../tests/fixtures/media';
import { AUTO_ADVANCE_MS, Hero3D } from './Hero3D';
import type { HeroScene, HeroSceneOptions } from './hero-scene';

const mocks = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock('@/i18n/navigation', async () => ({
  ...(await import('../../../tests/utils/mock-navigation')),
  useRouter: () => ({ push: mocks.push }),
}));
// Stand-in for the real TrailerButton (covered by TrailerDialog.test).
vi.mock('@/components/media/TrailerButton', () => ({
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

const items: MediaItem[] = [
  { ...tvItem, id: 1, title: 'First' },
  { ...tvItem, id: 2, title: 'Second' },
  { ...tvItem, id: 3, title: 'Third', posterPath: null },
];

let scene: {
  select: ReturnType<typeof vi.fn>;
  setScrollProgress: ReturnType<typeof vi.fn>;
  dispose: ReturnType<typeof vi.fn>;
};
let sceneOptions: HeroSceneOptions;
let createScene: ReturnType<typeof vi.fn>;
let onFail: ReturnType<typeof vi.fn<() => void>>;
let intersect: (isIntersecting: boolean) => void;

beforeEach(() => {
  vi.useFakeTimers();
  scene = { select: vi.fn(), setScrollProgress: vi.fn(), dispose: vi.fn() };
  createScene = vi.fn(
    (_c: HTMLElement, _i: unknown, options: HeroSceneOptions) => {
      sceneOptions = options;
      return scene as unknown as HeroScene;
    }
  );
  onFail = vi.fn();
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(callback: IntersectionObserverCallback) {
        intersect = (isIntersecting) =>
          callback(
            [{ isIntersecting } as IntersectionObserverEntry],
            this as unknown as IntersectionObserver
          );
      }
      observe() {}
      disconnect() {}
    }
  );
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  mocks.push.mockReset();
});

function renderHero() {
  return renderWithIntl(
    <Hero3D items={items} createScene={createScene as never} onFail={onFail} />
  );
}

const title = () => screen.getByRole('heading', { level: 2 }).textContent;
const advance = (ms = AUTO_ADVANCE_MS) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });

it('renders the selected title as HTML over a decorative canvas', () => {
  renderHero();
  const region = screen.getByRole('region', { name: 'Trending this week' });
  expect(region).toHaveAttribute('aria-roledescription', 'carousel');
  expect(screen.getByTestId('hero-3d-canvas')).toHaveAttribute(
    'aria-hidden',
    'true'
  );
  expect(title()).toBe('First');
  expect(screen.getByRole('link', { name: 'Details: First' })).toHaveAttribute(
    'href',
    '/en/tv/1'
  );
  expect(createScene).toHaveBeenCalledWith(
    screen.getByTestId('hero-3d-canvas'),
    [
      { id: 1, posterPath: tvItem.posterPath },
      { id: 2, posterPath: tvItem.posterPath },
      { id: 3, posterPath: null },
    ],
    expect.objectContaining({ initialIndex: 0, pointerTarget: region })
  );
});

it('shows the canvas once the scene is ready', () => {
  renderHero();
  const region = screen.getByTestId('hero-3d');
  expect(region).not.toHaveAttribute('data-ready');
  act(() => sceneOptions.onReady?.());
  expect(region).toHaveAttribute('data-ready', 'true');
});

it('moves between titles with the buttons, the dots and the arrow keys', () => {
  renderHero();
  fireEvent.click(screen.getByRole('button', { name: 'Next slide' }));
  expect(title()).toBe('Second');
  expect(scene.select).toHaveBeenLastCalledWith(1);

  fireEvent.click(screen.getByRole('button', { name: 'Previous slide' }));
  fireEvent.click(screen.getByRole('button', { name: 'Previous slide' }));
  // Wraps from the first title to the last.
  expect(title()).toBe('Third');

  const dots = screen.getByRole('group', { name: 'Choose a slide' });
  fireEvent.click(within(dots).getByRole('button', { name: 'Go to slide 2' }));
  expect(title()).toBe('Second');
  expect(
    within(dots).getByRole('button', { name: 'Go to slide 2' })
  ).toHaveAttribute('aria-current', 'true');

  fireEvent.keyDown(screen.getByTestId('hero-3d'), { key: 'ArrowRight' });
  expect(title()).toBe('Third');
});

it('advances by itself and wraps around', () => {
  renderHero();
  advance();
  expect(title()).toBe('Second');
  advance();
  advance();
  expect(title()).toBe('First');
});

it('stops advancing when paused with the toggle', () => {
  renderHero();
  const toggle = screen.getByRole('button', { name: 'Pause slideshow' });
  expect(toggle).toHaveAttribute('aria-pressed', 'false');
  fireEvent.click(toggle);
  expect(toggle).toHaveAttribute('aria-pressed', 'true');
  advance(AUTO_ADVANCE_MS * 3);
  expect(title()).toBe('First');

  fireEvent.click(toggle);
  advance();
  expect(title()).toBe('Second');
});

it('holds while the pointer is over the text or a trailer is open', () => {
  renderHero();
  const slide = screen.getByRole('group', { name: '1 of 3' });
  fireEvent.pointerEnter(slide);
  advance(AUTO_ADVANCE_MS * 2);
  expect(title()).toBe('First');
  fireEvent.pointerLeave(slide);

  fireEvent.click(screen.getByRole('button', { name: 'Open trailer: First' }));
  advance(AUTO_ADVANCE_MS * 2);
  expect(title()).toBe('First');
  fireEvent.click(screen.getByRole('button', { name: 'Close trailer: First' }));
  advance();
  expect(title()).toBe('Second');
});

it('holds while keyboard focus is inside', () => {
  renderHero();
  fireEvent.keyDown(window, { key: 'Tab' });
  act(() => screen.getByRole('button', { name: 'Next slide' }).focus());
  advance(AUTO_ADVANCE_MS * 2);
  expect(title()).toBe('First');
  // The toggle shows the hold, and announcements are on.
  expect(
    screen.getByRole('button', { name: 'Pause slideshow' })
  ).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByRole('group', { name: '1 of 3' })).toHaveAttribute(
    'aria-live',
    'polite'
  );
});

it('holds while off screen', () => {
  renderHero();
  act(() => intersect(false));
  advance(AUTO_ADVANCE_MS * 2);
  expect(title()).toBe('First');
  act(() => intersect(true));
  advance();
  expect(title()).toBe('Second');
});

it('selects a card clicked on the canvas and opens the front one', () => {
  renderHero();
  act(() => sceneOptions.onPick(2));
  expect(title()).toBe('Third');
  expect(mocks.push).not.toHaveBeenCalled();

  act(() => sceneOptions.onPick(2));
  expect(mocks.push).toHaveBeenCalledWith('/tv/3');
});

it('reports a scene that cannot start', () => {
  const error = vi.spyOn(console, 'error').mockImplementation(() => {});
  createScene.mockImplementation(() => {
    throw new Error('no WebGL');
  });
  renderHero();
  expect(onFail).toHaveBeenCalledOnce();
  expect(error).toHaveBeenCalledWith(
    '[hero-3d]',
    expect.any(String),
    expect.any(Error)
  );
});

it('reports a scene that breaks later, once', () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  renderHero();
  act(() => {
    sceneOptions.onError?.(new Error('context lost'));
    sceneOptions.onError?.(new Error('context lost'));
  });
  expect(onFail).toHaveBeenCalledOnce();
});

it('feeds the scroll position to the scene', () => {
  vi.stubGlobal('requestAnimationFrame', (callback: () => void) => {
    callback();
    return 1;
  });
  renderHero();
  const region = screen.getByTestId('hero-3d');
  region.getBoundingClientRect = () => ({ top: -300, height: 600 }) as DOMRect;
  fireEvent.scroll(window);
  expect(scene.setScrollProgress).toHaveBeenLastCalledWith(0.5);
});

it('disposes the scene on unmount', () => {
  const { unmount } = renderHero();
  unmount();
  expect(scene.dispose).toHaveBeenCalledOnce();
});
