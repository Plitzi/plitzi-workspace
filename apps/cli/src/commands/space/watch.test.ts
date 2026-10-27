import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { eventText, passEvent, watchedFolders, watchPass } from './watch';
import { WORKSPACE_ROOT } from '../../tests/roots';
import create from '../project/create';

import type { WatchPass } from './watch';
import type { LintFinding } from '../../lint';
import type { ElementReading } from '../element/spaceReading';

/**
 * `plitzi space watch`: what one save did, said against the pass before it — only what changed — and the pass each save
 * is read with, in a project `plitzi create` wrote.
 */

const element = (elementId: string, attributes: Record<string, unknown> = {}, children: string[] = []) =>
  ({
    elementId,
    type: 'text',
    rootId: 'home',
    classes: [],
    attributes,
    templates: [],
    bound: [],
    children
  }) satisfies ElementReading;

const finding = (code: string, line: number, message = `${code} here`): LintFinding => ({
  code,
  severity: 'warning',
  origin: 'source',
  message,
  file: 'src/space/pages/home.ts',
  line,
  column: 1,
  docs: 'plitzi explain'
});

const authoring = (
  readings: ElementReading[],
  findings: LintFinding[] = []
): Extract<WatchPass, { authors: true }> => ({
  authors: true,
  findings,
  warnings: [],
  readings
});

const FILES = ['src/space/pages/home.ts'];

const UNPARSED_SPACE = `export const space = { name: 'x' ;
`;

const REFUSED_SPACE = `import { heading } from '@plitzi/sdk-authoring';

const home = { name: 'Home', slug: '', isDefault: true, body: [heading('Hi', { id: 'title' }), heading('Ho', { id: 'title' })] };

export const space = { name: 'Watch', permanentUrl: 'watch', pages: [home] };
`;

describe('what a save did', () => {
  it('says what it changed in the space, element by element, and the problems it brought and fixed', () => {
    const before = authoring([element('home', {}, ['hero']), element('hero', { content: 'Hi' })], [finding('a', 3)]);
    const after = authoring(
      [element('home', {}, ['hero', 'cta']), element('hero', { content: 'Hello' }), element('cta')],
      [finding('b', 9)]
    );

    const event = passEvent(before, before, after, FILES, 40);

    expect(event).toMatchObject({
      type: 'pass',
      files: FILES,
      space: ['cta (text) added', 'home children: +cta', 'hero.content: "Hi" → "Hello"'],
      findings: { added: [finding('b', 9)], resolved: [finding('a', 3)] },
      counts: { findings: 1, warnings: 0 }
    });
    expect(event).not.toHaveProperty('unchanged');
  });

  it('takes a problem that only moved down the file for the same one, not as fixed and new', () => {
    const before = authoring([element('hero')], [finding('a', 3)]);
    const after = authoring([element('hero')], [finding('a', 7)]);

    expect(passEvent(before, before, after, FILES, 5)).toMatchObject({ unchanged: true });
  });

  it('says a space that stopped authoring, and why', () => {
    const before = authoring([element('hero')]);
    const broken: WatchPass = { authors: false, problem: 'home.ts:4: Expected ","', findings: [] };

    expect(passEvent(before, before, broken, FILES, 5)).toEqual({
      type: 'refused',
      files: FILES,
      ms: 5,
      problem: 'home.ts:4: Expected ","',
      findings: { added: [], resolved: [] }
    });
  });

  it('says the save that fixed it against the space before it broke, not as if every element were new', () => {
    const good = authoring([element('hero', { content: 'Hi' })]);
    const broken: WatchPass = { authors: false, problem: 'refused', findings: [] };
    const fixed = authoring([element('hero', { content: 'Hey' })]);

    expect(passEvent(broken, good, fixed, FILES, 5)).toMatchObject({ space: ['hero.content: "Hi" → "Hey"'] });
  });

  it('reads as lines a person scans', () => {
    const before = authoring([element('hero', { content: 'Hi' })]);
    const after = authoring([element('hero', { content: 'Hey' })], [finding('b', 2)]);

    const text = eventText(passEvent(before, before, after, FILES, 12));

    expect(text).toContain('src/space/pages/home.ts (12 ms)');
    expect(text).toContain('hero.content: "Hi" → "Hey"');
    expect(text).toContain('+ warning b src/space/pages/home.ts:2 — b here');
  });
});

describe('the pass each save is read with', () => {
  let home = '';
  const said: string[] = [];

  const project = async (): Promise<string> => {
    home = await fs.mkdtemp(path.join(os.tmpdir(), 'plitzi-watch-'));
    const root = path.join(home, 'site');
    await create(root, { mode: 'server', source: 'local', packageManager: 'npm', install: false, template: 'blank' });
    const link = async (name: string, from: string): Promise<void> => {
      await fs.mkdir(path.dirname(path.join(root, 'node_modules', name)), { recursive: true });
      await fs.symlink(path.join(WORKSPACE_ROOT, from), path.join(root, 'node_modules', name), 'dir');
    };
    await link('@plitzi/sdk-authoring', 'packages/sdk-authoring');
    await link('typescript', 'node_modules/typescript');
    vi.spyOn(process, 'cwd').mockReturnValue(root);
    vi.spyOn(console, 'log').mockImplementation((line: unknown) => said.push(String(line)));
    vi.spyOn(console, 'error').mockImplementation((line: unknown) => said.push(String(line)));

    return root;
  };

  const pass = async (): Promise<WatchPass> => {
    said.length = 0;
    await watchPass();

    // The pass is the command's own JSON, written just above: its shape is `WatchPass`.
    return JSON.parse(said.at(-1) ?? '{}') as WatchPass;
  };

  afterEach(async () => {
    vi.restoreAllMocks();
    process.exitCode = undefined;
    await fs.rm(home, { recursive: true, force: true });
  });

  it('reads the space as it authors: every element, its warnings and its findings', async () => {
    const root = await project();

    const read = await pass();

    expect(read.authors).toBe(true);
    expect(read.authors && read.readings.length).toBeGreaterThan(0);
    expect(watchedFolders(root)).toContain('src/space');
  }, 60_000);

  it('says a file that does not parse at its line, as the problem', async () => {
    const root = await project();
    await fs.writeFile(path.join(root, 'src/space/index.ts'), UNPARSED_SPACE);

    const read = await pass();

    expect(read.authors).toBe(false);
    expect(read.authors ? '' : read.problem).toMatch(/src\/space\/index\.ts:1: /);
  }, 60_000);

  it('says why a space does not author, with its findings still read', async () => {
    const root = await project();
    // Two elements under one id: a space that writes, and that authoring refuses.
    await fs.writeFile(path.join(root, 'src/space/index.ts'), REFUSED_SPACE);

    const read = await pass();

    expect(read.authors).toBe(false);
    expect(read.authors ? '' : read.problem).toContain('[id-taken]');
  }, 60_000);
});
