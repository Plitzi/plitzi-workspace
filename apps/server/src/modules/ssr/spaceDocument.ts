import { mayReceive, withholdPages } from '@plitzi/sdk-shared/schema';

import { meterPage } from './meterPage';
import { SPACE_TOKEN_PARAM } from '../../core/auth/credentials';
import { offlineDataCacheKeyOf } from '../../helpers/cache';
import { digest, offlineDataWith, spaceDocument } from '../../helpers/hydrationPayload';

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

/** The space as it is now, for a page that renders it itself rather than one the server drew (`handleCurrentSpace`). */
export const CURRENT_SPACE_PATH = '/_plitzi/space.json';

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

const sendNoData = (res: SSRResponseHelpers, spaceId: number, environment: Environment): void => {
  res.setStatus(404);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.send(
    JSON.stringify({
      error: `This request resolves to space ${String(spaceId)} (${environment}), which has no data: getSpaceDeployment chose it from what this request carries — its host and credentials, never the page’s path or query`,
      reason: 'not_found'
    })
  );
};

/**
 * The space this request resolves to, as this visitor may be sent it — the pages they may not see emptied — and
 * published, so the page that names it next is answered without reading the space again. Kept as a page render keeps
 * it (`prepareRender`): an environment that is not the live draft is read once per version, and `cached` says this
 * request was answered from that copy — the cheaper visit, as a page served from the cache is.
 */
const documentNow = async (
  req: SSRRequest,
  config: SSRPageServerConfig,
  offlineDataCache: TtlCache<OfflineDataRaw> | undefined,
  { linkStyle }: { linkStyle: boolean }
): Promise<{ document: SpaceDocument; cached: boolean } | undefined> => {
  const { environment = 'main', revision = 0 } = req.ctx.spaceDeployment ?? {};
  const spaceId = req.ctx.spaceDeployment?.spaceId ?? 1;
  const cacheKey = offlineDataCacheKeyOf(req.ctx.spaceDeployment);
  const held = cacheKey ? offlineDataCache?.get(cacheKey) : undefined;
  const offlineData = held ?? (await config.adapters.getOfflineData(spaceId, environment, revision));
  if (!offlineData) {
    return undefined;
  }

  if (cacheKey && !held) {
    offlineDataCache?.set(cacheKey, offlineData);
  }

  const { schema, kept } = withholdPages(offlineData.schema, req.ctx.user);
  const document = spaceDocument(offlineDataWith(offlineData, schema), { linkStyle });
  publishSpaceDocument(spaceId, environment, document, kept);

  return { document, cached: held !== undefined };
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
  offlineDataCache?: TtlCache<OfflineDataRaw>
): Promise<void> => {
  const hash = DOCUMENT_PATH.exec(req.path)?.[1];
  // The page's own defaults (`renderSSR`), so a page that was drawn has a space to fetch.
  const { environment = 'main' } = req.ctx.spaceDeployment ?? {};
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
    // In the form the page was given it: a page that named its space by a token carries its stylesheet (`prepareRender`).
    const found = await documentNow(req, config, offlineDataCache, { linkStyle: !req.query[SPACE_TOKEN_PARAM] });
    if (!found) {
      sendNoData(res, spaceId, environment);

      return;
    }

    json = found.document.json;
    current = found.document.hash === hash;
  }

  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  // Shared caches only for a visitor nobody signed in: a space behind a sign-in is not a CDN's to hand out.
  res.setHeader(
    'Cache-Control',
    current ? `${req.ctx.user ? 'private' : 'public'}, max-age=31536000, immutable` : 'no-store'
  );
  res.send(json);
};

/** The decision about this visit a page drawn here is handed in its bootstrap, for a page that renders by itself. */
type VisitFacts = { overQuota?: true; quotaNear?: true; badge?: true };

/**
 * Lets a page of another origin read the space with its credential: the origins the credential was granted for
 * (`renderGrant` checked the page's against them), never any other. A page this host serves needs none of it.
 */
