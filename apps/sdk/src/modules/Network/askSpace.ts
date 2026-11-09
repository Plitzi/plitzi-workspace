import { authFailureFromResponse, reportAuthFailure } from '@plitzi/sdk-shared/auth';
import { isRecord } from '@plitzi/sdk-shared/helpers';

import type { BadgeLinks, Environment, OfflineDataRaw } from '@plitzi/sdk-shared';

/** Where the page server answers the space as it is now (sdk-server's `handleCurrentSpace`). */
export const CURRENT_SPACE_PATH = '/_plitzi/space.json';

/** What the page server decided about this visit: what a page it draws is handed in its bootstrap. */
export type VisitFacts = { overQuota?: boolean; quotaNear?: boolean; badge?: BadgeLinks };

export type SpaceAnswer = { ok: true; space: OfflineDataRaw; visit: VisitFacts } | { ok: false; message: string };

export type AskSpaceOptions = {
  /** The page server: the space's own host, or the platform's when the page is served elsewhere. */
  ssrServer: string;
  /** The space's public `render` credential, for a page served anywhere but the space's own host. */
  webKey: string;
  environment: Environment;
  /** `0`, or none, for the live one. */
  revision?: number;
  /** For a space drawn where the page's stylesheet does not reach: the document then carries it. */
  carryStyle: boolean;
};

const isBadge = (value: unknown): value is BadgeLinks =>
  isRecord(value) && typeof value.madeWith === 'string' && typeof value.report === 'string';

const isVisit = (value: unknown): value is VisitFacts =>
  isRecord(value) &&
  Object.entries(value).every(([fact, said]) => (fact === 'badge' ? isBadge(said) : typeof said === 'boolean'));

const errorOf = (body: unknown): string | undefined =>
  isRecord(body) && typeof body.error === 'string' ? body.error : undefined;

/**
 * Asks the page server for the space, the way a page it draws fetches it: the space is the one the request resolves
 * to there. With the credential, the credential's — and the environment and revision asked for; without it, the host's
 * own (a custom domain, the space's address), whatever this page's defaults say, so neither is sent.
 *
 * Every failure is said in words a visitor can act on, and a refused credential goes to the auth-failure channel, as
 * any request the SDK makes does.
 */
export const askSpace = async ({
  ssrServer,
  webKey,
  environment,
  revision = 0,
  carryStyle
}: AskSpaceOptions): Promise<SpaceAnswer> => {
  const address = new URL(CURRENT_SPACE_PATH, ssrServer || window.location.origin);
  if (webKey) {
    address.searchParams.set('environment', environment);
    if (revision > 0) {
      address.searchParams.set('revision', String(revision));
    }
  }

  if (carryStyle) {
    address.searchParams.set('style', 'carried');
  }

  let response: Response;
  try {
    response = await fetch(address, {
      headers: webKey ? { authorization: `Bearer ${webKey}` } : {},
      // The visitor's session where the page server sees one: the pages only they may open come with it.
      credentials: 'include'
    });
  } catch {
    return { ok: false, message: 'Service not available' };
  }

  const body: unknown = await response.json().catch(() => undefined);
  if (!response.ok) {
    const reason = authFailureFromResponse(response.status, body);
    if (reason) {
      void reportAuthFailure({ reason, url: address.href });
    }

    // Refused outright too: a credential a host of the platform will not take for this space, or this page.
    if (reason || response.status === 401 || response.status === 403) {
      return { ok: false, message: 'Access not authorized' };
    }

    if (response.status === 404) {
      return { ok: false, message: `Space not found: publish it to the ${environment} environment` };
    }

    return { ok: false, message: errorOf(body) ?? `The space could not be loaded (${String(response.status)})` };
  }

  if (!isRecord(body) || !isRecord(body.space) || !isRecord(body.space.schema) || !isVisit(body.visit)) {
    return { ok: false, message: 'The page server answered something that is not a space' };
  }

  // The page server's own document, checked above for the parts this reads; the rest is the space as it wrote it.
  const space = body.space as unknown as OfflineDataRaw;
  const { cacheHref } = space.style;

  return {
    ok: true,
    // Its stylesheet is the page server's: a page served elsewhere links it there.
    space: cacheHref ? { ...space, style: { ...space.style, cacheHref: new URL(cacheHref, address).href } } : space,
    visit: body.visit
  };
};
