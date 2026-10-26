import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { failsWithout, lintWarnings, projectChecks } from './checks';

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

  it('say a thing declared and read by nothing yet, without failing — and fail it at the finish', async () => {
    const unused = '[suggest] unused-component · fighter-card is declared and placed nowhere (saves 0)';
    const dir = await projectWith(
      `console.warn(${JSON.stringify(unused)});
console.log(${JSON.stringify('ok · 1 pages · 0 warnings · 1 suggestions')});
`
    );

    const task = await projectChecks(dir, dir);
    expect(task.ok).toBe(true);
    expect(task.steps[0].warnings?.[0]).toContain('unused-component · fighter-card');
    expect((await projectChecks(dir, dir, { final: true })).ok).toBe(false);
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('still run the steps after an author that only suggests: a failing typecheck is never hidden behind it', async () => {
    const dir = await projectWith(
      `console.warn(${JSON.stringify(SUGGESTION)});
console.log(${JSON.stringify('ok · 1 pages · 0 warnings · 1 suggestions')});
`
    );
    await fs.writeFile(
      path.join(dir, 'package.json'),
      JSON.stringify({
        name: 'checks',
        type: 'module',
        private: true,
        scripts: { author: 'node author.mjs', typecheck: 'node -e "process.exit(2)"' }
      })
    );

    const checked = await projectChecks(dir, dir);
    expect(checked.steps.map(step => [step.name, step.ok])).toEqual([
      ['author', false],
      ['typecheck', false]
    ]);
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

describe('what the space’s lint passed with but warned of', () => {
  it('is each warning by its file, line and code — the space’s own by "the space"', () => {
    const output = [
      'plitzi space lint — pet-friends (the space’s source: 28 files from src/space/index.ts)',
      '',
      'src/space/layout.ts',
      '  9:13     warning  10 records written inline (lines 9–20): move them to src/data/nav.json.  inline-records',
      '',
      'the space (no one line wrote it)',
      '  -        warning  3 containers of 9 elements share one structure.  repeated-shape',
      '',
      'Passes — 0 errors, 2 warnings.'
    ].join('\n');

    expect(lintWarnings(output)).toEqual(['src/space/layout.ts:9 inline-records', 'the space repeated-shape']);
    expect(lintWarnings('Clean — 0 errors, 0 warnings.')).toEqual([]);
  });
});

// A copy importing `node:crypto` into its functions passed its tests under `node --test`; only its server, failing to
// start, said so. The checks build them as the runner does, by the project's installed sdk-server.
describe('a run’s checks of the functions', () => {
  it('build them by the project’s sdk-server, a problem where it is — the copy’s files, the project’s modules', async () => {
    const root = await projectWith('console.log("ok · 1 pages · 0 warnings · 0 suggestions");\n');
    const copy = await projectWith('console.log("ok · 1 pages · 0 warnings · 0 suggestions");\n');
    const server = path.join(root, 'node_modules', '@plitzi', 'sdk-server');
    await fs.mkdir(server, { recursive: true });
    await fs.writeFile(
      path.join(server, 'package.json'),
      JSON.stringify({ name: '@plitzi/sdk-server', type: 'module', exports: { './functions-runner': './runner.js' } })
    );
    await fs.writeFile(
      path.join(server, 'runner.js'),
      'export const buildFunctions = async source => {\n' +
        "  const at = Object.keys(source).find(file => source[file].includes('node:'));\n" +
        "  if (at) { throw Object.assign(new Error('refused'), { problems: [{ file: at, line: 1, message: '\"node:crypto\" cannot be imported' }] }); }\n" +
        "  return { code: '', bytes: 0 };\n};\n"
    );
    await fs.mkdir(path.join(copy, 'src', 'functions'), { recursive: true });
    await fs.writeFile(path.join(copy, 'src', 'functions', 'index.ts'), "import { createHash } from 'node:crypto';\n");

    const checked = await projectChecks(copy, root);
    expect(checked.ok).toBe(false);
    expect(checked.steps.find(step => step.name === 'functions')).toEqual({
      name: 'functions',
      ok: false,
      said: ['src/functions/index.ts:1: "node:crypto" cannot be imported']
    });
    await fs.rm(root, { recursive: true, force: true });
    await fs.rm(copy, { recursive: true, force: true });
  });
});
