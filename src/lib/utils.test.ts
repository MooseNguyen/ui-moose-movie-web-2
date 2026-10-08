import { cn, truncate } from './utils';

describe('cn', () => {
  it('joins truthy class names and drops falsy ones', () => {
    expect(cn('a', false && 'b', undefined, 'c')).toBe('a c');
  });

  it('lets later Tailwind classes override earlier conflicting ones', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4');
  });
});

describe('truncate', () => {
  it('collapses whitespace and keeps short text unchanged', () => {
    expect(truncate('  Hello\n\n  world  ', 20)).toBe('Hello world');
  });

  it('keeps text that is exactly the limit', () => {
    expect(truncate('abcde', 5)).toBe('abcde');
  });

  it('cuts long text to at most max characters ending with an ellipsis', () => {
    const result = truncate('word '.repeat(100), 160);
    expect(result.length).toBeLessThanOrEqual(160);
    expect(result).toMatch(/word…$/);
  });
});
