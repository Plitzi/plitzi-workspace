import { describe, expect, it } from 'vitest';

import { keptToParts } from './apart';
import { answeredImage, throttledImage } from './inspect';

import type { CheckReport } from './types';

const report = (issues: CheckReport['issues']): CheckReport => ({
  path: '/',
  width: 1440,
  ok: false,
  checked: 40,
  problems: issues.map(issue => issue.message),
  issues,
  hiddenAtWidth: [],
  consoleErrors: [],
  failedRequests: [],
  devTools: true,
  lists: {}
});

const parts = { ids: new Set(['home-times']), all: new Set(['home-times', 'home-video-main']) };

describe('a page checked in a task’s copy', () => {
  it('passes on its own part, the other tasks’ findings said apart', () => {
    const kept = keptToParts(
      report([
        { code: 'label-wraps', message: 'home-video-main’s label wraps', elementId: 'home-video-main', width: 1440 }
      ]),
      parts
    );

    expect(kept).toMatchObject({ ok: true, issues: [], apart: ['home-video-main’s label wraps'] });
  });

  it('still fails on its own elements, and on what no element names', () => {
    const own = keptToParts(
      report([{ code: 'label-wraps', message: 'home-times wraps', elementId: 'home-times', width: 1440 }]),
      parts
    );
    const page = keptToParts(
      report([{ code: 'page-status', message: 'the page was sent with status 500', width: 390 }]),
      parts
    );

    expect(own.ok).toBe(false);
    expect(page.ok).toBe(false);
  });
});

describe('an image the browser was answered for', () => {
  it('is loaded, though it draws no size of its own — an SVG flag with only a viewBox', () => {
    const answered = new Set(['https://cdn.example.com/flags/es.svg']);

    expect(
      answeredImage(
        { code: 'image-not-loaded', message: 'an image never loaded: https://cdn.example.com/flags/es.svg' },
        answered
      )
    ).toBe(true);
    expect(
      answeredImage(
        { code: 'image-not-loaded', message: 'an image never loaded: https://cdn.example.com/flags/xx.svg' },
        answered
      )
    ).toBe(false);
  });
});

describe('an image its host held back (429)', () => {
  it('is the host’s limit, named apart — never the page’s failure', () => {
    const throttled = new Set(['https://cdn.example.com/flags/es.svg']);
    const issue = (address: string) => ({ code: 'image-not-loaded', message: `an image never loaded: ${address}` });

    expect(throttledImage(issue('https://cdn.example.com/flags/es.svg'), throttled)).toBe(
      'https://cdn.example.com/flags/es.svg'
    );
    expect(throttledImage(issue('https://cdn.example.com/flags/xx.svg'), throttled)).toBeUndefined();
    expect(
      throttledImage({ code: 'broken-link', message: 'https://cdn.example.com/flags/es.svg' }, throttled)
    ).toBeUndefined();
  });
});
