import { Command } from 'commander';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { EXPLAIN_KINDS, explainList } from '@plitzi/sdk-authoring';
import { PROJECT_LAYOUT_CODES } from '@plitzi/sdk-shared/project';

import { explainCommand, searchAll } from './explain';
import { LINT_RULES } from '../../lint/catalog';

const printed = (run: () => void): string => {
  const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
  run();

  return log.mock.calls.flat().join('\n');
};

describe('plitzi explain', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    process.exitCode = 0;
  });

  it('says a step in a few lines: what it takes and the function that writes it', () => {
    const said = printed(() => explainCommand('navigate', {}));

    expect(said).toContain('Written: navigate({ … })');
    expect(said).toContain("urlType?: 'page' | 'internal' | 'external'");
  });

  it('answers a tool in one object', () => {
    const answer: unknown = JSON.parse(printed(() => explainCommand('onScroll', { json: true })));

    expect(answer).toEqual([expect.objectContaining({ reads: ['x', 'y', 'atStart', 'atEnd'] })]);
  });

  // A run's agents searched with --search 24 times in 70: several words are a search, a name is one word.
  it('answers several words with what they describe, best first', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    await explainCommand('carousel end', {});

    const said = log.mock.calls.flat().join('\n');
    expect(said).toMatch(/^carousel_<id>\.atEnd/m);
    expect(said).toContain('Each said whole: plitzi explain <name>');
  });

  it('lists a kind by its plural', () => {
    expect(printed(() => explainCommand(undefined, { list: 'codes' }))).toContain('class-and-css');
  });

  it('says a code of plitzi space lint as it says one of authoring’s: what it means, and where the fix is explained', () => {
    const said = printed(() => explainCommand('file-too-long', {}));

    expect(said).toBe(
      'file-too-long — warning of plitzi space lint: a file of the space too long to read whole.\nFix: what its message says — explained in .claude/skills/plitzi-authoring/reference/structure.md.'
    );
  });

  it('says a code of the project’s layout, and that the doctor makes the fixes with one reading', () => {
    const [answer] = JSON.parse(printed(() => explainCommand('env-in-src', { json: true }))) as unknown[];

    expect(answer).toEqual({
      kind: 'code',
      name: 'env-in-src',
      codeKind: 'error',
      means: PROJECT_LAYOUT_CODES['env-in-src'].means,
      fix: expect.stringContaining('plitzi doctor --fix makes those with one reading') as unknown,
      checkedBy: 'the project layout'
    });
  });

  it('lists every code of every check under codes, each once', () => {
    const listed = JSON.parse(printed(() => explainCommand(undefined, { list: 'codes', json: true }))) as {
      name: string;
    }[];
    const names = listed.map(entry => entry.name);
    const owners = [
      explainList('code').map(entry => entry.name),
      Object.keys(LINT_RULES),
      Object.keys(PROJECT_LAYOUT_CODES)
    ];

    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
    expect(new Set(names).size).toBe(names.length);
    expect(names).toHaveLength(owners.flat().length);
    expect(EXPLAIN_KINDS.code).toBe('codes');
  });

  it('says what there is when a name is nothing', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await explainCommand('teleport', {});

    expect(error.mock.calls.flat().join('')).toContain('--list elements, steps, triggers, codes, transformers');
    expect(process.exitCode).toBe(1);
  });

  // `explain active`, `explain keepState`, `explain page-play` failed nine times; a search answered them.
  it('answers a name it does not have with what its words describe', async () => {
    const page = new Command('page');
    page.command('play').description('An interaction step by step, each element read after it');

    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    await explainCommand('page-play', {}, [page]);
    const said = log.mock.calls.flat().join('\n');

    expect(said).toContain('"page-play" is no name Plitzi has — what the words describe:');
    expect(said).toContain('plitzi page play');
    expect(process.exitCode).toBe(0);
  });

  // `explain keepState` — a setting of the space — was "no name".
  it('says a setting of the space as one', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    await explainCommand('keepState', {});

    expect(log.mock.calls.flat().join('\n')).toContain('keepState — a setting of the whole space');
  });

  // Agents read the bundle's types and every command's help to learn whether Plitzi had a way to do a thing.
  it('searches by words what authoring knows, the CLI’s codes and its commands with their options', () => {
    const page = new Command('page');
    page.command('outline').description('What a page is made of, as a visitor sees it');
    page
      .command('measure')
      .description('Elements’ computed styles')
      .option('--click <element...>', 'Click elements first and measure the open state');
    const names = (words: string) => searchAll(words, [page], 3).map(hit => `${hit.kind}:${hit.name}`);

    expect(names('outline page')[0]).toBe('command:plitzi page outline');
    expect(names('measure open state')[0]).toBe('command:plitzi page measure --click');
    expect(names('carousel end')[0]).toBe('field:carousel_<id>.atEnd');
  });
});
