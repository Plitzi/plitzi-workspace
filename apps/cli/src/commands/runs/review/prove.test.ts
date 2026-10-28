import { stripVTControlCharacters } from 'node:util';

import { describe, expect, it } from 'vitest';

import { checkBeforeText } from './prove';

import type { LineBeforeAfter } from '../../../runs/tasks';

const line = (said: string, before: boolean, after: boolean, output: string[] = []): LineBeforeAfter => ({
  said,
  check: 'npx playwright test visual/listen.spec.ts --trace on',
  before: { said, check: '', ok: before, ...(before ? {} : { output }) },
  after: { said, check: '', ok: after, ...(after ? {} : { output }) }
});

describe('a task’s acceptance beside the run before it, as a reviewer reads it', () => {
  it('says what each line proves, and what it printed where it failed', () => {
    const text = stripVTControlCharacters(
      checkBeforeText('t-listen', [
        line('Traced, the test passes', false, true, ['Expected "Listen", received "Mute"']),
        line('The page loads', true, true),
        line('The key reads Listen', true, false, ['Timeout 5000ms'])
      ])
    );

    expect(text).toContain(
      "t-listen's acceptance, before it (the run's approved work) and with it (its copy) — 1 of 3 lines prove the change:"
    );
    expect(text).toContain('✓ Traced, the test passes — fails before t-listen, passes with it: it proves the change');
    expect(text).toContain('before: Expected "Listen", received "Mute"');
    expect(text).toContain(
      '· The page loads — passes before t-listen too: it holds what was there already (a guard, as it may be meant), not the change'
    );
    expect(text).toContain('✗ The key reads Listen — fails with t-listen, where it passed before it');
    expect(text).toContain('with it: Timeout 5000ms');
  });
});
