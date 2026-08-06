import { registerAppResource, RESOURCE_MIME_TYPE } from '@modelcontextprotocol/ext-apps/server';

import { page } from './page';

import type { McpApp, McpViewSettings } from '../../types';
import type { McpUiResourceCsp, McpUiResourceMeta } from '@modelcontextprotocol/ext-apps';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

// The page itself fetches nothing; this covers what a rendered WIDGET reaches at runtime — the images, media and
// fonts an agent authored, and the endpoints an apiContainer reads.
//
// It has to be this wide, and it cannot be narrowed to the origins a widget actually uses. The CSP belongs to the
// `ui://` RESOURCE (hosts read it from resources/read, with the resources/list entry as fallback, and MAY cache
// it), while the widget's origins are authored per tool call, afterwards — and plitzi_render is stateless, so the
// read that carries this metadata has no idea which widget it is about. There is no per-result CSP: the spec types
// `csp` as `never` on the tool meta and hosts ignore it there.
//
// So `proxyEndpoint`'s origin is the one that carries the feature: this server's own, and every external URL a
// render authored is rewritten to it — a widget's images, fonts and API calls come from a declared origin
// whatever the agent wrote.
//
// With that origin present the declaration is EXACTLY it, in the shape the spec documents (`https://host`) and
// nothing else. The wildcard spellings a previous version listed alongside it (`*`, `https:`, `https://*`) are
// valid CSP source expressions but are not origins, and a host is free to validate this list and drop what it
// cannot parse — including, if it validates the object as a whole, the good entry with them. That is the failure
// mode this shape removes: one plain origin has nothing left to trip on. It also means a URL the widget builds at
// RUNTIME from fetched data is no longer reachable; the wildcards only ever covered that, and only on hosts
// permissive enough to accept them.
//
// Without an endpoint there is nothing to declare and nothing to lose, so the wildcards stay as the only chance
// an authored URL has on a host that accepts them.
const WILDCARDS = ['*', 'https:', 'https://*'];

const defaultCsp = (proxyOrigin?: string): McpUiResourceCsp =>
  proxyOrigin
    ? { resourceDomains: [proxyOrigin], connectDomains: [proxyOrigin] }
    : { resourceDomains: [...WILDCARDS, 'data:', 'blob:'], connectDomains: [...WILDCARDS] };

const originOf = (endpoint?: string): string | undefined => {
  if (!endpoint) {
    return undefined;
  }

  try {
    return new URL(endpoint).origin;
  } catch {
    return undefined;
  }
};

/** Serves the app as a self-contained page: no import map, no asset mounts, no cross-origin fetches, so the
 *  strictest host sandbox runs it and no deployment has to serve anything extra. */
export const registerApp = (server: McpServer, app: McpApp, settings: McpViewSettings): void => {
  const meta: { ui: McpUiResourceMeta } = { ui: { csp: app.csp ?? defaultCsp(originOf(settings.proxyEndpoint)) } };

  registerAppResource(server, app.name, app.uri, { description: app.description, _meta: meta }, async () => ({
    contents: [{ uri: app.uri, mimeType: RESOURCE_MIME_TYPE, text: await page(app, settings), _meta: meta }]
  }));
};
