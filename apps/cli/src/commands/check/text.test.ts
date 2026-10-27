import { describe, expect, it } from 'vitest';

import { reportText } from './text';

import type { CheckReport } from './types';

const report = (elements: CheckReport['elements']): CheckReport => ({
  path: '/combates',
  width: 1440,
  ok: true,
  checked: 40,
  problems: [],
  issues: [],
  hiddenAtWidth: [],
  outOfUse: [],
  empty: [],
  consoleErrors: [],
  failedRequests: [],
  devTools: true,
  lists: {},
  elements
});

// A component's part was read on the page, and its styles said "not on the page"; an id that
// is nobody's printed nothing it could act on.
describe('an element asked for, in a page’s report', () => {
  it('says why its styles cannot be read, as it is — and that nothing on the page is called so', () => {
    const text = reportText(
      report({
        'fight-card-corner-name': {
          read: { box: { width: 120 } },
          styles: {
            unread: 'fight-card-corner-name is no element of the space as authored, nor a part of any of its components'
          }
        },
        'fight-card-name': { read: null, styles: { unread: 'fight-card-name is not on the page at this width' } }
      }),
      { state: false, elements: ['fight-card-corner-name', 'fight-card-name'] }
    );

    expect(text).toContain('element fight-card-corner-name: {"box":{"width":120}}');
    expect(text).toContain(
      'element fight-card-corner-name: its styles cannot be read — fight-card-corner-name is no element of the space as authored'
    );
    expect(text).toContain("element fight-card-name: the page's dev tools read no element by that name");
    expect(text).not.toContain('is not on the page: its styles');
  });
});

// `--element room-card-tags` was answered "no element"; read now, it says whose part it is and which copy was read.
describe('a component’s part asked for', () => {
  it('says whose part it is, and that the first of its copies was read', () => {
    const text = reportText(
      report({
        'room-card-tags': {
          read: { box: { width: 200 } },
          styles: { contested: [], inert: [], wornBy: {}, copies: 6, partOf: 'room-card' }
        }
      }),
      { state: false, elements: ['room-card-tags'] }
    );

    expect(text).toContain(
      'element room-card-tags: a part of the component room-card, read on the first of the 6 copies the page draws'
    );
  });
});

// The layout's empty shell failed every page check until the task that fills it was done.
describe('containers with nothing in them yet', () => {
  it('are said apart, failing nothing', () => {
    const text = reportText(
      { ...report(undefined), empty: ['site-header', 'site-nav'] },
      { state: false, elements: [] }
    );

    expect(text).toContain('nothing wrong');
    expect(text).toContain('empty, with nothing in them yet and no size: site-header, site-nav');
  });
});

// A run's page whose purpose is a refusal was ✗ at every width: the provider failed, and the page showed its words.
describe('a provider failure the page shows', () => {
  it('is said apart, failing nothing', () => {
    const text = reportText(
      {
        ...report(undefined),
        shownFailures: ['apiContainer_dmThread — Nobody here goes by that name. — shown by dm-missing-words']
      },
      { state: false, elements: [] }
    );

    expect(text).toContain('nothing wrong');
    expect(text).toContain(
      'failed, and the page shows it: apiContainer_dmThread — Nobody here goes by that name. — shown by dm-missing-words'
    );
  });
});

describe('the sources a page holds, with --state', () => {
  it('says what each key holds — a short value as it is, a list or an object by its size', () => {
    const text = reportText(
      {
        ...report(undefined),
        sources: {
          channel_siteInbox: { connected: true, unread: 3, me: { name: 'dax' }, rows: [1, 2], note: 'x'.repeat(40) }
        }
      },
      { state: true, elements: [] }
    );

    expect(text).toContain(
      `· source channel_siteInbox: { connected: true, unread: 3, me: {1}, rows: [2], note: "${'x'.repeat(28)}… }`
    );
  });
});

// A run's "ROOFTOP SESSIO…" passed every check a run made: a text cut short is said, as it is not a problem itself.
describe('a text a box cuts, in a page’s report', () => {
  it('is said with the way to hold one whole — never as a problem', () => {
    const text = reportText({ ...report({}), cut: ['show-plate-room'] }, { state: false, elements: [] });
    expect(text).toContain('cut short at this width, by a box that cuts its text');
    expect(text).toContain('show-plate-room');
    expect(text).toContain('--expect "<id>~<text>" holds one whole');
  });
});

// A guest's element read "hidden" on a members' page, read signed in by itself, and the failure did not say so.
describe('a page read signed in', () => {
  it('says the account on its headline, and how to read it as a guest where it fails', () => {
    const signed = { ...report({}), signedInAs: 'mika' };

    expect(reportText(signed, { state: false, elements: [] })).toContain('/combates at 1440 px, signed in as mika');
    const failed = reportText(
      { ...signed, ok: false, problems: ['room-claps-signin is hidden'] },
      { state: false, elements: [] }
    );
    expect(failed).toContain('read signed in as mika: what a guest sees, --guest');
  });
});
