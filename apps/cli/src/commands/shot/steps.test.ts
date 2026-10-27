import { readFile } from 'node:fs/promises';

// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';

import { actingSteps, actStep, endsActing, givenValueIn, interactionSteps, stepText } from './steps';
import { parseSteps } from '../shotSteps';

import type { ActingStep } from './steps';
import type { Visitors } from './visitors';
import type { BrowserPage } from '../../browser';

const steps = (script: string) => {
  const parsed = parseSteps(script, 500);
  if ('problem' in parsed) {
    throw new Error(parsed.problem);
  }

  return parsed;
};

// `page shot --steps "click <pill>"` pictured the menu shut — the picture before the click was the only one.
describe('page shot --steps', () => {
  it('pictures what steps leave when they end on an action, and adds none after a picture', () => {
    expect(endsActing(steps('click site-menu'))).toBe(true);
    expect(endsActing(steps('click site-menu; press Escape'))).toBe(true);
    expect(endsActing(steps('click site-menu; shot open'))).toBe(false);
    expect(endsActing(steps('click site-menu; frames 3'))).toBe(false);
  });
});

describe('the steps a --fill, --click and --hover are played as', () => {
  // Design-1 asked `page shot --click site-avatar --hover <item>` and was refused an option shot did not have.
  it('clicks, then hovers and pictures the page so — and pictures each click when nothing is hovered after', () => {
    expect(interactionSteps(undefined, ['site-avatar'], 'site-menu-item')).toBe(
      'click "site-avatar"; wait 600; hover "site-menu-item"; wait 400; shot site-menu-item hovered'
    );
    expect(interactionSteps(['type "name" Ana'], ['send'], undefined)).toBe(
      'shot before; type "name" Ana; click "send"; wait 600; shot after send'
    );
    expect(interactionSteps(undefined, ['send'], undefined)).toBeUndefined();
  });
});

describe('a step another account plays, and an action', () => {
  /** A page as far as these steps meet it: where it is, what its fetch answers, and a wait for it to settle. */
  const pageAnswering = (status: number, body: unknown) => {
    const asked: unknown[] = [];
    const page = {
      url: () => 'http://127.0.0.1:8080/messages/juno?tab=new',
      evaluate: vi.fn((_fn: unknown, arg: unknown) => {
        asked.push(arg);

        return Promise.resolve(
          typeof arg === 'object' && arg !== null && 'body' in arg ? { status, text: JSON.stringify(body) } : undefined
        );
      }),
      waitForTimeout: () => Promise.resolve(),
      waitForFunction: () => Promise.resolve()
    };

    // The fake answers what these steps call of a page, and nothing else a page has.
    return { page: page as unknown as BrowserPage, asked };
  };

  // A tester needed a value past the cut of an action's answer, and asked the server with curl for it.
  it('keeps an answer too long to say whole in a file, and says where', async () => {
    const rooms = Array.from({ length: 20 }, (_, index) => ({ slug: `room-${String(index)}`, now: { seq: index } }));
    const { page } = pageAnswering(200, { runId: 'r1', status: 'completed', output: rooms });
    const done = await actStep(page, { kind: 'action', action: 'rooms-list', input: {} }, 0);
    const file = done !== undefined && 'answer' in done ? /\(whole in (.+)\)$/.exec(done.answer)?.[1] : undefined;

    expect(file).toBeDefined();
    expect(JSON.parse(await readFile(file ?? '', 'utf-8'))).toEqual(rooms);
  });

  it('runs the action as the page’s visitor, and says what a refusal said', async () => {
    const { page, asked } = pageAnswering(200, { runId: 'r1', status: 'completed', output: { hidden: true } });
    // What it answered is said: a run's dev-1 read an action's answer with page check --state.
    expect(await actStep(page, { kind: 'action', action: 'crate-hide', input: { crate: 'c1' } }, 0)).toEqual({
      answer: '{"hidden":true}'
    });
    expect(asked[0]).toEqual({
      path: '/_action',
      body: JSON.stringify({ actionId: 'crate-hide', input: { crate: 'c1' } })
    });

    // A run the action itself refused answers 200, its status failed: a refusal all the same.
    const failed = pageAnswering(200, { runId: 'r2', status: 'failed', error: 'Nobody here goes by that name.' });
    expect(await actStep(failed.page, { kind: 'action', action: 'dm-thread', input: {} }, 0)).toEqual({
      problem: 'Step 1: action dm-thread answered 200, failed: Nobody here goes by that name.'
    });
    const refused = pageAnswering(403, { error: 'Only the host hides a crate', code: 'not-host' });
    expect(await actStep(refused.page, { kind: 'action', action: 'crate-hide', input: {} }, 2)).toEqual({
      problem: 'Step 3: action crate-hide answered 403: Only the host hides a crate'
    });
  });

  it('plays the step on the account’s own page, opened where this one is, and says one it could not', async () => {
    const theirs = pageAnswering(200, { status: 'completed' });
    const opened: string[] = [];
    const visitors: Visitors = {
      pageOf: (account, at) => {
        opened.push(`${account} ${at}`);

        return Promise.resolve(account === 'mika' ? theirs.page : { problem: `${account}: no account to sign in as` });
      },
      close: () => Promise.resolve()
    };
    const here = pageAnswering(200, {});
    const step = {
      kind: 'as',
      account: 'mika',
      step: { kind: 'action', action: 'dm-send', input: { to: 'juno' } }
    } as const;

    expect(await actStep(here.page, step, 0, visitors)).toEqual({ answer: 'completed, with no output' });
    expect(opened).toEqual(['mika /messages/juno?tab=new']);
    expect(theirs.asked).toHaveLength(1);
    expect(here.asked.filter(arg => typeof arg === 'object' && arg !== null && 'body' in arg)).toEqual([]);
    expect(stepText(step)).toBe('as mika: action dm-send');
    expect(await actStep(here.page, { ...step, account: 'nova' }, 1, visitors)).toEqual({
      problem: 'Step 2: nova: no account to sign in as'
    });
    expect(await actStep(here.page, step, 0)).toEqual({
      problem: 'Step 1: another account plays only against the project’s own server'
    });
  });
});

