/* eslint-disable quotes -- what it prints quotes its own strings, and reads best in the other quotes */
import { afterEach, describe, expect, it, vi } from 'vitest';

import { explainCommand } from './explain';

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

  it('says what there is when a name is nothing', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    explainCommand('teleport', {});

    expect(error.mock.calls.flat().join('')).toContain('--list elements, steps, triggers, codes, transformers');
    expect(process.exitCode).toBe(1);
  });
});
