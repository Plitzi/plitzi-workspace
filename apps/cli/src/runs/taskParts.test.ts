import { describe, expect, it } from 'vitest';

import { findingsOf, lookClips } from './taskParts';

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

// `task look --within` was refused in seven runs running: page outline took it, the look did not.
describe('the parts a look pictures', () => {
  const parts = (tops: string[], ownsRoot = false) => ({ ids: new Set(tops), all: new Set(tops), tops, ownsRoot });

  it('is the one asked for, else the task’s own — the page whole past three, or when it owns the root', () => {
    expect(lookClips(parts(['home-info']), 'show-plate-root')).toEqual({ clips: ['show-plate-root'], many: false });
    expect(lookClips(parts(['home-info', 'home-faq']))).toEqual({ clips: ['home-info', 'home-faq'], many: false });
    expect(lookClips(parts(['a', 'b', 'c', 'd']))).toEqual({ clips: [], many: true });
    expect(lookClips(parts(['a', 'b', 'c', 'd']), 'b')).toEqual({ clips: ['b'], many: false });
    expect(lookClips(parts(['page-root'], true))).toEqual({ clips: [], many: false });
    expect(lookClips(undefined)).toEqual({ clips: [], many: false });
  });
});
