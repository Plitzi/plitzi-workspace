import type { SSRRequest } from '@plitzi/sdk-shared';

// Query param carrying a draft-preview token. A normal render sees it, resolves the stashed draft offline-data from
// the draft store, and renders that instead of the persisted state. Shared by the SSR render path (reads it) and
// sdk-mcp's screenshot client (appends it) — two packages now, so it sits in the kernel: the only module both can
// reach without either depending on the other's render path.
export const PREVIEW_TOKEN_PARAM = '__pt';

/**
 * Where a REUSABLE draft token is remembered for the rest of the visit.
 *
 * The query param alone previews one URL, which is all a screenshot ever needed. A person iterating does more than
 * look at one URL: they follow a link, the SDK asks `/_rsc` for fresh data, they press back. Every one of those is a
 * request without the param, and answering the saved space to a browser that is looking at a draft is the kind of
 * confusion that gets reported as "the preview randomly reverts".
 *
 * `HttpOnly` because nothing in the page has any use for it, and `SameSite=Lax` so another site cannot cause a draft
 * to be resolved in a visitor's browser. It is set only for a token the store minted as reusable.
 */
export const PREVIEW_COOKIE = 'plitzi_draft';

const cookieValue = (header: string | undefined, name: string): string | undefined => {
  if (!header) {
    return undefined;
  }

  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator > 0 && part.slice(0, separator).trim() === name) {
      return decodeURIComponent(part.slice(separator + 1).trim());
    }
  }

  return undefined;
};

/**
 * The draft this request is looking at, whichever way it says so.
 *
 * The query param wins: it is how a session is STARTED, and re-minting while an older one is still in the cookie has
 * to answer the new draft or the loop shows stale work.
 */
export const readDraftToken = (req: SSRRequest): string | undefined => {
  const fromQuery = req.query[PREVIEW_TOKEN_PARAM];

  return fromQuery || cookieValue(req.headers.cookie, PREVIEW_COOKIE);
};
