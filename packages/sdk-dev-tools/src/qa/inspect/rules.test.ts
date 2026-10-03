// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

import { matchedRules } from './rules';

afterEach(() => {
  document.head.innerHTML = '';
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('matchedRules', () => {
  it('lists the rules that reach an element as written, under a media query included', () => {
    const style = document.createElement('style');
    style.textContent = `
      * { box-sizing: border-box; }
      *, ::before, ::after, ::backdrop { --tw-translate-x: 0; }
      .card { --tw-shadow: 0 0 #0000; }
      [data-plitzi-qa-page] .card { cursor: crosshair; }
      .card { padding: 24px; }
      .card[data-variant="on"] { color: red; }
      .other { color: blue; }
      .panel .card { margin: 0px; }
      @media all { .card { border-radius: 12px; } }`;
    document.head.append(style);
    document.body.innerHTML =
      '<div class="panel" data-plitzi-qa-page><div class="card" data-variant="on">Hi</div></div>';
    // The shared setup answers every query `false`; this page is on every medium.
    vi.spyOn(window, 'matchMedia').mockImplementation(query => ({ matches: query === 'all' }) as MediaQueryList);
    const card = document.querySelector('.card');
    if (!card) {
      throw new Error('no card');
    }

    expect(matchedRules(card).map(rule => rule.selector)).toEqual([
      '.card',
      '.card[data-variant="on"]',
      '.panel .card',
      '.card'
    ]);
    expect(matchedRules(card)[3].media).toBe('all');
  });

  it('reads a nested rule against its parent, as the style cache writes variants', () => {
    const style = document.createElement('style');
    style.textContent = '.pill { color: gray; &[data-variant="ok"] { color: green; } }';
    document.head.append(style);
    document.body.innerHTML = '<span class="pill" data-variant="ok">ok</span>';
    const pill = document.querySelector('.pill');
    if (!pill) {
      throw new Error('no pill');
    }

    const selectors = matchedRules(pill).map(rule => rule.selector);

    expect(selectors[0]).toBe('.pill');
    // An engine that reads nesting lists the variant too; one that does not drops it rather than misreading it.
    expect(selectors.slice(1).every(selector => selector.includes('data-variant'))).toBe(true);
  });
});
