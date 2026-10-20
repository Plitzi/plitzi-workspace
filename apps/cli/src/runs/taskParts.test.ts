import { describe, expect, it } from 'vitest';

import { findingsOf } from './taskParts';

describe('a task’s part of a page', () => {
  it('keeps the findings on its own elements and sets apart the ones only of other tasks’ parts', () => {
    const parts = {
      ids: new Set(['home-info', 'home-faq']),
      all: new Set(['home-info', 'home-faq', 'home-top', 'home-results']),
      tops: ['home-info'],
      ownsRoot: false
    };
    const check = [
      '✗ / at 1440 px',
      '  - container "home-top" is on the page but not visible: it has no size (1440×0)',
      '  - container "home-results" is on the page but not visible: it has no size (1440×0)',
      '  - list "home-faq" has a row with no words',
      '  - the page has no h1'
    ].join('\n');

    expect(findingsOf(check, parts)).toEqual({
      text: ['✗ / at 1440 px', '  - list "home-faq" has a row with no words', '  - the page has no h1'].join('\n'),
      apart: 2
    });
  });
});
