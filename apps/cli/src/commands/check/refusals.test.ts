import { describe, expect, it } from 'vitest';

import { splitRefusals } from './refusals';

const origin = 'http://127.0.0.1:8080';
const lines = [
  {
    text: 'Failed to load resource: the server responded with a status of 401 (Unauthorized)',
    from: `${origin}/auth/login`
  },
  { text: 'TypeError: x is undefined', from: `${origin}/assets/app.js` }
];

// A run's sign-in check, after a wrong password the page says, failed on the platform's 401 and the browser's line.
describe('a request the page refused', () => {
  it('is the page’s handled refusal when its own fetch was answered 4xx and no flow failed', () => {
    expect(
      splitRefusals({
        requested: ['401 /auth/login', '404 /missing.png'],
        refusedFetches: new Set(['401 /auth/login']),
        flowFailed: false,
        lines,
        origin
      })
    ).toEqual({ failedRequests: ['404 /missing.png'], handled: ['401 /auth/login'], lines: [lines[1]] });
  });

  it('stays the page’s failure beside a flow that failed', () => {
    expect(
      splitRefusals({
        requested: ['401 /auth/login'],
        refusedFetches: new Set(['401 /auth/login']),
        flowFailed: true,
        lines,
        origin
      })
    ).toEqual({ failedRequests: ['401 /auth/login'], handled: [], lines });
  });
});
