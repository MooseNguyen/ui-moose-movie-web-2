import { render, screen } from '@testing-library/react';
import { WebVitals } from './WebVitals';

vi.mock('@vercel/speed-insights/next', () => ({
  SpeedInsights: () => <span data-testid="speed-insights" />,
}));

afterEach(() => vi.unstubAllEnvs());

describe('WebVitals', () => {
  it('reports real-user Web Vitals on the production deployment', () => {
    vi.stubEnv('VERCEL_ENV', 'production');

    render(<WebVitals />);

    expect(screen.getByTestId('speed-insights')).toBeInTheDocument();
  });

  it.each([
    ['a preview deployment', 'preview'],
    ['vercel dev', 'development'],
    ['outside Vercel (local, E2E, Lighthouse CI)', undefined],
  ])('renders nothing on %s', (_label, env) => {
    vi.stubEnv('VERCEL_ENV', env);

    const { container } = render(<WebVitals />);

    expect(container).toBeEmptyDOMElement();
  });
});
