import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { failsWithout, projectChecks } from './checks';

const SUGGESTION = '[suggest] repeated-css · the same three declarations twice (saves 3)';

const projectWith = async (author: string): Promise<string> => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'plitzi-checks-'));
  await fs.writeFile(path.join(dir, 'author.mjs'), author);
  await fs.writeFile(
    path.join(dir, 'package.json'),
    JSON.stringify({ name: 'checks', type: 'module', private: true, scripts: { author: 'node author.mjs' } })
  );

  return dir;
};

describe('a run’s checks', () => {
  it('fail the author step on a suggestion: a task leaves the space with none', async () => {
    const dir = await projectWith(
      `console.warn(${JSON.stringify(SUGGESTION)});
console.log(${JSON.stringify('ok · 1 pages · 0 warnings · 1 suggestions')});
`
    );
    const checked = await projectChecks(dir, dir);

    expect(checked.ok).toBe(false);
    expect(checked.steps[0].said?.[0]).toBe(SUGGESTION);
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('pass it with none', async () => {
    const dir = await projectWith(`console.log(${JSON.stringify('ok · 1 pages · 0 warnings · 0 suggestions')});
`);

    expect((await projectChecks(dir, dir)).ok).toBe(true);
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('excuse what fails the same way without the change, never what it adds', () => {
    const without = { ok: false, steps: [{ name: 'format', ok: false, said: ['[warn] src/a.ts'] }] };

    expect(
      failsWithout({ ok: false, steps: [{ name: 'format', ok: false, said: ['[warn] src/a.ts'] }] }, without, [])
    ).toBe(true);
    expect(
      failsWithout(
        { ok: false, steps: [{ name: 'format', ok: false, said: ['[warn] src/a.ts', '[warn] src/b.ts'] }] },
        without,
        []
      )
    ).toBe(false);
    expect(failsWithout({ ok: false, steps: [{ name: 'lint', ok: false, said: ['x'] }] }, without, [])).toBe(false);
  });
});