// One vocabulary of steps for every command that reads a page: what each refuses is said, never played as nothing.
describe('the steps a page is read after', () => {
  it('are a visitor’s own, played as page play plays them', () => {
    expect(actingSteps('click open-panel; type chat-input hi; press Enter', 'page check')).toEqual(
      steps('click open-panel; type chat-input hi; press Enter')
    );
    expect(actingSteps(undefined, 'page check')).toEqual([]);
  });

  it('refuse a picture, which is page shot’s', () => {
    expect(actingSteps('click menu; shot open', 'page check')).toEqual({
      problem: expect.stringContaining('"shot" is page shot --steps') as unknown
    });
  });

  it('refuse another account’s where the command has no other visitors’ pages', () => {
    expect(actingSteps('as mika click send', 'page check', { others: false })).toEqual({
      problem: expect.stringContaining('"as mika …" is another account\'s') as unknown
    });
    expect(actingSteps('as mika click send', 'page measure')).not.toHaveProperty('problem');
  });
});

// A run's scout typed `2026-10-29` and `10292026` into a date field and its onChange never ran: keys land in a segment.
describe('a field given a value whole', () => {
  it('is a select chosen from, or a date, time, colour or range set — the one named or the one inside it', () => {
    document.body.innerHTML = [
      '<div data-plitzi-el="when"><label>Date</label><input type="date"></div>',
      '<input data-plitzi-el="at" type="time">',
      '<div data-plitzi-el="genre"><select><option>a</option></select></div>',
      '<div data-plitzi-el="title"><input type="text"></div>',
      '<div data-plitzi-el="both"><input type="date"><input type="time"></div>'
    ].join('');

    expect(givenValueIn('[data-plitzi-el="when"]')).toEqual({
      selector: '[data-plitzi-el="when"] input[type="date"]',
      how: 'value'
    });
    expect(givenValueIn('[data-plitzi-el="at"]')).toEqual({ selector: '[data-plitzi-el="at"]', how: 'value' });
    expect(givenValueIn('[data-plitzi-el="genre"]')).toEqual({
      selector: '[data-plitzi-el="genre"] select',
      how: 'select'
    });
    expect(givenValueIn('[data-plitzi-el="title"]')).toBeUndefined();
    // Two fields inside: which one is the step's to name.
    expect(givenValueIn('[data-plitzi-el="both"]')).toBeUndefined();
  });
});

// A tester waited for a state three tries of ten seconds bring with chained fixed waits: a wait-for gave up at 10 s.
describe('a wait-for step played', () => {
  it('waits as long as it says, 10 s when it says nothing', async () => {
    const waited: { selector: string; timeout: number | undefined }[] = [];
    const fake = {
      waitForSelector: (selector: string, options?: { timeout?: number }) => {
        waited.push({ selector, timeout: options?.timeout });

        return Promise.resolve();
      }
    };
    // The fake answers what this step calls of a page, and nothing else a page has.
    const page = fake as unknown as BrowserPage;

    await actStep(page, { kind: 'wait-for', target: '[data-state="stalled"]', ms: 40_000 }, 0);
    await actStep(page, { kind: 'wait-for', target: '[data-state="stalled"]' }, 1);

    expect(waited.map(each => each.timeout)).toEqual([40_000, 10_000]);
  });
});

// A designer approved a list it had only seen empty: nothing put a provider's answer on the page to see it filled.
describe('a source step played', () => {
  const pageRunning = { evaluate: <R, A>(fn: (input: A) => R, input: A) => Promise.resolve(fn(input)) };
  // Only evaluate is reached by a source step.
  const page = pageRunning as unknown as BrowserPage;
  const step: ActingStep = { kind: 'source', key: 'apiContainer_chart.clapped', value: [{ title: 'Night Drive' }] };

  it('writes the provider’s answer through the dev tools, and says a source no provider holds, or no dev tools', async () => {
    const setSource = vi.fn((path: string) => path.startsWith('apiContainer_chart.'));
    Reflect.set(window, '__plitzi', { setSource });
    try {
      expect(await actStep(page, step, 0)).toBeUndefined();
      expect(setSource).toHaveBeenCalledWith('apiContainer_chart.clapped', [{ title: 'Night Drive' }]);

      expect(await actStep(page, { kind: 'source', key: 'apiContainer_none.items', value: [] }, 1)).toEqual({
        problem: expect.stringContaining('no provider on the page holds a source named apiContainer_none') as unknown
      });
    } finally {
      Reflect.deleteProperty(window, '__plitzi');
    }

    expect(await actStep(page, step, 0)).toEqual({
      problem: expect.stringContaining('no window.__plitzi.setSource') as unknown
    });
  });
});
