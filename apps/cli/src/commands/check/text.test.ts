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

// velada-polish's design-2: a component's part was read on the page, and its styles said "not on the page"; an id that
// is nobody's printed nothing it could act on.
describe('an element asked for, in a page’s report', () => {
  it('says why its styles cannot be read, as it is — and that nothing on the page is called so', () => {
    const text = reportText(
      report({
        'fight-card-corner-name': {
          read: { box: { width: 120 } },
          styles: {
            unread:
              "fight-card-corner-name is no element of the space as authored — a component's part is named by its instance's id"
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

// lx-copy: the layout's empty shell failed every page check until the task that fills it was done.
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
