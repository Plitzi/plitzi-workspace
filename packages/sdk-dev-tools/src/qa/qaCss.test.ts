import { describe, expect, it } from 'vitest';

import { qaCss } from './qaCss';
import { QA_DEFAULTS, isQaActive } from './qaSettings';

describe('qaCss', () => {
  it('adds nothing while nothing is on', () => {
    expect(qaCss(QA_DEFAULTS)).toBe('');
    expect(isQaActive(QA_DEFAULTS)).toBe(false);
  });

  it('scopes every rule to the page, never the panel', () => {
    const css = qaCss({
      ...QA_DEFAULTS,
      outlines: true,
      paused: true,
      vision: 'protanopia',
      checks: { ...QA_DEFAULTS.checks, overflow: true, names: true }
    });
    const selectors = css.match(/^[^{}\n]+(?=\{)/gm) ?? [];

    expect(selectors.length).toBeGreaterThan(4);
    expect(selectors.every(selector => selector.includes('[data-plitzi-qa-page]'))).toBe(true);
    expect(css).toContain('filter: url(#plitzi-qa-protanopia)');
    expect(css).toContain('[data-plitzi-qa-finding~="overflow"]');
    expect(css).not.toContain('[data-plitzi-qa-finding~="targets"]');
  });
});
