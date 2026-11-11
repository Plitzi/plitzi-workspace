import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { REFUSALS } from '@plitzi/sdk-shared/refusals';

import { runRefusals } from './refusal';
import { refusalsPage } from './refusalsPage';
import { fail, unanswered, UNANSWERED_EXIT } from '../commands/shared/terminal';

import type { RefusalEntry } from '@plitzi/sdk-shared/refusals';

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..');

const sources = (folder: string): string[] =>
  readdirSync(folder).flatMap(name => {
    const path = join(folder, name);
    if (statSync(path).isDirectory()) {
      return name === 'tests' || name === 'node_modules' ? [] : sources(path);
    }

    return path.endsWith('.ts') && !path.endsWith('.test.ts') ? [path] : [];
  });

afterEach(() => {
  process.exitCode = undefined;
  vi.restoreAllMocks();
});

describe('a command’s refusal', () => {
  it('says the problem, then its code and the step to take', () => {
    const said = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    fail('exists', 'site/ already has files.');

    expect(said.mock.calls.map(call => String(call[0]))).toEqual([
      expect.stringContaining('site/ already has files.'),
      expect.stringContaining(`Next (exists): ${REFUSALS.exists.next}`)
    ]);
    expect(process.exitCode).toBe(1);
  });

  it('takes the step its refusal knows better than the code’s', () => {
    const said = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    fail('missing', 'No task build.', 'name one of: lint, test');

    expect(String(said.mock.calls.at(1)?.[0])).toContain('Next (missing): name one of: lint, test');
  });

  // Nothing answered is the machine's, not the work's: a run tells the two apart by the exit code.
  it('exits 2 when nothing answered, however it was raised', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    unanswered('Nothing answers at http://localhost:3000.');

    expect(process.exitCode).toBe(UNANSWERED_EXIT);
    fail('unanswered', 'Nothing answers at http://localhost:3000.');

    expect(process.exitCode).toBe(UNANSWERED_EXIT);
  });
});

describe('the list of refusals', () => {
  it.each(Object.entries(REFUSALS))('%s says what it means and a step to take', (_code, refusal) => {
    expect(refusal.means.trim()).not.toBe('');
    expect(refusal.next.trim()).not.toBe('');
    expect(refusal.next).not.toBe(refusal.means);
    expect(refusal.next).not.toMatch(/^nothing to/i);
    expect(refusal.surfaces.length).toBeGreaterThan(0);
  });

  it.each(runRefusals().map(each => [each.code, each] as const))('%s, a run’s, says a step to take', (_code, run) => {
    expect(run.next.trim()).not.toBe('');
  });

  // A code no command raises is a row nobody meets; a code the CLI raises that the list says it does not is a lie.
  it('holds every code the CLI raises, and only those as the CLI’s', () => {
    const code = sources(SRC)
      .map(path => readFileSync(path, 'utf-8'))
      .join('\n');
    const unraised = Object.entries(REFUSALS)
      .filter(
        ([name, refusal]: [string, RefusalEntry]) => refusal.surfaces.includes('cli') && !code.includes(`'${name}'`)
      )
      .map(([name]) => name);

    expect(unraised).toEqual([]);
  });

  it('names no code a run’s refusal also has: `plitzi explain` answers each one way', () => {
    const run = new Set<string>(runRefusals().map(each => each.code));

    expect(Object.keys(REFUSALS).filter(name => run.has(name))).toEqual([]);
  });

  // If this fails, a code changed and the page did not: `yarn generate:refusals`.
  it('is the page docs/en/refusals.md', async () => {
    await expect(refusalsPage()).toMatchFileSnapshot('../../../../docs/en/refusals.md');
  });
});
