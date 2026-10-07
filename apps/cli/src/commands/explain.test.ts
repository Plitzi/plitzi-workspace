/* eslint-disable quotes -- what it prints quotes its own strings, and reads best in the other quotes */
import { afterEach, describe, expect, it, vi } from 'vitest';

import { EXPLAIN_KINDS, explainList } from '@plitzi/sdk-authoring';
import { PROJECT_LAYOUT_CODES } from '@plitzi/sdk-shared/project/layout';

import { explainCommand } from './explain';
import { LINT_RULES } from '../lint/catalog';

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

  it('says what there is when a name is nothing', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    explainCommand('teleport', {});

    expect(error.mock.calls.flat().join('')).toContain('--list elements, steps, triggers, codes, transformers');
    expect(process.exitCode).toBe(1);
  });
});
