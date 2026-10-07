import en from './en.json';
import vi from './vi.json';

function flatKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(obj)
    .flatMap(([key, value]) =>
      value !== null && typeof value === 'object'
        ? flatKeys(value as Record<string, unknown>, `${prefix}${key}.`)
        : [`${prefix}${key}`]
    )
    .sort();
}

describe('messages', () => {
  it('vi and en define exactly the same keys', () => {
    expect(flatKeys(vi)).toEqual(flatKeys(en));
  });

  it('has no empty strings', () => {
    for (const messages of [vi, en]) {
      const empty = flatKeys(messages).filter((k) => {
        const value = k
          .split('.')
          .reduce<unknown>(
            (acc, part) => (acc as Record<string, unknown>)[part],
            messages
          );
        return value === '';
      });
      expect(empty).toEqual([]);
    }
  });
});
