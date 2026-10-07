import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

describe('favorites feature bundle hygiene', () => {
  it('does not import zod (validated by hand to keep the client bundle small)', () => {
    const dir = import.meta.dirname;
    const sources = readdirSync(dir).filter(
      (f) => /\.tsx?$/.test(f) && f !== 'no-zod.test.ts'
    );
    expect(sources.length).toBeGreaterThan(0);
    for (const file of sources) {
      const code = readFileSync(path.join(dir, file), 'utf8');
      expect(code, file).not.toMatch(
        /from\s+['"]zod|require\(['"]zod|import\(['"]zod/
      );
    }
  });
});
