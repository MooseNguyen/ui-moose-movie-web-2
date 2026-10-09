import { render } from '@testing-library/react';
import { JsonLd } from './JsonLd';

describe('JsonLd', () => {
  it('renders the data as an application/ld+json script', () => {
    const data = { '@type': 'Movie', name: 'Fight Club' };
    const { container } = render(<JsonLd data={data} />);

    const script = container.querySelector(
      'script[type="application/ld+json"]'
    );
    expect(script).not.toBeNull();
    expect(JSON.parse(script!.innerHTML)).toEqual(data);
  });

  it('escapes < so a value cannot close the script', () => {
    const data = { name: '</script><script>alert(1)</script>' };
    const { container } = render(<JsonLd data={data} />);

    const html = container.querySelector('script')!.innerHTML;
    expect(html).not.toContain('<');
    expect(html).toContain('\\u003c/script>');
    // Still the same data once parsed.
    expect(JSON.parse(html)).toEqual(data);
  });
});