const allowOrigin = (req: SSRRequest, res: SSRResponseHelpers): void => {
  const origin = req.headers.origin;
  if (!origin || !req.ctx.spaceDeployment?.grantOrigins) {
    return;
  }

  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Vary', 'Origin');
};

/**
 * The browser's question before a page of another origin sends its credential: answered for any origin, because the
 * answer only lets it ASK — the request that follows is checked against the credential's own origins, and refused there.
 */
export const answerCurrentSpacePreflight = (req: SSRRequest, res: SSRResponseHelpers): void => {
  const origin = req.headers.origin;
  res.setStatus(204);
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    res.setHeader('Access-Control-Allow-Headers', 'authorization');
    res.setHeader('Access-Control-Max-Age', '600');
    res.setHeader('Vary', 'Origin');
  }

  res.end();
};

/**
 * Answers `/_plitzi/space.json`: the space as it is now, for a page that renders it itself — a site published as
 * files, an embed, the desktop app, a page this host serves that was not drawn here. The same document a page drawn
 * here fetches, with the decision about this visit beside it, which such a page is handed in its bootstrap.
 *
 * The space is whichever the request resolves to, as every request here: the host — a custom domain, the space's
 * own address — or the space's `render` credential (`renderGrant`), which names the environment and the revision with
 * it. A space chosen by its credential carries its stylesheet: the page asking may be anywhere, and a stylesheet
 * linked here would be asked for by the host, and answered with the host's own space. So does one asked for with
 * `?style=carried`, by a page drawing the space where its own stylesheet does not reach.
 *
 * A visit: counted as a page drawn here is, and held back as one is. Asked again unchanged, a `304`.
 */
export const handleCurrentSpace = async (
  req: SSRRequest,
  res: SSRResponseHelpers,
  config: SSRPageServerConfig,
  offlineDataCache?: TtlCache<OfflineDataRaw>
): Promise<void> => {
  const deployment = req.ctx.spaceDeployment;
  const { environment = 'main', revision = 0 } = deployment ?? {};
  const spaceId = deployment?.spaceId ?? 1;
  allowOrigin(req, res);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  // The host decides what it serves: another environment is asked for with the space's credential, which may choose.
  const asked = req.query.environment;
  if (!deployment?.grantOrigins && asked && asked !== environment) {
    res.setStatus(400);
    res.setHeader('Cache-Control', 'no-store');
    res.send(
      JSON.stringify({
        error: `This host serves the ${environment} environment of its space, not ${asked}: ask without one, or for ${asked} with the space's render credential (Authorization: Bearer)`,
        reason: 'environment'
      })
    );

    return;
  }

  // Carried when a credential chose the space, or the page asks: one drawn where the page's stylesheet does not reach.
  const linkStyle = !deployment?.grantOrigins && req.query.style !== 'carried';
  const found = await documentNow(req, config, offlineDataCache, { linkStyle });
  if (!found) {
    sendNoData(res, spaceId, environment);

    return;
  }

  const { document, cached } = found;
  const decision = deployment?.authoring
    ? undefined
    : await meterPage(req, config, spaceId, environment, revision, cached);
  if (decision?.unavailable !== undefined) {
    res.setStatus(503);
    res.setHeader('Cache-Control', 'no-store');
    res.send(JSON.stringify({ error: decision.unavailable, reason: 'unavailable' }));

    return;
  }

  const visit: VisitFacts = {
    ...(decision?.degrade ? { overQuota: true } : {}),
    ...(decision?.quotaNear && !decision.degrade ? { quotaNear: true } : {}),
    ...(decision?.badge ? { badge: true } : {})
  };
  const visitJson = JSON.stringify(visit);
  const etag = `"${document.hash}.${digest(visitJson)}"`;
  // Kept by the browser, and asked again every time: the space changes under the same address.
  res.setHeader('Cache-Control', 'private, no-cache');
  res.setHeader('ETag', etag);
  if (req.headers['if-none-match'] === etag) {
    res.setStatus(304);
    res.end();

    return;
  }

  res.send(`{"space":${document.json},"visit":${visitJson}}`);
};
