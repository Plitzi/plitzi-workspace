import { mayReceive, withholdPages } from '@plitzi/sdk-shared/schema';

import { buildOfflineDataCacheKey } from '../../helpers/cache';
import { spaceDocument } from '../../helpers/hydrationPayload';

import type { TtlCache } from '../../helpers/cache';
import type { SpaceDocument } from '../../helpers/hydrationPayload';
import type {
  Environment,
  OfflineDataRaw,
  SSRPageServerConfig,
  SSRRequest,
  SSRResponseHelpers
} from '@plitzi/sdk-shared';
import type { PageAccess } from '@plitzi/sdk-shared/schema';

/**
 * The whole space as a resource of its own, beside the page rather than inside it.
 *
 * Embedded, it was most of every document — megabytes of a big space, before the first word of the page — and it was
 * downloaded again on every page and every visit. Apart, the page arrives at the size of what it shows, and the space
 * is fetched while the scripts are, once: its address is its content's hash, so it is kept until it changes.
 *
 * It is still the whole space: the server draws the first page, and every page after it is the browser's, with no
 * server to ask.
 */
export const SPACE_DOCUMENT_PATH = '/_plitzi/space/';

const DOCUMENT_PATH = /^\/_plitzi\/space\/([\w-]{1,64})\.json$/;

/**
 * The documents this process just put in a page, so the request that follows is answered without reading the space
 * again. Bounded: a document is megabytes, and only the latest of each space is ever asked for twice.
 */
const RECENT = 8;
/**
 * A document, and the accesses of the protected pages it holds whole: it is handed only to a visitor who meets every
 * one. A document is named by its content, so one built for somebody with more access than the asker — a link to it
 * passed on — would otherwise reach them by its name alone.
 */
type RecentDocument = { json: string; kept: PageAccess[] };

const recent = new Map<string, RecentDocument>();

const recentKey = (spaceId: number, environment: Environment, hash: string): string =>
  `${String(spaceId)}|${environment}|${hash}`;

/** Where the page fetches `document` from — and the promise that this process can answer it. */
export const publishSpaceDocument = (
  spaceId: number,
  environment: Environment,
  document: SpaceDocument,
  kept: PageAccess[] = []
): string => {
  const key = recentKey(spaceId, environment, document.hash);
  recent.delete(key);
  recent.set(key, { json: document.json, kept });
  for (const oldest of recent.keys()) {
    if (recent.size <= RECENT) {
      break;
    }

    recent.delete(oldest);
  }

  return `${SPACE_DOCUMENT_PATH}${document.hash}.json`;
};

/**
 * Answers `/_plitzi/space/<hash>.json` for the space this host serves, behind the same gates as its pages.
 *
 * Every page of a space already carried all of it, so whoever may open one page may read this. A hash this process
 * did not just publish is looked up from the space as it is now: the same text when another process published it,
 * or the space as it changed since — answered all the same, since it is what the page will find on its next load,
 * but not to be kept under a name that is not its own.
 */
export const handleSpaceDocument = async (
  req: SSRRequest,
  res: SSRResponseHelpers,
  config: SSRPageServerConfig,
  offlineDataCache?: TtlCache<string>
): Promise<void> => {
  const hash = DOCUMENT_PATH.exec(req.path)?.[1];
  // The page's own defaults (`renderSSR`), so a page that was drawn has a space to fetch.
  const { environment = 'main', revision = 0, flagsVersion } = req.ctx.spaceDeployment ?? {};
  const spaceId = req.ctx.spaceDeployment?.spaceId ?? 1;
  if (!hash) {
    res.setStatus(404);
    res.end();

    return;
  }

  const known = recent.get(recentKey(spaceId, environment, hash));
  let json = known && mayReceive(known.kept, req.ctx.user) ? known.json : undefined;
  let current = json !== undefined;
  if (json === undefined) {
    const cacheKey =
      environment !== 'main' ? buildOfflineDataCacheKey(spaceId, environment, revision, flagsVersion) : undefined;
    const cached = cacheKey ? offlineDataCache?.get(cacheKey) : undefined;
    const offlineData = cached
      ? (JSON.parse(cached) as OfflineDataRaw | undefined)
      : await config.adapters.getOfflineData(spaceId, environment, revision);
    if (!offlineData) {
      res.setStatus(404);
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.send(
        JSON.stringify({
          error: `This request resolves to space ${String(spaceId)} (${environment}), which has no data: getSpaceDeployment chose it from what this request carries — its host and credentials, never the page’s path or query`,
          reason: 'not_found'
        })
      );

      return;
    }

    // As this visitor may be sent it: the pages they may not see, emptied — whatever the document asked for held.
    const { schema, withheld, kept } = withholdPages(offlineData.schema, req.ctx.user);
    const document = spaceDocument(withheld.length > 0 ? { ...offlineData, schema } : offlineData);
    publishSpaceDocument(spaceId, environment, document, kept);
    json = document.json;
    current = document.hash === hash;
  }

  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  // Shared caches only for a visitor nobody signed in: a space behind a sign-in is not a CDN's to hand out.
  res.setHeader(
    'Cache-Control',
    current ? `${req.ctx.user ? 'private' : 'public'}, max-age=31536000, immutable` : 'no-store'
  );
  res.send(json);
};
