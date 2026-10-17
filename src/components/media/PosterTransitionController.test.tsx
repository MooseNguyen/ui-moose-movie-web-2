import { fireEvent, render } from '@testing-library/react';
import { PosterTransitionController } from './PosterTransitionController';

const nameOf = (element: HTMLElement) =>
  element.style.getPropertyValue('view-transition-name');

function renderCards() {
  // Same title in two rows, as on Home: only the clicked one may be named.
  return render(
    <>
      <PosterTransitionController />
      {['a', 'b'].map((row) => (
        <a key={row} href="#movie-550" data-testid={`link-${row}`}>
          <div data-poster-transition="poster-movie-550" data-testid={row}>
            <span data-testid={`${row}-inner`}>poster</span>
          </div>
        </a>
      ))}
      <a href="#movie-680" data-testid="link-c">
        <div data-poster-transition="poster-movie-680" data-testid="c" />
      </a>
      <a href="#discover" data-testid="plain-link">
        Discover
      </a>
    </>
  );
}

// Hash links: the controller ignores href, and jsdom does not navigate.
const click = (element: Element, init?: MouseEventInit) =>
  fireEvent(
    element,
    new MouseEvent('click', { bubbles: true, cancelable: true, ...init })
  );

describe('PosterTransitionController', () => {
  it('names only the poster of the clicked card', () => {
    const { getByTestId } = renderCards();

    click(getByTestId('a-inner'));

    expect(nameOf(getByTestId('a'))).toBe('poster-movie-550');
    expect(nameOf(getByTestId('b'))).toBe('');
  });

  it('moves the name when another card is clicked', () => {
    const { getByTestId } = renderCards();

    click(getByTestId('a'));
    click(getByTestId('b'));

    expect(nameOf(getByTestId('a'))).toBe('');
    expect(nameOf(getByTestId('b'))).toBe('poster-movie-550');
  });

  it.each([
    ['ctrl', { ctrlKey: true }],
    ['meta', { metaKey: true }],
    ['shift', { shiftKey: true }],
    ['alt', { altKey: true }],
    ['middle button', { button: 1 }],
  ])('ignores a %s click, which does not navigate in place', (_label, init) => {
    const { getByTestId } = renderCards();

    click(getByTestId('a'), init);

    expect(nameOf(getByTestId('a'))).toBe('');
  });

  it('ignores links without a poster and keeps the current name', () => {
    const { getByTestId } = renderCards();

    click(getByTestId('c'));
    click(getByTestId('plain-link'));

    expect(nameOf(getByTestId('c'))).toBe('poster-movie-680');
  });

  it('stops listening and clears the name on unmount', () => {
    const { getByTestId, rerender } = renderCards();
    const a = getByTestId('a');
    click(a);

    rerender(<></>);

    expect(nameOf(a)).toBe('');
  });

  it('renders nothing', () => {
    const { container } = render(<PosterTransitionController />);
    expect(container).toBeEmptyDOMElement();
  });
});
