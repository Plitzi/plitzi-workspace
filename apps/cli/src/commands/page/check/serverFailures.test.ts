import { describe, expect, it } from 'vitest';

import { serverFailedIssues } from './serverFailures';

// A conversation's provider failed on the page server on every load and the browser answered it after: every check
// said "nothing wrong".
describe('a server provider that failed on the page server', () => {
  it('is said when the browser answered it after, and left to the data when it still fails', () => {
    const issues = serverFailedIssues(
      { dmThread: 'invalid_input — Invalid input: with', room: 'down' },
      { apiContainer_dmThread: { data: { lines: [] }, hasError: false }, apiContainer_room: { hasError: true } },
      390
    );

    expect(issues).toEqual([
      {
        code: 'server-render-failed',
        message:
          'apiContainer_dmThread failed on the page server — invalid_input — Invalid input: with — and was answered in the browser after: the first paint and a crawler lack it, and the server logs it on every load',
        elementId: 'dmThread',
        width: 390
      }
    ]);
  });
});
