import fs from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * The CLI is any project's: what it ships — its code and its tests, its skills, its README — says a situation in
 * general words, never the name of a run it was learnt from.
 */
const ROOT = path.resolve(import.meta.dirname, '..');
const SHIPPED = ['src', 'skills', 'README.md'];
const RUN_NAME = new RegExp(['enc', 'ore-\\d+'].join(''), 'i');

const filesUnder = async (entry: string): Promise<string[]> => {
  const stat = await fs.stat(entry);
  if (!stat.isDirectory()) {
    return [entry];
  }

  const names = await fs.readdir(entry);

  return (await Promise.all(names.map(name => filesUnder(path.join(entry, name))))).flat();
};

describe('what the CLI ships', () => {
  it('names no run it was learnt from', async () => {
    const files = (await Promise.all(SHIPPED.map(entry => filesUnder(path.join(ROOT, entry))))).flat();
    const named = (
      await Promise.all(
        files
          .filter(file => /\.(?:ts|tsx|md|json)$/.test(file))
          .map(async file =>
            (await fs.readFile(file, 'utf-8'))
              .split('\n')
              .flatMap((line, index) =>
                RUN_NAME.test(line) ? [`${path.relative(ROOT, file)}:${String(index + 1)}`] : []
              )
          )
      )
    ).flat();

    expect(named).toEqual([]);
  });
});
