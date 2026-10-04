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
      xray: true,
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

  it('draws every box with the x-ray, and the wiring asked for over it — none for the boxes alone', () => {
    const all = qaCss({ ...QA_DEFAULTS, xray: true });
    const flows = qaCss({ ...QA_DEFAULTS, xray: true, xrayFilter: 'flows' });
    const boxes = qaCss({ ...QA_DEFAULTS, xray: true, xrayFilter: 'none' });

    for (const css of [all, flows, boxes]) {
      expect(css).toContain('[data-plitzi-el] { outline: 1px dashed');
      expect(css).toContain('attr(data-type)');
    }

    expect(all).toContain('[data-plitzi-qa-xray~="data"]');
    expect(flows).toContain('[data-plitzi-qa-xray~="flows"]');
    expect(flows).not.toContain('[data-plitzi-qa-xray~="data"]');
    expect(boxes).not.toContain('data-plitzi-qa-xray');
  });
});
