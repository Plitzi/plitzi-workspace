// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';

import { SPACE_FAILURE_META } from '@plitzi/sdk-shared/devTools';

import { refusedText } from './space';
import { spaceFailureOn } from '../visit';

import type { BrowserPage } from '../../../browser';

/** A stand-in of a page: what `spaceFailureOn` asks of one — the page's own document, read in it. */
const pageOf = (html: string) => {
  document.documentElement.innerHTML = html;

  return {
    evaluate: <A, R>(read: (arg: A) => R, arg: A) => Promise.resolve(read(arg))
  } as unknown as BrowserPage;
};

// `page measure` answered "No element …" six times on the server's page for a space that did not author.
describe("the server's page for a space that does not author", () => {
  it('is said with what the server said, and a page of the space is not', async () => {
    expect(
      await spaceFailureOn(
        pageOf(
          `<head><meta name="${SPACE_FAILURE_META}" content="1"></head><body><pre>ReferenceError: when is not defined\n  at …</pre></body>`
        )
      )
    ).toBe(
      "the space does not author, so the page is the server's error page — ReferenceError: when is not defined · at …: npm run author says why"
    );
    // A run's dev-2 read a count of problems and none of them: what follows the first line is said too.
    expect(
      await spaceFailureOn(
        pageOf(
          `<head><meta name="${SPACE_FAILURE_META}" content="1"></head><body><pre>The space has 1 problem\n\n  page sign-in: step url navigation.pathname is not a source</pre></body>`
        )
      )
    ).toContain('The space has 1 problem · page sign-in: step url navigation.pathname is not a source');
    expect(await spaceFailureOn(pageOf('<head></head><body><main data-hydrated>a page</main></body>'))).toBeUndefined();
  });
});

describe('what authoring refused, in page check', () => {
  it('is its first lines, never the count alone', () => {
    expect(refusedText('The space has 1 problem\n\n  page sign-in: step url navigation.pathname is not a source')).toBe(
      'The space has 1 problem · page sign-in: step url navigation.pathname is not a source'
    );
  });
});
