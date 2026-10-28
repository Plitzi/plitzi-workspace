import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { restrictionsOf, restrictionsOn } from './restrictions';

let root: string;

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'plitzi-restrictions-'));
});

afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

/** The project's specs take `test` from `./offline`: what a run's developer learnt only at lint. */
const OFFLINE = {
  rules: {
    'no-restricted-imports': [
      2,
      {
        paths: [
          {
            name: '@playwright/test',
            importNames: ['test'],
            message: 'take test from ./offline: the suite reaches nothing on the internet'
          }
        ],
        patterns: [{ group: ['../server/*'], message: 'the client reaches the server through /api' }]
      }
    ],
    'no-restricted-syntax': ['error', { selector: 'WithStatement', message: 'never with' }, 'DebuggerStatement'],
    'no-restricted-globals': ['warn', 'event'],
    'no-restricted-properties': [2, { object: 'Math', property: 'random', message: 'use the seeded random' }],
    'no-shadow-restricted-names': [2]
  }
};

describe('what the project’s lint forbids in a task’s files', () => {
  it('reads each restriction its config sets, with its words — never one switched off, nor a rule of another name', () => {
    expect(restrictionsOf(OFFLINE)).toEqual([
      "no { test } import from '@playwright/test' — take test from ./offline: the suite reaches nothing on the internet",
      'no import from ../server/* — the client reaches the server through /api',
      'no WithStatement — never with',
      'no DebuggerStatement',
      'no global event',
      'no Math.random — use the seeded random'
    ]);
    expect(restrictionsOf({ rules: { 'no-restricted-imports': ['off', 'lodash'] } })).toEqual([]);
    expect(restrictionsOf(undefined)).toEqual([]);
  });

  it('asks the project’s ESLint once a kind of file, and says each line with the kinds it holds for', async () => {
    const bin = path.join(root, 'node_modules', '.bin');
    await fs.mkdir(bin, { recursive: true });
    // Its config for a spec, and none for a module: what `--print-config <file>` answers.
    await fs.writeFile(
      path.join(bin, 'eslint'),
      `#!/bin/sh\ncase "$2" in *.spec.ts) echo '${JSON.stringify(OFFLINE)}' ;; *) echo '{"rules":{}}' ;; esac\n`,
      { mode: 0o755 }
    );

    const lines = await restrictionsOn(root, ['visual/a.spec.ts', 'visual/b.spec.ts', 'src/a.ts']);
    expect(lines[0]).toBe(
      "visual/*.spec.ts: no { test } import from '@playwright/test' — take test from ./offline: the suite reaches nothing on the internet"
    );
    expect(lines).toHaveLength(6);
    // A project with no ESLint has nothing to say.
    await fs.rm(path.join(bin, 'eslint'));
    expect(await restrictionsOn(root, ['visual/a.spec.ts'])).toEqual([]);
  });
});
