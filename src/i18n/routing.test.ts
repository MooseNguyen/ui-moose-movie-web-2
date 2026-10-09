import { routing } from './routing';

describe('routing', () => {
  it('serves vi by default and en', () => {
    expect(routing.locales).toEqual(['vi', 'en']);
    expect(routing.defaultLocale).toBe('vi');
  });

  // The middleware's hreflang `Link` header uses the request host and an
  // unprefixed x-default, contradicting the HTML alternates from
  // buildMetadata (SITE_URL, x-default → /vi). The HTML is the single source.
  it('disables the middleware hreflang Link header', () => {
    expect(routing.alternateLinks).toBe(false);
  });
});
