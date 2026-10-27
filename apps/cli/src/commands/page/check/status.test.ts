import { describe, expect, it } from 'vitest';

import { statusIssuesOf } from './status';

const at = { pathname: '/r/rooftop-sessions', width: 1440, notFoundPage: false, meant: '' };

describe("a page's status, beside what was asked", () => {
  // A run's look read /r/rooftop-sessions — no such room, its provider's notFound — as "nothing wrong".
  it('fails a 404 a page of the space was sent with, unasked — never one asked with --status 404', () => {
    expect(statusIssuesOf({ ...at, sentWith: 404 }).map(issue => issue.message)).toEqual([
      "/r/rooftop-sessions was sent with status 404: its page's data said nothing is there (a provider's notFound) — an address that is no page, or data the page lacks; a page meant to answer 404 is checked with --status 404"
    ]);
    expect(statusIssuesOf({ ...at, sentWith: 404, asked: 404 })).toEqual([]);
    expect(statusIssuesOf({ ...at, sentWith: 200 })).toEqual([]);
  });

  it('says the space’s own not-found page as no page there, and one sent with 200 as one a crawler keeps', () => {
    expect(statusIssuesOf({ ...at, sentWith: 404, notFoundPage: true }).map(issue => issue.code)).toEqual(['no-page']);
    expect(statusIssuesOf({ ...at, sentWith: 200, notFoundPage: true }).map(issue => issue.code)).toEqual([
      'page-status'
    ]);
  });
});
