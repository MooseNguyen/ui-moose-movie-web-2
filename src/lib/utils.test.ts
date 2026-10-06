import { cn } from './utils';

describe('cn', () => {
  it('joins truthy class names and drops falsy ones', () => {
    expect(cn('a', false && 'b', undefined, 'c')).toBe('a c');
  });

  it('lets later Tailwind classes override earlier conflicting ones', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4');
  });
});
