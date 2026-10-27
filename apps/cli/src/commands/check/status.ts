import { NOT_FOUND_PROBE } from './space';

import type { CheckIssue } from './types';

/**
 * Why a page refused who read it, in words: signed in, the account is in and the page's access refuses it — a run's
 * admin read "/moderation was sent with status 403" and its developer looked for a password that was there; not signed
 * in, a page for signed-in visitors.
 */
export const refusedWhy = (status: number, signedInAs: string | undefined): string =>
  status !== 401 && status !== 403
    ? ''
    : signedInAs !== undefined
      ? `: signed in as ${signedInAs}, and the page's access refuses it — a permission or role the account lacks (its access, beside the account's roles)`
      : ': a page for signed-in visitors — check it signed in (--as <account>)';

/** What a page's status says of it, beside what was asked: the issues a check reads off the status it was sent with. */
export const statusIssuesOf = ({
  pathname,
  width,
  sentWith,
  asked,
  notFoundPage,
  signedInAs,
  meant
}: {
  pathname: string;
  width: number;
  /** The status the page was sent with, when the browser saw one. */
  sentWith: number | undefined;
  /** `--status`: the one the page is meant to be sent with. */
  asked?: number;
  /** The space's own page for an address nothing answers is what came. */
  notFoundPage: boolean;
  signedInAs?: string;
  /** Which page of the space the address may have meant, said after the no-page issue. */
  meant: string;
}): CheckIssue[] => {
  // Asked for a status (`--status 404`): the page sent with it is what was meant — its 404 page, on purpose — and one
  // sent with another is the finding. A run's designer saw its intended 404 page marked ✗, with no way to say it.
  if (asked !== undefined) {
    return sentWith === asked
      ? []
      : [
          {
            code: 'page-status',
            message: `${pathname} was sent with status ${String(sentWith ?? 'none')}, not the ${String(asked)} asked (--status)`,
            width
          }
        ];
  }

  if (notFoundPage && sentWith !== undefined && sentWith !== 404) {
    return [
      {
        code: 'page-status',
        message: `${pathname} shows the page for an address nothing answers, sent with status ${String(sentWith)}: a crawler reads it as a page that exists — the server should send it with 404`,
        width
      }
    ];
  }

  // Sent 404 by a page of the space — a route's provider said nothing is there — with no 404 asked: an address that is
  // no page. encore-14's look read /r/rooftop-sessions, a room that does not exist, as "nothing wrong".
  if (sentWith === 404 && !notFoundPage) {
    return [
      {
        code: 'page-status',
        message: `${pathname} was sent with status 404: its page's data said nothing is there (a provider's notFound) — an address that is no page, or data the page lacks; a page meant to answer 404 is checked with --status 404`,
        width
      }
    ];
  }

  if (sentWith !== undefined && sentWith >= 400 && sentWith !== 404) {
    return [
      {
        code: 'page-status',
        message: `${pathname} was sent with status ${String(sentWith)}${refusedWhy(sentWith, signedInAs)}`,
        width
      }
    ];
  }

  // Asked for a page, the space's page for an address nothing answers came: no page of it is there. Only the address a
  // whole-project check makes for it looks at that page on purpose.
  return notFoundPage && !pathname.endsWith(NOT_FOUND_PROBE)
    ? [
        {
          code: 'no-page',
          message: `no page of the space is at ${pathname}: its page for an address nothing answers came, with ${String(sentWith ?? 404)}${meant}`,
          width
        }
      ]
    : [];
};
