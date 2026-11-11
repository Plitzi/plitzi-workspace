import { randomUUID } from 'node:crypto';

import { closest } from '@plitzi/sdk-authoring';
import { buildBody } from '@plitzi/sdk-server/ssr';
import { getPageFullPath, getSlugParams } from '@plitzi/sdk-shared/navigation';

import { computeVersion, findPageByRef, getPageElements } from '../modules/mcp/helpers';
import { draftBatch } from '../modules/mcp/tools/shared/draftBatch';

import type { PreviewRequestBody, PreviewResult } from '../modules/mcp/types';
import type { SSRRequest } from '@plitzi/sdk-kernel/types';
import type { SSRPageServerConfig, SSRTemplateFn } from '@plitzi/sdk-server';
import type { PluginManager, ServerCaches } from '@plitzi/sdk-server/ssr';
import type { Environment, Schema } from '@plitzi/sdk-shared';

/** A route parameter, as a slug spells it: `:spaceId` or `{{spaceId}}`. */
const ROUTE_PARAM = /:([A-Za-z0-9_-]+)|{{\s*([A-Za-z0-9_-]+)\s*}}/g;

type ResolvedPage = { path: string; signedInOnly: boolean } | { refused: string };

/**
 * The address of the page asked for — its folders' slugs before its own, as a link to it resolves, its parameters
 * filled — or why there is none. A page the space does not have is refused, never drawn as its home, and a page whose
 * path takes a parameter not given is refused naming it, never opened at its pattern (the space's 404).
 */
const resolvePage = (schema: Schema, pageRef?: string, routeParams: Record<string, string> = {}): ResolvedPage => {
  const pages = getPageElements(schema);
  const page = pageRef ? findPageByRef(schema, pageRef) : (pages.find(p => p.attributes.default) ?? pages[0]);
  if (!page) {
    const nearest = pageRef
      ? closest(
          pageRef,
          pages.map(p => p.id)
        )
      : undefined;

    return {
      refused: pageRef
        ? `The space has no page "${pageRef}"${nearest ? ` — did you mean "${nearest}"?` : ''}`
        : 'The space has no page to draw'
    };
  }

  const pattern = getPageFullPath(schema.flat, schema.pageFolders, page.id, true);
  const missing = getSlugParams(pattern).filter(name => !routeParams[name]);
  if (missing.length > 0) {
    return {
      refused: `"${page.id}" is at ${pattern}: give routeParams its ${missing.join(', ')} — { ${missing.map(name => `"${name}": "…"`).join(', ')} }`
    };
  }

  return {
    path: pattern.replace(ROUTE_PARAM, (_, colon?: string, braces?: string) =>
      encodeURIComponent(routeParams[colon ?? braces ?? ''] ?? '')
    ),
    signedInOnly: page.attributes.accessLevel === 'authenticated'
  };
};

const isStringRecord = (value: unknown): value is Record<string, string> =>
  typeof value === 'object' &&
  value !== null &&
  !Array.isArray(value) &&
  Object.values(value).every(entry => typeof entry === 'string');

const syntheticRequest = (pagePath: string): SSRRequest => ({
  method: 'GET',
  path: pagePath,
  search: '',
  url: pagePath,
  hostname: 'localhost',
  protocol: 'https',
  headers: {},
  query: {},
  ctx: {}
});

/** Build a preview of a page: apply any unsaved `operations` to a clone (never persisted), render the resulting
 *  draft to full HTML via the SSR pipeline, and stash the draft under a token so a browser can fetch the exact same
 *  render at `?__pt=<token>`. With no operations it previews persisted state.
 *
 *  The token is one-shot unless `mode: 'session'` asks for one somebody can iterate against — see `mode`.
 *
 *  Renders through the host page server's own singletons, which is why it takes them as arguments rather than
 *  building any: this runs as a stage INSIDE an SSR server, not in the MCP process that calls it over HTTP. */
export const createPreview = async (
  body: PreviewRequestBody,
  config: SSRPageServerConfig,
  renderFn: SSRTemplateFn,
  pluginManager: PluginManager,
  caches: ServerCaches
): Promise<PreviewResult> => {
  const env = (body.env ?? 'main') as Environment;
  const revision = env === 'main' ? 0 : (body.revision ?? 0);

  const offlineData = await config.adapters.getOfflineData(body.spaceId, env, revision);
  if (!offlineData) {
    return {
      ok: false,
      error: 'missing',
      message: `No offline data for space ${body.spaceId} (${env}${revision ? ` revision ${revision}` : ''}).`
    };
  }

  let draftOffline = offlineData;
  if (body.operations && body.operations.length > 0) {
    // The batch as plitzi_apply would save it — expanded, read, fixed, checked and applied by the one path every tool
    // takes — so the page shown is the page that would be saved.
    const batch = draftBatch(
      { schema: offlineData.schema, style: offlineData.style, connectors: [], actions: [] },
      env,
      body.operations
    );
    if (!batch.ok) {
      return {
        ok: false,
        error: 'bad-value',
        message: 'The operations were refused, as plitzi_apply would refuse them.',
        errors: batch.errors
      };
    }

    draftOffline = { ...offlineData, schema: batch.draft.schema, style: batch.draft.style };
  }

  if (body.routeParams !== undefined && !isStringRecord(body.routeParams)) {
    return { ok: false, error: 'bad-value', message: 'routeParams is an object of strings: { "spaceId": "42" }' };
  }

  const resolved = resolvePage(draftOffline.schema, body.pageRef, body.routeParams);
  if ('refused' in resolved) {
    return { ok: false, error: 'missing', message: resolved.refused };
  }

  const pagePath = resolved.path;
  // The render is the expensive half, and a caller heading for a screenshot never reads it — the browser renders
  // the same draft again from the token. So it is done only when asked for.
  let html: string | undefined;
  if (body.includeHtml !== false) {
    ({ body: html } = await buildBody(
      syntheticRequest(pagePath),
      config,
      body.spaceId,
      env,
      revision,
      renderFn,
      pluginManager,
      caches.offlineData,
      undefined,
      draftOffline
    ));
  }

  const reusable = body.mode === 'session' || body.mode === 'tests';
  const inspected = body.mode === 'tests';
  const ttlMs = reusable ? (config.preview?.sessionTtlMs ?? 900_000) : (config.preview?.ttlMs ?? 60_000);

  let token: string | undefined;
  if (config.draftStore) {
    token = randomUUID();
    await config.draftStore.put(token, draftOffline, {
      ttlMs,
      reusable,
      spaceId: body.spaceId,
      ...(inspected ? { inspected } : {})
    });
  }

  return {
    ok: true,
    token,
    pagePath,
    html: html ?? '',
    stateVersion: computeVersion(draftOffline),
    ...(token ? { expiresInMs: ttlMs } : {}),
    ...(resolved.signedInOnly ? { signedInOnly: true as const } : {})
  };
};
