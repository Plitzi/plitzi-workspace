import path from 'node:path';

import { format } from 'prettier';
import { describe, expect, it } from 'vitest';

import { scaffold } from '.';

import type { CreateAnswers } from './types';

const answers = (over: Partial<CreateAnswers>): CreateAnswers => ({
  name: 'demo',
  mode: 'server',
  source: 'local',
  key: '',
  environment: 'main',
  packageManager: 'npm',
  ...over
});

/** What prettier reads; anything else (`.env`, `.gitkeep`) is not its to format. */
const FORMATTED = new Set(['.ts', '.tsx', '.js', '.mjs', '.json', '.md', '.css', '.html', '.yaml', '.yml']);

const ignoredBy = (prettierignore: string) => {
  const entries = prettierignore
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#'));

  return (file: string): boolean => entries.some(entry => file === entry || file.startsWith(`${entry}/`));
};

/**
 * A project's first `npm run format` changes nothing: what the scaffold writes for the project is already formatted
 * as its own `.prettierrc` says, and what is the CLI's is in its `.prettierignore` — so formatting never turns a file
 * `plitzi upgrade` keeps into one it believes the project changed.
 */
describe('a new project', () => {
  for (const mode of ['server', 'client'] as const) {
    for (const template of ['welcome', 'blank', 'catalog'] as const) {
      it(`is formatted from the start — ${mode}, ${template}`, async () => {
        const files = scaffold(answers({ mode, template }));
        const options = JSON.parse(files['.prettierrc']) as Record<string, unknown>;
        const ignored = ignoredBy(files['.prettierignore']);
        const owned = Object.entries(files).filter(([file]) => FORMATTED.has(path.extname(file)) && !ignored(file));

        const unformatted: string[] = [];
        for (const [file, contents] of owned) {
          if ((await format(contents, { ...options, filepath: file })) !== contents) {
            unformatted.push(file);
          }
        }

        expect(owned.length).toBeGreaterThan(0);
        expect(unformatted).toEqual([]);
      });
    }
  }
});
