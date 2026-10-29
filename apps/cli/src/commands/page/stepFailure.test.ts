import { describe, expect, it } from 'vitest';

import { stepFailure } from './measureState';

// A run's agents met "locator.click: Timeout 3000ms exceeded." a dozen times, the first line alone, and could not act
// on it: Tremor's boot screen was over the page for its first seconds.
describe('why a press did not happen', () => {
  it('names what was over it, out of Playwright’s log', () => {
    const error = new Error(
      [
        'locator.click: Timeout 3000ms exceeded.',
        'Call log:',
        '  - waiting for locator(\'[data-plitzi-el="sort-strongest"]\').filter({ visible: true }).first()',
        '    - attempting click action',
        '      - element is not stable',
        '    - retrying click action',
        '      - <div class="boot" data-plitzi-el="boot">…</div> intercepts pointer events'
      ].join('\n')
    );

    expect(stepFailure(error)).toBe(
      'locator.click: Timeout 3000ms exceeded. — boot is drawn over it and takes the press — what covers it goes first (the step that closes it), or press that'
    );
  });

  it('says the first line alone when the log names nothing it waited on — and a press nothing answered, as such', () => {
    expect(stepFailure(new Error('locator.click: Target closed\nmore'))).toBe('locator.click: Target closed');
    // A development build 13 s busy as it loaded: the press timed out, and nothing in the log said why.
    expect(stepFailure(new Error('locator.click: Timeout 3000ms exceeded.'))).toBe(
      'locator.click: Timeout 3000ms exceeded. — the page did not answer the press, even once still: a wait-for <el> first waits for what it loads'
    );
  });
});
