import { render, screen } from '@testing-library/react';
import { ErrorBoundary } from './ErrorBoundary';

function Boom(): never {
  throw new Error('boom');
}

describe('ErrorBoundary', () => {
  it('renders children when nothing throws', () => {
    render(
      <ErrorBoundary fallback={<p>fallback</p>}>
        <p>ok</p>
      </ErrorBoundary>
    );
    expect(screen.getByText('ok')).toBeInTheDocument();
  });

  it('shows the fallback and logs once with the [ui] tag', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <ErrorBoundary fallback={<p>fallback</p>}>
        <Boom />
      </ErrorBoundary>
    );
    expect(screen.getByText('fallback')).toBeInTheDocument();
    const own = spy.mock.calls.filter((c) => c[0] === '[ui]');
    expect(own).toHaveLength(1);
    expect((own[0][1] as Error).message).toBe('boom');
    spy.mockRestore();
  });
});
