import { stripVTControlCharacters } from 'node:util';

import { describe, expect, it } from 'vitest';

import { besideBrief, handedShow, lookCommand, nextText } from './next';

import type { Brief } from './brief';
import type { Message } from '../../../runs/talk/messages';
import type { TaskShown } from '../../../runs/view/show';

// An agent met Plitzi's frictions and said them only in its last words, which the run's feedback never reads.
describe('plitzi task next, with nothing left', () => {
  it('asks for what of Plitzi got in the way before the agent stops', () => {
    const said = stripVTControlCharacters(
      nextText(
        { why: 'every task is done. You can stop', ready: [], messages: [], finished: true, scratch: '/s' },
        'dev-1'
      )
    );

    expect(said).toContain('plitzi run notice --plitzi');
    expect(
      stripVTControlCharacters(nextText({ why: 'nothing is ready', ready: [], messages: [], scratch: '/s' }, 'dev-1'))
    ).not.toContain('--plitzi');
  });
});

// A run's scout kept its answers' last line alone, and missed two of the lead's redirects for 20 minutes.
describe('what the lead said, in an answer', () => {
  it('comes last, the newest thing said', () => {
    const said = stripVTControlCharacters(
      nextText(
        {
          why: 'nothing is ready',
          ready: [],
          messages: [{ id: 'm2', at: '2026-10-27T15:00:00.000Z', from: 'lead', to: 's-scope', text: 'Stop b-38 now' }],
          scratch: '/s'
        },
        'scout-1'
      )
    ).split('\n');

    expect(said.at(-1)).toBe('  ✉ lead (m2): Stop b-38 now');
  });
});

// A review hand-off answered 15k characters — its diffs whole — read again on every turn after.
describe('what went to review, as task next hands it', () => {
  const shown = (diff: string): TaskShown => ({
    task: {
      id: 't-home',
      title: 'Translate home',
      files: ['src/space/pages/home/index.ts'],
      dependsOn: [],
      priority: 'high',
      estimateMinutes: 10,
      acceptance: ['Home reads in Spanish'],
      kind: 'work'
    },
    status: 'in-review',
    round: 0,
    from: 'submitted',
    files: [{ file: 'src/space/pages/home/index.ts', change: 'changed', diff }],
    checks: 'passed',
    notes: [],
    agreements: [],
    unanswered: [],
    requests: [],
    messages: [],
    next: []
  });

  it('is whole while short, and past half of a large answer leaves its diffs a command away', () => {
    expect(stripVTControlCharacters(handedShow(shown('+ export const home = 1;')))).toContain('export const home = 1;');

    const long = Array.from({ length: 200 }, (_, at) => `+ export const line${String(at)} = '${'x'.repeat(40)}';`).join(
      '\n'
    );
    const handed = stripVTControlCharacters(handedShow(shown(long)));
    expect(handed).not.toContain('line199');
    expect(handed).toContain('Not shown, 1 file: src/space/pages/home/index.ts (200 lines)');
    expect(handed).toContain('plitzi task show t-home <file> --diff, or plitzi task show t-home --full');
    // Its acceptance is the review's own lines, each with its result: a run's hand-off said every line three times.
    expect(handed).not.toContain('Home reads in Spanish');
  });
});

// A header task checked /sign-in and /sign-up as a guest and /messages as dax: its look opened all as dax, and a signed-in
// visitor is sent away from the sign-in pages — it never saw the keys it was about.
describe('the look a review is handed', () => {
  it('opens each page as its acceptance checks it — a guest, an account — the rest as the account it names', () => {
    const task = {
      id: 't-header-keys',
      title: 'Header keys latch',
      files: ['src/space/shell/account.ts'],
      dependsOn: [],
      priority: 'high' as const,
      estimateMinutes: 10,
      kind: 'work' as const,
      acceptance: [
        { said: 'Sign in latches', check: 'plitzi page check /sign-in /sign-up --guest --width 390' },
        { said: 'Mail latches', check: 'plitzi page check /messages --as dax --width 390' }
      ]
    };

    expect(lookCommand(task, ['/sign-in', '/sign-up', '/messages', '/rooms'], ' --before')).toEqual([
      'plitzi task look t-header-keys /sign-in /sign-up --guest --before',
      'plitzi task look t-header-keys /messages /rooms --as dax --before'
    ]);
  });
});

// A run's brief ran to 21k characters: the run's notes twice — as messages and as "What holds" — and an amend's message
// restating the brief printed below it, read again on every turn after it.
describe('what was said to a task, beside its brief', () => {
  const said = (id: string, to: string, text: string, amended?: string[]): Message => ({
    id,
    from: 'lead',
    to,
    text,
    at: '2026-10-29T10:00:00.000Z',
    ...(amended ? { amended } : {})
  });
  // Only what besideBrief reads of a brief: the run's notes, and whether it is printed whole.
  const brief = { runNotes: ['Every hazard check reads /?sample=active'] } as Brief;

  it('says the run’s notes once, in the brief, and an amend as the brief below', () => {
    const messages = besideBrief(
      [
        said('m1', '*', 'Every hazard check reads /?sample=active'),
        said('m7', 't-window', 'The lead amended this task (acceptance). It now asks: all of it again', ['acceptance']),
        said('m8', 't-window', 'Ask dev-2 before you touch the header')
      ],
      brief
    );

    expect(messages.map(each => each.text)).toEqual([
      'The lead amended this task (acceptance): the brief below is as amended',
      'Ask dev-2 before you touch the header'
    ]);
  });
});
